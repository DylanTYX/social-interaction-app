"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the newest transcript entry in view, on both the text and voice
 * screens.
 *
 * Both pages previously ran `scrollIntoView({ behavior: "smooth" })` with the
 * whole `messages` array as the dependency. Streaming appends a token to the
 * last message once per SSE chunk, so that fired dozens of times per reply —
 * and each call restarted a smooth scroll the previous call had not finished,
 * which is why the transcript crawled and juddered while a reply came in
 * rather than tracking it.
 *
 * The distinction that fixes it: a *new* message is an event worth animating
 * to, while a message *growing* is continuous and should simply be followed.
 * So the scroll is smooth when the count changes and instant otherwise. Under
 * `prefers-reduced-motion` the smooth case degrades to a jump, which is the
 * correct behaviour and comes free from the global rule in globals.css.
 *
 * Returns the ref to attach to a sentinel element at the end of the list.
 */
export function useTranscriptAutoscroll(messages: ReadonlyArray<unknown>) {
  const endRef = useRef<HTMLDivElement>(null);
  const previousCountRef = useRef(0);

  const count = messages.length;
  // Length of the last message's rendered text, so appended tokens re-run the
  // effect without the whole array having to be a dependency.
  const last = messages[count - 1];
  const lastLength =
    last && typeof last === "object" && "content" in last
      ? String((last as { content: unknown }).content ?? "").length
      : 0;

  useEffect(() => {
    const isNewMessage = count !== previousCountRef.current;
    previousCountRef.current = count;
    endRef.current?.scrollIntoView({
      behavior: isNewMessage ? "smooth" : "auto",
    });
  }, [count, lastLength]);

  return endRef;
}
