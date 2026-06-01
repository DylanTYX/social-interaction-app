import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export interface SpeechServiceConfig {
  subscriptionKey: string;
  region: string;
}

export interface TranscriptResult {
  interim: string;
  final: string;
  isFinal: boolean;
}

export class SpeechService {
  private static instance: SpeechService | null = null;
  private config: SpeechServiceConfig | null = null;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private synthesizer: SpeechSDK.SpeechSynthesizer | null = null;
  private audioConfig: SpeechSDK.AudioConfig | null = null;

  private constructor() {}

  static getInstance(): SpeechService {
    if (!SpeechService.instance) {
      SpeechService.instance = new SpeechService();
    }
    return SpeechService.instance;
  }

  initialize(config: SpeechServiceConfig): void {
    this.config = config;
  }

  isInitialized(): boolean {
    return (
      this.config !== null &&
      this.config.subscriptionKey !== "" &&
      this.config.region !== ""
    );
  }

  /**
   * Request microphone access and validate permissions
   */
  async requestMicrophoneAccess(): Promise<boolean> {
    try {
      if (!navigator || !navigator.mediaDevices) {
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
   * Start listening with real-time partial results
   */
  async startListening(
    onTranscript: (result: TranscriptResult) => void,
    onError: (error: string) => void,
  ): Promise<void> {
    if (!this.isInitialized()) {
      onError("Speech service not initialized. Missing Azure credentials.");
      return;
    }

    // Verify browser environment
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      onError("Speech recognition requires browser environment.");
      return;
    }

    if (!navigator.mediaDevices) {
      onError(
        "Microphone not available. Ensure: HTTPS is enabled, browser supports mediaDevices, OS permissions granted.",
      );
      return;
    }

    try {
      this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        this.config!.subscriptionKey,
        this.config!.region,
      );

      speechConfig.speechRecognitionLanguage = "en-US";

      this.recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        this.audioConfig,
      );

      let interimTranscript = "";

      this.recognizer.recognizing = (_sender, event) => {
        interimTranscript = event.result.text;
        onTranscript({
          interim: interimTranscript,
          final: "",
          isFinal: false,
        });
      };

      this.recognizer.recognized = (_sender, event) => {
        if (event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const finalTranscript = event.result.text;
          onTranscript({
            interim: "",
            final: finalTranscript,
            isFinal: true,
          });
        } else if (event.result.reason === SpeechSDK.ResultReason.NoMatch) {
          onError("Speech not recognized. Please try again.");
        } else if (event.result.reason === SpeechSDK.ResultReason.Canceled) {
          const cancellation = SpeechSDK.CancellationDetails.fromResult(
            event.result,
          );
          onError(
            `Error: ${cancellation.reason}. ${cancellation.errorDetails}`,
          );
        }
      };

      this.recognizer.startContinuousRecognitionAsync(
        () => {},
        (error) => {
          // Parse Azure SDK error for more specific feedback
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
   * Stop listening
   */
  async stopListening(): Promise<void> {
    if (this.recognizer) {
      await new Promise<void>((resolve) => {
        this.recognizer!.stopContinuousRecognitionAsync(
          () => {
            resolve();
          },
          (error) => {
            console.error("Error stopping recognition:", error);
            resolve();
          },
        );
      });
    }
  }

  /**
   * Clean up speech resources
   */
  cleanup(): void {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }

    if (this.audioConfig) {
      this.audioConfig.close();
      this.audioConfig = null;
    }

    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
  }

  /**
   * Synthesize text to speech
   */
  async speak(text: string, voiceUri?: string): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error(
        "Speech service not initialized. Missing Azure credentials.",
      );
    }

    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        this.config!.subscriptionKey,
        this.config!.region,
      );

      if (voiceUri) {
        speechConfig.speechSynthesisVoiceName = voiceUri;
      } else {
        speechConfig.speechSynthesisVoiceName = "en-US-AriaNeural";
      }

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
      this.synthesizer = new SpeechSDK.SpeechSynthesizer(
        speechConfig,
        audioConfig,
      );

      return new Promise((resolve, reject) => {
        this.synthesizer!.speakTextAsync(
          text,
          (result) => {
            if (
              result.reason ===
              SpeechSDK.ResultReason.SynthesizingAudioCompleted
            ) {
              resolve();
            } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
              const cancellation =
                SpeechSDK.CancellationDetails.fromResult(result);
              reject(
                new Error(
                  `Speech synthesis failed: ${cancellation.errorDetails}`,
                ),
              );
            }
          },
          (error) => {
            reject(new Error(`Speech synthesis error: ${error}`));
          },
        );
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Speech service error: ${errorMessage}`);
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): { name: string; uri: string }[] {
    return [
      { name: "Aria (US Female)", uri: "en-US-AriaNeural" },
      { name: "Guy (US Male)", uri: "en-US-GuyNeural" },
      { name: "Zira (US Female)", uri: "en-US-ZiraNeural" },
      { name: "Davis (US Male)", uri: "en-US-DavisNeural" },
      { name: "Jenny (US Female)", uri: "en-US-JennyNeural" },
    ];
  }
}

export function getSpeechService(): SpeechService {
  return SpeechService.getInstance();
}
