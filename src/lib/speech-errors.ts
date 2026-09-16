/**
 * Plain sentences for the speech SDK's own error text.
 *
 * The Azure Speech SDK reports failures in its own vocabulary, and the two
 * recorders showed that text verbatim: a candidate mid-answer read "Speech
 * recognition error: websocket error code: 1006", which names a WebSocket
 * close code and says nothing about what happened or what to do. The raw
 * detail is still worth having — it goes to the console and to
 * `/api/client-errors` — but it is not an instruction.
 *
 * Only failures with a distinct cause and a distinct response are rewritten.
 * Anything unrecognised is returned unchanged rather than flattened into
 * "something went wrong", which would hide the one clue an operator has.
 */

interface SpeechErrorRule {
  /** Matched against the lowercased raw text. */
  matches: (raw: string) => boolean;
  message: string;
}

const RULES: SpeechErrorRule[] = [
  {
    // 1006 is an abnormal WebSocket close: the connection to the speech
    // service dropped without a closing handshake. In practice that is the
    // network — a dropped wifi frame, a sleeping laptop, a proxy cutting an
    // idle socket — not anything the candidate did.
    matches: (raw) => raw.includes("1006") || raw.includes("websocket error"),
    message:
      "The connection to the speech service dropped. Check your internet, then tap the microphone to carry on.",
  },
  {
    matches: (raw) =>
      raw.includes("authentication") ||
      raw.includes("401") ||
      raw.includes("403") ||
      raw.includes("forbidden"),
    message:
      "Your microphone session was refused by the speech service. Reload the page to get a new one.",
  },
  {
    matches: (raw) => raw.includes("notallowederror") || raw.includes("denied"),
    message:
      "Your browser is blocking the microphone. Allow access in the address bar, then tap to answer.",
  },
  {
    matches: (raw) => raw.includes("notfounderror"),
    message:
      "No microphone was found. Connect one, then tap the microphone to try again.",
  },
  {
    matches: (raw) =>
      raw.includes("notreadableerror") || raw.includes("in use"),
    message:
      "Another app is using your microphone. Close it, then tap the microphone to try again.",
  },
];

/**
 * What to show a candidate for a speech failure. Returns the original text
 * when nothing matches, so an unexpected failure still says something.
 */
export function describeSpeechError(raw: string | null): string | null {
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  return RULES.find((rule) => rule.matches(lowered))?.message ?? raw;
}
