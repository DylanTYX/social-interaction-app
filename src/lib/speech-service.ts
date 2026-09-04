import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import {
  AZURE_VOICE_OPTIONS,
  resolveKnownVoice,
  ssmlLangForVoice,
  type SpeechVoiceOption,
} from "@/lib/speech-voices";

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
 *
 * Takes the whole voice rather than its name because `xml:lang` has to follow
 * the voice's locale. It was hardcoded to `en-US`, which was wrong for the
 * `en-GB` voices and would be actively harmful once accents ship — see
 * `ssmlLangForVoice`, which is where that decision lives.
 *
 * The voice name is escaped even though `ensureQueuePlayback` has already
 * resolved it against the catalogue. Belt and braces: the validation is the
 * real defence, but this keeps a future caller that bypasses that resolution
 * from reopening an attribute-injection hole.
 */
function buildProsodySsml(
  text: string,
  voice: SpeechVoiceOption,
  prosody: ProsodyOptions,
): string {
  const rate = signedPercent(prosody.ratePercent ?? 0);
  const pitch = signedPercent(prosody.pitchPercent ?? 0);
  const lang = escapeXml(ssmlLangForVoice(voice.locale));
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${escapeXml(
    voice.uri,
  )}"><prosody rate="${rate}" pitch="${pitch}">${escapeXml(
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
  // soon as each is synthesized (Azure queues speaker playback), and the whole
  // burst is waited on exactly once, in `waitForQueuedPlayback`.
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
  /** Resolves when the worker has finished *synthesizing*, not playing. */
  private queueSynthesisSettled: Promise<void> = Promise.resolve();
  /**
   * Force-settles the synthesis request currently in flight. The SDK does not
   * invoke a pending `speakTextAsync` callback when the synthesizer is closed
   * underneath it, so without this a `stopSpeaking()` landing mid-sentence
   * strands the worker forever and the interviewer never speaks again.
   */
  private abortActiveFeed: (() => void) | null = null;
  private queuePlayback: {
    synthesizer: SpeechSDK.SpeechSynthesizer;
    speakerDestination: SpeechSDK.SpeakerAudioDestination;
    audioConfig: SpeechSDK.AudioConfig;
    /** The resolved catalogue voice, kept whole so SSML can read its locale. */
    voice: SpeechVoiceOption;
    /** Characters handed to Azure, used to size the playback-wait ceiling. */
    queuedChars: number;
  } | null = null;

  /**
   * Where a TTS failure goes. Every failure in this path used to end at a
   * `console.warn` — so "the interviewer did not speak" was indistinguishable
   * from "the interviewer had nothing to say", both to the user and to the UI,
   * which shows a "Speaking…" badge driven purely by optimism.
   */
  private playbackErrorHandler: ((message: string) => void) | null = null;

  private constructor() {}

  /** Register (or clear, with `null`) the sink for TTS failures. */
  onPlaybackError(handler: ((message: string) => void) | null): void {
    this.playbackErrorHandler = handler;
  }

  private reportPlaybackFailure(message: string): void {
    console.warn("TTS playback:", message);
    this.playbackErrorHandler?.(message);
  }

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
    if (
      Number.isFinite(this.config.expiresAt) &&
      Date.now() > this.config.expiresAt
    ) {
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

  /**
   * Resolves when every queued streaming utterance has actually finished
   * playing. Call it once, after the last `speakQueued` for a turn — it is what
   * closes the audio stream, so nothing may be enqueued after it.
   *
   * This used to return a promise the worker settled between sentences, which
   * is why the interviewer's audio arrived minutes late; see
   * `waitForQueuePlaybackEnd` for the mechanism.
   */
  async waitForQueuedPlayback(): Promise<void> {
    // Synthesis first. Re-read the promise each pass: the worker replaces it
    // when it re-kicks itself for utterances that landed as it was exiting.
    while (this.queueWorkerRunning || this.pendingUtterances.length > 0) {
      await this.queueSynthesisSettled;
    }

    const playback = this.queuePlayback;
    if (!playback) {
      this.isSpeakingFlag = false;
      return;
    }

    try {
      await this.waitForQueuePlaybackEnd(playback);
    } finally {
      /**
       * Dispose only what this call was waiting on.
       *
       * A barge-in — the "Stop voice" button, or opening the microphone during
       * playback — already disposed `playback` and may have built a *new* one
       * for the next turn by the time this wait finally gives up on its
       * ceiling. Disposing unconditionally then cut the new reply off
       * mid-sentence, force-resolved its in-flight synthesis and left
       * `isSpeakingFlag` false while its worker was still running.
       */
      if (this.queuePlayback === playback) {
        this.disposeQueuePlayback();
        this.isSpeakingFlag = false;
      }
    }
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
          const phraseListGrammar = SpeechSDK.PhraseListGrammar.fromRecognizer(
            this.recognizer,
          );
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
      // A lapsed or missing token. Silently resolving here is what made a
      // dead session look like a quiet interviewer.
      this.reportPlaybackFailure(
        "Speech credentials are not available, so the interviewer could not be voiced.",
      );
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
    this.queueSynthesisSettled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });

    void (async () => {
      try {
        // Drain synthesis and nothing else. The worker used to `await
        // waitForQueuePlaybackEnd()` between batches, which was both
        // unresolvable (see there) and unnecessary: every utterance is appended
        // to the *same* MediaSource buffer, so the browser already plays them
        // back-to-back. Feeding sentence N+1 while N is audible is the point of
        // the shared synthesizer, and is what keeps the gaps out.
        await this.feedPendingUtterances();
      } finally {
        this.queueWorkerRunning = false;
        resolveSettled();
        // Something may have been enqueued between the last drain check and
        // clearing the flag.
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
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return fed;
  }

  private ensureQueuePlayback(
    voiceUri: string | undefined,
  ): NonNullable<typeof this.queuePlayback> {
    // Was `voiceUri || "en-US-AriaNeural"`. `voiceUri` originates in
    // `launch_meta.voiceConfig.selectedVoiceUri`, which `normalizeVoiceConfig`
    // only type-checks and truncates to 120 characters — it was never compared
    // against the voice list on either side. That string reached
    // `speechSynthesisVoiceName` and, unescaped, the SSML `<voice name="…">`
    // attribute, so a crafted value could close the attribute and inject
    // elements. Resolving through the catalogue means an unrecognised URI now
    // degrades to the default voice instead of reaching Azure verbatim.
    const voice = resolveKnownVoice(voiceUri);
    const voiceName = voice.uri;

    if (this.queuePlayback && this.queuePlayback.voice.uri === voiceName) {
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
      voice,
      queuedChars: 0,
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
    const playback = this.ensureQueuePlayback(item.voiceUri);
    const trimmed = item.text.trim();

    const useSsml =
      Boolean(item.prosody) &&
      ((item.prosody?.ratePercent ?? 0) !== 0 ||
        (item.prosody?.pitchPercent ?? 0) !== 0);
    const ssml = useSsml
      ? buildProsodySsml(
          trimmed,
          playback.voice,
          item.prosody as ProsodyOptions,
        )
      : null;

    playback.queuedChars += trimmed.length;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      // Collected rather than held in `let`s, because `finish` is defined
      // before the timers it has to clear.
      const cleanups: Array<() => void> = [];

      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        for (const cleanup of cleanups) cleanup();
        if (this.abortActiveFeed === abort) this.abortActiveFeed = null;
        action();
      };

      // Closing a synthesizer does not invoke the pending request's callbacks,
      // so a `stopSpeaking()` that lands mid-sentence would otherwise leave
      // this promise permanently unsettled — and with it `queueWorkerRunning`,
      // which gates every future utterance for the life of the page.
      const abort = () => finish(resolve);
      this.abortActiveFeed = abort;

      // Independent backstop for a synthesis that neither completes, cancels
      // nor errors — a dropped websocket, most likely.
      const synthesisTimeout = setTimeout(
        () => finish(() => reject(new Error("Speech synthesis timed out"))),
        30_000,
      );
      cleanups.push(() => clearTimeout(synthesisTimeout));

      const onResult = (result: SpeechSDK.SpeechSynthesisResult) => {
        if (settled) return;

        if (
          result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted
        ) {
          finish(resolve);
          return;
        }

        if (result.reason === SpeechSDK.ResultReason.Canceled) {
          const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
          if (cancellation.reason === SpeechSDK.CancellationReason.Error) {
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

  /**
   * Wait for the burst that has been fed to `playback` to finish playing.
   *
   * **This is the fix for the minutes-long TTS delay.** The old version armed
   * `destination.onAudioEnd` and a 120-second safety timer, and the timer was
   * always what fired — `onAudioEnd` was unreachable by construction:
   *
   *   `onAudioEnd` is only invoked from `privAudio.onended`
   *   (`SpeakerAudioDestination.js:149-151`). `onended` on a MediaSource-backed
   *   element needs `MediaSource.endOfStream()`, reached only via
   *   `canEndStream()`, which requires `privIsClosed` — set exclusively by
   *   `close()`. The SDK calls `close()` on adapter dispose, never per
   *   utterance, and the queue path deliberately keeps one destination alive
   *   across a burst. The media duration is also pinned at 1800s, so the
   *   element never ends on its own.
   *
   * So: close the destination ourselves. That drives `endOfStream()`, the
   * element plays out its real buffered length, and `onended` fires for real.
   * Closing is safe here because this runs only after synthesis has drained,
   * and nothing may be enqueued afterwards.
   */
  private waitForQueuePlaybackEnd(
    playback: NonNullable<typeof this.queuePlayback>,
  ): Promise<void> {
    const destination = playback.speakerDestination;

    return new Promise<void>((resolve) => {
      let settled = false;
      const cleanups: Array<() => void> = [];

      const finish = () => {
        if (settled) return;
        settled = true;
        for (const cleanup of cleanups) cleanup();
        resolve();
      };

      destination.onAudioEnd = finish;

      try {
        destination.close();
      } catch {
        // A destination that will not close will never report an end either.
        finish();
        return;
      }

      const audio = destination.internalAudio as HTMLAudioElement | undefined;

      // Belt and braces around `onended`: if the element has already finished
      // by the time we look, or ends without the handler firing, this catches
      // it within a tick. It also catches the autoplay case — a document with
      // no sticky user activation rejects `play()` inside the SDK with no
      // `.catch`, leaving a paused element at time zero that will never end.
      let sawProgress = false;
      let ticksAtZero = 0;
      const poll = setInterval(() => {
        /**
         * Torn down under us by a barge-in.
         *
         * `stopSpeaking` mutes the element, resets `currentTime` to 0 and
         * blanks `src` — so `ended` stays false and `currentTime` stays 0,
         * while `sawProgress` is already true from before the interruption.
         * Neither exit below can fire, and the wait ran to its multi-second
         * ceiling holding `isSpeakingFlag` and the microphone with it.
         */
        if (this.queuePlayback !== playback) return finish();
        if (!audio) return;
        if (audio.ended) return finish();
        if (audio.currentTime > 0) {
          sawProgress = true;
          return;
        }
        /**
         * Three seconds at zero and not even trying: nothing is going to
         * play. Give up rather than hold the microphone shut.
         *
         * The grace period is the fix for replies cutting out after a
         * sentence. This used to fire on the *first* tick, and "paused at
         * zero, 500ms after close" is not a verdict — it is the normal state
         * of a destination whose first audio bytes are still in flight from
         * Azure. The interviewer model streams its reply in one burst, so
         * this wait now starts almost immediately after the first sentence
         * was enqueued; the false "did not start" then disposed the
         * destination — which hard-mutes the element — and auto-opened the
         * microphone over the rest of the reply.
         */
        ticksAtZero += 1;
        if (ticksAtZero >= 6 && !sawProgress && audio.paused) {
          this.reportPlaybackFailure(
            "Audio playback did not start. The browser may be blocking autoplay.",
          );
          finish();
        }
      }, 500);
      cleanups.push(() => clearInterval(poll));

      // Last resort, sized to the audio rather than a flat two minutes: Azure
      // neural voices run near 15 chars/second, so ~70ms per character plus
      // slack for network and buffering.
      const estimateMs = playback.queuedChars * 70 + 5_000;
      const ceiling = setTimeout(
        finish,
        Math.min(180_000, Math.max(8_000, estimateMs)),
      );
      cleanups.push(() => clearTimeout(ceiling));
    });
  }

  private disposeQueuePlayback(): void {
    // Settle whatever is mid-synthesis *before* tearing the synthesizer down;
    // the SDK will not call its callbacks once it is closed.
    this.abortActiveFeed?.();
    this.abortActiveFeed = null;

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
   * Curated set of voice options to surface in the setup wizard.
   *
   * The list itself lives in `@/lib/speech-voices` so callers that only need
   * the catalogue can read it without importing this module — and with it, the
   * Azure SDK. Kept here as a convenience for code that already holds a
   * service instance.
   */
  getAvailableVoices(): SpeechVoiceOption[] {
    return [...AZURE_VOICE_OPTIONS];
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
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
      details?: string;
    } | null;
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
