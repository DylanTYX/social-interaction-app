import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The streaming TTS queue.
 *
 * The bug these cover, as reported: "the AI sometimes does not narrate their
 * response, or it delays for a few minutes before reading it out, but the text
 * is on screen already."
 *
 * Both symptoms came from `waitForQueuePlaybackEnd`, which armed
 * `destination.onAudioEnd` and a 120-second safety timer. `onAudioEnd` is
 * unreachable unless something calls `close()` on the destination — the SDK
 * only fires it from `<audio>.onended`, which needs `MediaSource.endOfStream()`,
 * which needs `isClosed`. The queue deliberately keeps one destination alive
 * across a burst and never closed it, so the timer was the *only* exit. The
 * worker awaited that between every batch, so sentence two onwards was held for
 * two minutes, and the mic reopened two minutes after that.
 *
 * The SDK is faked here rather than mocked loosely: the fake reproduces the
 * `close()` → `onAudioEnd` contract, so a regression that stops calling
 * `close()` fails these tests the same way it failed in the browser.
 */

class FakeAudio {
  currentTime = 0;
  paused = false;
  ended = false;
  muted = false;
  src = "";

  // The dispose path silences the element before releasing it; without these
  // the teardown throws into stderr and drowns out real failures.
  pause() {
    this.paused = true;
  }
  load() {}
}

class FakeSpeakerAudioDestination {
  static last: FakeSpeakerAudioDestination | null = null;

  onAudioEnd: ((sender: unknown) => void) | undefined;
  internalAudio = new FakeAudio();
  closed = false;

  constructor() {
    FakeSpeakerAudioDestination.last = this;
  }

  /** Mirrors the SDK: only a close can ever lead to `onAudioEnd`. */
  close() {
    this.closed = true;
    this.internalAudio.ended = true;
    this.onAudioEnd?.(this);
  }

  pause() {}
}

/** Synthesis requests that the test settles by hand, to control ordering. */
const pendingSynthesis: Array<{ text: string; complete: () => void }> = [];

class FakeSpeechSynthesizer {
  speakTextAsync(text: string, onResult: (result: { reason: string }) => void) {
    pendingSynthesis.push({
      text,
      complete: () => onResult({ reason: "SynthesizingAudioCompleted" }),
    });
  }

  speakSsmlAsync(ssml: string, onResult: (result: { reason: string }) => void) {
    this.speakTextAsync(ssml, onResult);
  }

  close() {}
}

vi.mock("microsoft-cognitiveservices-speech-sdk", () => ({
  SpeechConfig: {
    fromAuthorizationToken: () => ({
      speechSynthesisVoiceName: "",
      speechRecognitionLanguage: "",
      speechSynthesisOutputFormat: 0,
      setProperty: () => {},
    }),
  },
  SpeechSynthesisOutputFormat: { Audio24Khz48KBitRateMonoMp3: 0 },
  PropertyId: {},
  SpeakerAudioDestination: FakeSpeakerAudioDestination,
  AudioConfig: { fromSpeakerOutput: () => ({ close: () => {} }) },
  SpeechSynthesizer: FakeSpeechSynthesizer,
  SpeechRecognizer: class {},
  ResultReason: { SynthesizingAudioCompleted: "SynthesizingAudioCompleted" },
  CancellationReason: { Error: "Error" },
  CancellationDetails: { fromResult: () => ({ reason: "Error" }) },
}));

const { SpeechService } = await import("@/lib/speech-service");

function service() {
  const instance = SpeechService.getInstance();
  instance.initialize({
    authorizationToken: "fake-token",
    region: "eastus",
    expiresAt: Date.now() + 600_000,
  });
  return instance;
}

/** Let queued microtasks run without advancing fake timers. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  pendingSynthesis.length = 0;
  FakeSpeakerAudioDestination.last = null;
});

afterEach(async () => {
  await service().stopSpeaking();
  vi.useRealTimers();
});

describe("streaming TTS queue", () => {
  it("feeds later sentences while the first is still playing", async () => {
    // The regression that produced the reported delay: the worker used to block
    // on playback between batches, so nothing after the first sentence was even
    // handed to Azure until the 120s timer fired.
    const speech = service();

    void speech.speakQueued("First sentence.");
    await flush();
    expect(pendingSynthesis).toHaveLength(1);

    void speech.speakQueued("Second sentence.");
    await flush();

    // Still only one in flight — synthesis is serial — but completing it must
    // immediately release the next, with no playback wait in between.
    pendingSynthesis[0].complete();
    await flush();

    expect(pendingSynthesis.map((item) => item.text)).toEqual([
      "First sentence.",
      "Second sentence.",
    ]);
  });

  it("resolves the playback wait as soon as audio ends, not on a timeout", async () => {
    const speech = service();

    void speech.speakQueued("Only sentence.");
    await flush();
    pendingSynthesis[0].complete();
    await flush();

    let resolved = false;
    const waiting = speech.waitForQueuedPlayback().then(() => {
      resolved = true;
    });

    await flush();
    await waiting;

    expect(resolved).toBe(true);
    // The whole point: the destination was closed, which is what makes
    // `onAudioEnd` reachable at all.
    expect(FakeSpeakerAudioDestination.last?.closed).toBe(true);
  });

  it("does not strand the worker when a stop lands mid-synthesis", async () => {
    // Closing a synthesizer does not invoke the pending request's callbacks, so
    // an un-abortable feed promise would leave `queueWorkerRunning` true for the
    // life of the page — after which the interviewer never speaks again.
    const speech = service();

    void speech.speakQueued("Interrupted sentence.");
    await flush();
    expect(pendingSynthesis).toHaveLength(1);

    // Barge-in: the candidate starts talking over the interviewer.
    await speech.stopSpeaking();
    await flush();

    expect(speech.isSpeaking()).toBe(false);

    // A later turn must still be able to speak.
    void speech.speakQueued("Next turn.");
    await flush();
    expect(pendingSynthesis.at(-1)?.text).toBe("Next turn.");
  });

  it("reports a failure instead of going silent when the token has lapsed", async () => {
    const speech = service();
    speech.initialize({
      authorizationToken: "expired",
      region: "eastus",
      expiresAt: Date.now() - 1,
    });

    const errors: string[] = [];
    speech.onPlaybackError((message) => errors.push(message));

    await speech.speakQueued("Nobody will hear this.");

    expect(errors).toHaveLength(1);
    expect(pendingSynthesis).toHaveLength(0);

    speech.onPlaybackError(null);
  });
});
