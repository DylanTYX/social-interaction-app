import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export interface SpeechServiceConfig {
  /** Azure-issued authorization token (preferred). */
  authorizationToken: string;
  region: string;
  /**
   * When the current token expires (ms since epoch). When the wall clock
   * crosses this value we ask the caller to refresh it before opening a new
   * recognizer/synthesizer.
   */
  expiresAt: number;
}

export interface TranscriptResult {
  interim: string;
  final: string;
  isFinal: boolean;
  /** Start of the recognized phrase, in seconds from session start. */
  offsetSeconds?: number;
  /** Spoken duration of the recognized phrase, in seconds. */
  durationSeconds?: number;
}

export interface StartListeningOptions {
  /**
   * Domain words/phrases to bias recognition toward (names, acronyms,
   * role-specific jargon). Improves accuracy on interview terminology.
   */
  phraseList?: string[];
}

/** Azure reports offset/duration in 100-nanosecond ticks. */
const TICKS_PER_SECOND = 10_000_000;

export interface ProsodyOptions {
  /** Speaking rate delta as a percentage, e.g. +15 for 15% faster. */
  ratePercent?: number;
  /** Pitch delta as a percentage. */
  pitchPercent?: number;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function signedPercent(value: number): string {
  const rounded = Math.round(value);
  return rounded >= 0 ? `+${rounded}%` : `${rounded}%`;
}

/**
 * Wrap text in SSML so the interviewer's voice can match the persona: a
 * fast-paced persona speaks a little quicker, a patient one a little slower.
 */
function buildProsodySsml(
  text: string,
  voiceName: string,
  prosody: ProsodyOptions,
): string {
  const rate = signedPercent(prosody.ratePercent ?? 0);
  const pitch = signedPercent(prosody.pitchPercent ?? 0);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voiceName}"><prosody rate="${rate}" pitch="${pitch}">${escapeXml(
    text,
  )}</prosody></voice></speak>`;
}

/** Map a persona pace dial (1=patient … 10=fast) to an SSML rate delta. */
export function paceToRatePercent(pace: number | undefined): number {
  const safe = Number.isFinite(pace) ? (pace as number) : 5;
  // pace 1 → -20%, pace 5 → 0%, pace 10 → +25%
  return Math.round((safe - 5) * 5);
}

/**
 * Incrementally split a growing text buffer into complete, speakable sentences
 * for streaming TTS. Returns the finished sentences plus the leftover partial
 * tail to carry into the next call. A short minimum length avoids handing the
 * synthesizer tiny fragments (e.g. "Hi.") that sound choppy; pass
 * `flush: true` at end-of-stream to emit whatever remains.
 */
export function extractSpeakableSentences(
  buffer: string,
  options?: { flush?: boolean; minChars?: number },
): { sentences: string[]; rest: string } {
  const minChars = options?.minChars ?? 24;
  const sentences: string[] = [];
  let working = buffer;

  // Match up to sentence-ending punctuation, or a paragraph break (double
  // newline). Single newlines are common inside streamed LLM replies and must
  // NOT split TTS — that produced one-word utterances per line.
  const boundary = /^[\s\S]*?[.!?…](?=\s|$)|^[\s\S]*?\n\n/;
  while (true) {
    const match = working.match(boundary);
    if (!match) break;
    const chunk = match[0];
    const remainder = working.slice(chunk.length);
    // If the sentence is very short, keep accumulating unless we're flushing.
    if (chunk.trim().length < minChars && remainder.trim().length > 0) {
      // Pull in the next boundary by extending: treat current chunk as part of
      // the tail and re-run on the combined remainder.
      const nextMatch = remainder.match(boundary);
      if (nextMatch) {
        sentences.push((chunk + nextMatch[0]).trim());
        working = remainder.slice(nextMatch[0].length);
        continue;
      }
      break;
    }
    sentences.push(chunk.trim());
    working = remainder;
  }

  if (options?.flush) {
    const tail = working.trim();
    if (tail.length > 0) {
      sentences.push(tail);
      working = "";
    }
  }

  return { sentences: sentences.filter(Boolean), rest: working };
}

/**
 * Append `addition` to `existing` while removing any text that already
 * appeared at the tail of `existing`. The Azure SDK occasionally emits the
 * same words once as part of an interim phrase and again as part of the next
 * final phrase, particularly across pauses; this helper de-duplicates that
 * overlap so callers get a clean, monotonically-growing transcript.
 *
 * Examples:
 *   appendUniqueTranscript("hello world", "world today") → "hello world today"
 *   appendUniqueTranscript("hello world", "hello world") → "hello world"
 *   appendUniqueTranscript("",            "hello")       → "hello"
 */
export function appendUniqueTranscript(
  existing: string,
  addition: string,
): string {
  const trimmedAddition = addition.trim();
  if (!trimmedAddition) return existing;

  const trimmedExisting = existing.trim();
  if (!trimmedExisting) return trimmedAddition;

  const normalizedExisting = trimmedExisting.toLowerCase();
  const normalizedAddition = trimmedAddition.toLowerCase();

  // Exact tail match: addition is already at the end.
  if (normalizedExisting.endsWith(normalizedAddition)) {
    return trimmedExisting;
  }

  // Find the largest overlap where the suffix of existing equals the prefix
  // of the addition. This handles cases like
  //   existing = "I led the launch"
  //   addition = "led the launch and saw a 12% lift"
  // → "I led the launch and saw a 12% lift"
  const maxOverlap = Math.min(
    normalizedExisting.length,
    normalizedAddition.length,
  );
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (
      normalizedExisting.slice(-overlap) ===
      normalizedAddition.slice(0, overlap)
    ) {
      return `${trimmedExisting}${trimmedAddition.slice(overlap)}`;
    }
  }

  return `${trimmedExisting} ${trimmedAddition}`;
}

/**
 * SpeechService wraps Azure Cognitive Services Speech SDK to provide:
 *   - Continuous speech-to-text with interim + final results
 *   - Text-to-speech that can be interrupted mid-playback
 *
 * Why this is more than a thin wrapper:
 *   The Azure SDK's `SpeechSynthesizer.close()` shuts down the network/SDK
 *   pipe but does NOT stop audio that has already been buffered to the system
 *   speaker via `AudioConfig.fromDefaultSpeakerOutput()`. To make the voice
 *   actually stop when the user navigates away, we drive playback through a
 *   `SpeakerAudioDestination` we control, so we can pause it, close it, and
 *   silence the underlying <audio> element on demand.
 *
 *   Authentication runs through a server-issued token (`/api/speech-token`)
 *   so the raw subscription key never reaches the browser.
 */
export class SpeechService {
  private static instance: SpeechService | null = null;
  private config: SpeechServiceConfig | null = null;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private recognizerAudioConfig: SpeechSDK.AudioConfig | null = null;
  private synthesizer: SpeechSDK.SpeechSynthesizer | null = null;
  private speakerDestination: SpeechSDK.SpeakerAudioDestination | null = null;
  private synthesisAudioConfig: SpeechSDK.AudioConfig | null = null;
  private isSpeakingFlag = false;

  // Streaming TTS queue: utterances are fed to one persistent synthesizer as
  // soon as each is synthesized (Azure queues speaker playback). We only wait
  // for onAudioEnd once per burst, not between every sentence.
  private speechGeneration = 0;
  private pendingSpeakCount = 0;
  private pendingUtterances: Array<{
    text: string;
    voiceUri?: string;
    prosody?: ProsodyOptions;
    generation: number;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private queueWorkerRunning = false;
  private queuePlaybackSettled: Promise<void> = Promise.resolve();
  private queuePlayback: {
    synthesizer: SpeechSDK.SpeechSynthesizer;
    speakerDestination: SpeechSDK.SpeakerAudioDestination;
    audioConfig: SpeechSDK.AudioConfig;
    voiceName: string;
  } | null = null;

  private constructor() {}

  static getInstance(): SpeechService {
    if (!SpeechService.instance) {
      SpeechService.instance = new SpeechService();
    }
    return SpeechService.instance;
  }

  /**
   * Provide an Azure-issued authorization token + region. Tokens last ~10
   * minutes; the caller is responsible for refreshing before that.
   */
  initialize(config: SpeechServiceConfig): void {
    this.config = config;
  }

  isInitialized(): boolean {
    if (!this.config) return false;
    if (!this.config.authorizationToken) return false;
    if (!this.config.region) return false;
    if (Number.isFinite(this.config.expiresAt) && Date.now() > this.config.expiresAt) {
      return false;
    }
    return true;
  }

  isSpeaking(): boolean {
    return (
      this.isSpeakingFlag ||
      this.pendingSpeakCount > 0 ||
      this.queueWorkerRunning
    );
  }

  /** Resolves when all queued streaming utterances have finished playing. */
  waitForQueuedPlayback(): Promise<void> {
    return this.queuePlaybackSettled;
  }

  /**
   * Build a fresh `SpeechConfig` using the cached auth token. Throws if the
   * service has not been initialized; the caller should catch and re-fetch a
   * token if `isInitialized()` returned false.
   */
  private buildSpeechConfig(): SpeechSDK.SpeechConfig {
    if (!this.config) {
      throw new Error(
        "Speech service not initialized. Call initialize() with a fresh token.",
      );
    }

    return SpeechSDK.SpeechConfig.fromAuthorizationToken(
      this.config.authorizationToken,
      this.config.region,
    );
  }

  /**
   * Prompt the browser for microphone access. Returns true on success.
   */
  async requestMicrophoneAccess(): Promise<boolean> {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        console.error(
          "mediaDevices is not supported. Check: HTTPS required, browser support, or OS permissions.",
        );
        return false;
      }

      if (!navigator.mediaDevices.getUserMedia) {
        console.error("getUserMedia is not supported in this browser.");
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          console.error(
            "Microphone permission denied. Please allow microphone access in browser settings and reload the page.",
          );
        } else if (error.name === "NotFoundError") {
          console.error(
            "No microphone device found. Please connect a microphone.",
          );
        } else if (error.name === "NotReadableError") {
          console.error(
            "Microphone is in use by another application. Close other apps and try again.",
          );
        }
      }
      const errorMessage =
        error instanceof Error ? error.message : "Microphone access denied";
      console.error("Microphone access error:", errorMessage);
      return false;
    }
  }

  /**
   * Start continuous speech recognition with real-time interim results.
   */
  async startListening(
    onTranscript: (result: TranscriptResult) => void,
    onError: (error: string) => void,
    options?: StartListeningOptions,
  ): Promise<void> {
    if (!this.isInitialized()) {
      onError(
        "Speech service not initialized or token expired. Refresh the token and try again.",
      );
      return;
    }

    if (typeof window === "undefined" || typeof navigator === "undefined") {
      onError("Speech recognition requires browser environment.");
      return;
    }

    if (!navigator.mediaDevices) {
      onError(
        "Microphone not available. Ensure HTTPS is enabled, the browser supports mediaDevices, and OS permissions are granted.",
      );
      return;
    }

    // If a recognizer was left over from a prior session, tear it down before
    // creating a new one so we do not leak websocket connections.
    await this.disposeRecognizer();

    try {
      this.recognizerAudioConfig =
        SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      const speechConfig = this.buildSpeechConfig();
      speechConfig.speechRecognitionLanguage = "en-US";
      // Word-level timestamps + detailed output give us per-phrase timing,
      // which powers the delivery metrics (WPM, pauses) on the client.
      speechConfig.requestWordLevelTimestamps();
      speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

      this.recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        this.recognizerAudioConfig,
      );

      // Bias recognition toward interview-specific vocabulary when supplied.
      const phraseList = options?.phraseList?.filter(Boolean) ?? [];
      if (phraseList.length > 0) {
        try {
          const phraseListGrammar =
            SpeechSDK.PhraseListGrammar.fromRecognizer(this.recognizer);
          phraseList.forEach((phrase) => phraseListGrammar.addPhrase(phrase));
        } catch (error) {
          console.warn("Failed to apply phrase list:", error);
        }
      }

      this.recognizer.recognizing = (_sender, event) => {
        onTranscript({
          interim: event.result.text,
          final: "",
          isFinal: false,
        });
      };

      this.recognizer.recognized = (_sender, event) => {
        if (event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          onTranscript({
            interim: "",
            final: event.result.text,
            isFinal: true,
            offsetSeconds: event.result.offset / TICKS_PER_SECOND,
            durationSeconds: event.result.duration / TICKS_PER_SECOND,
          });
        } else if (event.result.reason === SpeechSDK.ResultReason.NoMatch) {
          // NoMatch is common between phrases (e.g. when the user pauses);
          // surfacing it as an error every time would be noisy. We only emit
          // an error when the canceled reason indicates a real failure.
        } else if (event.result.reason === SpeechSDK.ResultReason.Canceled) {
          const cancellation = SpeechSDK.CancellationDetails.fromResult(
            event.result,
          );
          if (cancellation.reason === SpeechSDK.CancellationReason.Error) {
            onError(
              `Speech recognition error: ${cancellation.errorDetails || "unknown"}`,
            );
          }
        }
      };

      this.recognizer.canceled = (_sender, event) => {
        if (event.reason === SpeechSDK.CancellationReason.Error) {
          onError(
            `Speech recognition error: ${event.errorDetails || "unknown"}`,
          );
        }
      };

      this.recognizer.startContinuousRecognitionAsync(
        () => {},
        (error) => {
          let userFriendlyError = `Failed to start listening: ${error}`;

          if (error?.includes("NotAllowedError")) {
            userFriendlyError =
              "Microphone permission denied. Please allow access in browser settings.";
          } else if (error?.includes("NotFoundError")) {
            userFriendlyError =
              "No microphone found. Please connect a microphone device.";
          } else if (error?.includes("NotReadableError")) {
            userFriendlyError =
              "Microphone is in use. Close other apps using the microphone.";
          }

          onError(userFriendlyError);
        },
      );
    } catch (error) {
      let userFriendlyError = "Speech service error";

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          userFriendlyError =
            "Microphone permission denied. Please allow access in browser settings.";
        } else if (error.name === "NotFoundError") {
          userFriendlyError =
            "No microphone found. Please connect a microphone device.";
        } else if (error.name === "NotReadableError") {
          userFriendlyError =
            "Microphone is in use. Close other apps using the microphone.";
        }
      } else if (error instanceof Error) {
        userFriendlyError = `Speech service error: ${error.message}`;
      }

      onError(userFriendlyError);
    }
  }

  /**
   * Stop continuous recognition. Safe to call multiple times.
   */
  async stopListening(): Promise<void> {
    if (!this.recognizer) {
      return;
    }

    const recognizer = this.recognizer;

    await new Promise<void>((resolve) => {
      try {
        recognizer.stopContinuousRecognitionAsync(
          () => resolve(),
          (error) => {
            console.error("Error stopping recognition:", error);
            resolve();
          },
        );
      } catch (error) {
        console.error("Error invoking stopContinuousRecognitionAsync:", error);
        resolve();
      }
    });
  }

  /**
   * Synthesize text to speech as a single utterance. Cancels anything already
   * playing/queued first. Resolves once playback has finished or was
   * interrupted by `stopSpeaking()` / `cleanup()`.
   */
  async speak(
    text: string,
    voiceUri?: string,
    prosody?: ProsodyOptions,
  ): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error(
        "Speech service not initialized or token expired. Refresh the token and try again.",
      );
    }

    if (!text || !text.trim()) {
      return;
    }

    // If something is already speaking, stop it first so the new utterance
    // does not overlap with stale audio.
    await this.stopSpeaking();

    return this.runSynthesis(text, voiceUri, prosody);
  }

  /**
   * Enqueue an utterance for sequential playback. Used for streaming TTS: as
   * the LLM emits complete sentences, each is fed to a shared synthesizer so
   * Azure can queue playback with minimal gaps. Resolves once synthesis for
   * this utterance is queued to the speaker (not after playback ends).
   * Call `waitForQueuedPlayback()` to know when audio has fully finished.
   */
  speakQueued(
    text: string,
    voiceUri?: string,
    prosody?: ProsodyOptions,
  ): Promise<void> {
    if (!this.isInitialized()) {
      return Promise.resolve();
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return Promise.resolve();
    }

    const generation = this.speechGeneration;
    this.pendingSpeakCount += 1;

    return new Promise<void>((resolve, reject) => {
      this.pendingUtterances.push({
        text: trimmed,
        voiceUri,
        prosody,
        generation,
        resolve,
        reject,
      });
      this.kickQueueWorker();
    }).finally(() => {
      this.pendingSpeakCount = Math.max(0, this.pendingSpeakCount - 1);
    });
  }

  private kickQueueWorker(): void {
    if (this.queueWorkerRunning) return;
    this.queueWorkerRunning = true;
    this.isSpeakingFlag = true;

    let resolveSettled!: () => void;
    this.queuePlaybackSettled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });

    void (async () => {
      try {
        while (true) {
          const fed = await this.feedPendingUtterances();
          if (!fed) break;
          await this.waitForQueuePlaybackEnd();
          if (this.pendingUtterances.length === 0) break;
        }
      } finally {
        this.disposeQueuePlayback();
        this.queueWorkerRunning = false;
        this.isSpeakingFlag = false;
        resolveSettled();
        if (this.pendingUtterances.length > 0) {
          this.kickQueueWorker();
        }
      }
    })();
  }

  private async feedPendingUtterances(): Promise<boolean> {
    let fed = false;

    while (this.pendingUtterances.length > 0) {
      const item = this.pendingUtterances[0];
      if (item.generation !== this.speechGeneration) {
        this.pendingUtterances.shift();
        item.resolve();
        continue;
      }

      this.pendingUtterances.shift();
      try {
        await this.feedQueuedUtterance(item);
        item.resolve();
        fed = true;
      } catch (error) {
        item.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    return fed;
  }

  private ensureQueuePlayback(
    voiceUri: string | undefined,
    prosody: ProsodyOptions | undefined,
  ): NonNullable<typeof this.queuePlayback> {
    const voiceName = voiceUri || "en-US-AriaNeural";

    if (this.queuePlayback && this.queuePlayback.voiceName === voiceName) {
      return this.queuePlayback;
    }

    this.disposeQueuePlayback();

    const speechConfig = this.buildSpeechConfig();
    speechConfig.speechSynthesisVoiceName = voiceName;
    const speakerDestination = new SpeechSDK.SpeakerAudioDestination();
    const audioConfig =
      SpeechSDK.AudioConfig.fromSpeakerOutput(speakerDestination);
    const synthesizer = new SpeechSDK.SpeechSynthesizer(
      speechConfig,
      audioConfig,
    );

    this.queuePlayback = {
      synthesizer,
      speakerDestination,
      audioConfig,
      voiceName,
    };

    this.synthesizer = synthesizer;
    this.speakerDestination = speakerDestination;
    this.synthesisAudioConfig = audioConfig;

    return this.queuePlayback;
  }

  /**
   * Push one utterance into the persistent queue synthesizer. Resolves when
   * Azure has synthesized and queued it for speaker playback (not when playback
   * ends), so the next sentence can be prepared while the current one plays.
   */
  private feedQueuedUtterance(item: {
    text: string;
    voiceUri?: string;
    prosody?: ProsodyOptions;
  }): Promise<void> {
    const playback = this.ensureQueuePlayback(item.voiceUri, item.prosody);
    const trimmed = item.text.trim();
    const voiceName = playback.voiceName;

    const useSsml =
      Boolean(item.prosody) &&
      ((item.prosody?.ratePercent ?? 0) !== 0 ||
        (item.prosody?.pitchPercent ?? 0) !== 0);
    const ssml = useSsml
      ? buildProsodySsml(trimmed, voiceName, item.prosody as ProsodyOptions)
      : null;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        action();
      };

      const onResult = (result: SpeechSDK.SpeechSynthesisResult) => {
        if (settled) return;

        if (
          result.reason ===
          SpeechSDK.ResultReason.SynthesizingAudioCompleted
        ) {
          finish(resolve);
          return;
        }

        if (result.reason === SpeechSDK.ResultReason.Canceled) {
          const cancellation =
            SpeechSDK.CancellationDetails.fromResult(result);
          if (
            cancellation.reason === SpeechSDK.CancellationReason.Error
          ) {
            finish(() =>
              reject(
                new Error(
                  `Speech synthesis failed: ${cancellation.errorDetails || "unknown"}`,
                ),
              ),
            );
          } else {
            finish(resolve);
          }
        }
      };

      const onError = (error: string) => {
        finish(() => reject(new Error(`Speech synthesis error: ${error}`)));
      };

      if (ssml) {
        playback.synthesizer.speakSsmlAsync(ssml, onResult, onError);
      } else {
        playback.synthesizer.speakTextAsync(trimmed, onResult, onError);
      }
    });
  }

  private waitForQueuePlaybackEnd(): Promise<void> {
    const destination = this.queuePlayback?.speakerDestination;
    if (!destination) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      let safetyTimeout: ReturnType<typeof setTimeout> | undefined;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (safetyTimeout) clearTimeout(safetyTimeout);
        resolve();
      };

      destination.onAudioEnd = finish;
      safetyTimeout = setTimeout(finish, 120_000);
    });
  }

  private disposeQueuePlayback(): void {
    if (!this.queuePlayback) return;

    const { synthesizer, audioConfig, speakerDestination } = this.queuePlayback;
    this.queuePlayback = null;

    if (this.synthesizer === synthesizer) {
      this.synthesizer = null;
    }
    if (this.synthesisAudioConfig === audioConfig) {
      this.synthesisAudioConfig = null;
    }
    if (this.speakerDestination === speakerDestination) {
      this.speakerDestination = null;
    }

    this.disposeSynthesizer(synthesizer, audioConfig, speakerDestination);
  }

  /**
   * Core synthesis for one-shot `speak()` (opening greeting, mic check).
   */
  private async runSynthesis(
    text: string,
    voiceUri?: string,
    prosody?: ProsodyOptions,
  ): Promise<void> {
    const voiceName = voiceUri || "en-US-AriaNeural";
    const speechConfig = this.buildSpeechConfig();
    speechConfig.speechSynthesisVoiceName = voiceName;

    // Use SSML only when a non-trivial prosody adjustment is requested; plain
    // text playback is slightly cheaper to set up otherwise.
    const useSsml =
      Boolean(prosody) &&
      ((prosody?.ratePercent ?? 0) !== 0 || (prosody?.pitchPercent ?? 0) !== 0);
    const ssml = useSsml
      ? buildProsodySsml(text, voiceName, prosody as ProsodyOptions)
      : null;

    const speakerDestination = new SpeechSDK.SpeakerAudioDestination();
    const audioConfig =
      SpeechSDK.AudioConfig.fromSpeakerOutput(speakerDestination);
    const synthesizer = new SpeechSDK.SpeechSynthesizer(
      speechConfig,
      audioConfig,
    );

    this.speakerDestination = speakerDestination;
    this.synthesisAudioConfig = audioConfig;
    this.synthesizer = synthesizer;
    this.isSpeakingFlag = true;

    const trimmed = text.trim();

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let safetyTimeout: ReturnType<typeof setTimeout> | undefined;

        const finish = (action: () => void) => {
          if (settled) return;
          settled = true;
          if (safetyTimeout) clearTimeout(safetyTimeout);
          action();
        };

        // Wait for speaker playback to finish. Resolving on
        // SynthesizingAudioCompleted alone disposed audio too early, so only the
        // first syllable of each queued sentence was audible.
        speakerDestination.onAudioEnd = () => {
          finish(resolve);
        };

        const safetyMs = Math.min(
          120_000,
          Math.max(8_000, trimmed.length * 90 + 2_000),
        );
        safetyTimeout = setTimeout(() => {
          finish(resolve);
        }, safetyMs);

        const onResult = (result: SpeechSDK.SpeechSynthesisResult) => {
          if (settled) return;

          if (
            result.reason ===
            SpeechSDK.ResultReason.SynthesizingAudioCompleted
          ) {
            return;
          }

          if (result.reason === SpeechSDK.ResultReason.Canceled) {
            const cancellation =
              SpeechSDK.CancellationDetails.fromResult(result);
            if (
              cancellation.reason === SpeechSDK.CancellationReason.Error
            ) {
              finish(() =>
                reject(
                  new Error(
                    `Speech synthesis failed: ${cancellation.errorDetails || "unknown"}`,
                  ),
                ),
              );
            } else {
              finish(resolve);
            }
          }
        };

        const onError = (error: string) => {
          finish(() => reject(new Error(`Speech synthesis error: ${error}`)));
        };

        if (ssml) {
          synthesizer.speakSsmlAsync(ssml, onResult, onError);
        } else {
          synthesizer.speakTextAsync(trimmed, onResult, onError);
        }
      });
    } finally {
      this.disposeSynthesizer(synthesizer, audioConfig, speakerDestination);
      // Only clear refs if the active synthesizer is still ours; another call
      // to speak() may have replaced it.
      if (this.synthesizer === synthesizer) {
        this.synthesizer = null;
      }
      if (this.synthesisAudioConfig === audioConfig) {
        this.synthesisAudioConfig = null;
      }
      if (this.speakerDestination === speakerDestination) {
        this.speakerDestination = null;
      }
      this.isSpeakingFlag = false;
    }
  }

  /**
   * Hard-stop any in-flight TTS playback. Safe to call when nothing is
   * playing.
   */
  async stopSpeaking(): Promise<void> {
    // Cancel any queued (not-yet-started) utterances for barge-in.
    this.speechGeneration += 1;
    this.pendingSpeakCount = 0;

    for (const item of this.pendingUtterances) {
      item.resolve();
    }
    this.pendingUtterances = [];
    this.disposeQueuePlayback();

    const synthesizer = this.synthesizer;
    const audioConfig = this.synthesisAudioConfig;
    const speakerDestination = this.speakerDestination;

    if (!synthesizer && !speakerDestination) {
      this.isSpeakingFlag = false;
      return;
    }

    this.synthesizer = null;
    this.synthesisAudioConfig = null;
    this.speakerDestination = null;
    this.isSpeakingFlag = false;

    this.disposeSynthesizer(synthesizer, audioConfig, speakerDestination);
  }

  /**
   * Dispose the recognizer and release the microphone audio config.
   */
  private async disposeRecognizer(): Promise<void> {
    const recognizer = this.recognizer;
    const audioConfig = this.recognizerAudioConfig;
    this.recognizer = null;
    this.recognizerAudioConfig = null;

    if (recognizer) {
      try {
        await new Promise<void>((resolve) => {
          try {
            recognizer.stopContinuousRecognitionAsync(
              () => resolve(),
              () => resolve(),
            );
          } catch {
            resolve();
          }
        });
      } catch {
        // ignore
      }

      try {
        recognizer.close();
      } catch (error) {
        console.warn("Error closing recognizer:", error);
      }
    }

    if (audioConfig) {
      try {
        audioConfig.close();
      } catch (error) {
        console.warn("Error closing recognizer audio config:", error);
      }
    }
  }

  /**
   * Dispose a synthesizer + speaker destination, including stopping any
   * audio that has already been buffered to the speaker.
   */
  private disposeSynthesizer(
    synthesizer: SpeechSDK.SpeechSynthesizer | null,
    audioConfig: SpeechSDK.AudioConfig | null,
    speakerDestination: SpeechSDK.SpeakerAudioDestination | null,
  ): void {
    if (speakerDestination) {
      try {
        speakerDestination.pause();
      } catch {
        // pause() may throw if the underlying <audio> element is in an
        // unexpected state; we ignore because close() comes next.
      }

      try {
        // Forcefully silence the underlying HTMLAudioElement; this is the
        // step that actually stops audio that has already been buffered.
        const internal = speakerDestination.internalAudio;
        if (internal) {
          internal.muted = true;
          internal.pause();
          try {
            internal.currentTime = 0;
          } catch {
            // currentTime can throw if the element is not ready; ignore.
          }
          internal.src = "";
          try {
            internal.load();
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.warn("Error silencing synthesizer audio element:", error);
      }

      try {
        speakerDestination.close();
      } catch (error) {
        console.warn("Error closing speaker destination:", error);
      }
    }

    if (synthesizer) {
      try {
        synthesizer.close();
      } catch (error) {
        console.warn("Error closing synthesizer:", error);
      }
    }

    if (audioConfig) {
      try {
        audioConfig.close();
      } catch (error) {
        console.warn("Error closing synthesizer audio config:", error);
      }
    }
  }

  /**
   * Tear down everything: recognizer, synthesizer, and any in-flight audio.
   * Call this from React unmount cleanup and `beforeunload` handlers.
   */
  cleanup(): void {
    void this.disposeRecognizer();

    this.speechGeneration += 1;
    this.pendingSpeakCount = 0;

    for (const item of this.pendingUtterances) {
      item.resolve();
    }
    this.pendingUtterances = [];
    this.disposeQueuePlayback();

    const synthesizer = this.synthesizer;
    const audioConfig = this.synthesisAudioConfig;
    const speakerDestination = this.speakerDestination;
    this.synthesizer = null;
    this.synthesisAudioConfig = null;
    this.speakerDestination = null;
    this.isSpeakingFlag = false;

    this.disposeSynthesizer(synthesizer, audioConfig, speakerDestination);
  }

  /**
   * Curated set of voice options to surface in the setup wizard. These names
   * are valid `speechSynthesisVoiceName` values for Azure Neural TTS.
   */
  getAvailableVoices(): { name: string; uri: string }[] {
    return [
      { name: "Aria — US Female (warm)", uri: "en-US-AriaNeural" },
      { name: "Jenny — US Female (friendly)", uri: "en-US-JennyNeural" },
      { name: "Guy — US Male (confident)", uri: "en-US-GuyNeural" },
      { name: "Davis — US Male (calm)", uri: "en-US-DavisNeural" },
      { name: "Sonia — UK Female (clear)", uri: "en-GB-SoniaNeural" },
      { name: "Ryan — UK Male (steady)", uri: "en-GB-RyanNeural" },
    ];
  }
}

export function getSpeechService(): SpeechService {
  return SpeechService.getInstance();
}

export interface SpeechTokenResponse {
  token: string;
  region: string;
  expiresInSeconds: number;
}

/**
 * Fetch a fresh Azure auth token from the server. Use this from the client
 * before calling `speechService.initialize(...)`. The caller decides when to
 * refresh — typically before each new session and whenever isInitialized()
 * starts returning false.
 */
export async function fetchSpeechToken(): Promise<SpeechTokenResponse> {
  const response = await fetch("/api/speech-token", { cache: "no-store" });
  if (!response.ok) {
    const detail = (await response
      .json()
      .catch(() => null)) as { error?: string; details?: string } | null;
    throw new Error(
      detail?.details ||
        detail?.error ||
        `Failed to fetch speech token (HTTP ${response.status}).`,
    );
  }

  const data = (await response.json()) as SpeechTokenResponse;
  if (!data.token || !data.region) {
    throw new Error("Speech token response missing required fields.");
  }
  return data;
}
