/**
 * The app's motion vocabulary, as class strings.
 *
 * These are constants rather than a component or a plugin because the
 * animations they name are pure CSS — `tw-animate-css` was already installed
 * and, until now, used only by the four Radix overlay wrappers. Naming the
 * combinations here keeps eight list pages from each inventing their own
 * timing, which is exactly how the hand-rolled skeletons drifted apart.
 *
 * Everything here is inert under `prefers-reduced-motion`: `globals.css`
 * collapses animation and transition durations globally, so no call site needs
 * a `motion-reduce:` variant.
 */

/**
 * For a region that has just resolved from loading, error, or empty into real
 * content. Short and mostly opacity — this fires on data arriving, which is
 * frequent, so it should register as "settled" rather than as an event.
 */
export const CONTENT_ENTER =
  "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-soft";

/**
 * For one row or card entering a list. Travels slightly further than
 * `CONTENT_ENTER` because rows are staggered, and the offset is what makes the
 * stagger legible.
 *
 * `fill-mode-both` is not optional here: staggering means a non-zero
 * `animation-delay`, and tw-animate-css leaves `animation-fill-mode` at `none`,
 * so a delayed element would paint its final state, snap back to the
 * animation's first frame, and then play. Every delayed animation in this
 * codebase needs it.
 */
export const ROW_ENTER =
  "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-soft fill-mode-both";

/**
 * For a row on its way out.
 *
 * React unmounts a removed row immediately, so CSS alone cannot animate one
 * out. The pattern these pages use instead: mark the row as leaving the instant
 * the user confirms, fire the request, and let the row unmount when the request
 * resolves. The fade therefore overlaps time that was being spent anyway and
 * adds nothing to how long a delete takes.
 *
 * It deliberately does *not* hold the list open for a fixed duration. An
 * earlier version did, to guarantee the animation was always seen in full, and
 * that was the wrong trade twice over — it made a fast delete slower for no
 * functional reason, and on the pages whose hooks drop the row from state as
 * soon as the request resolves it did not even work. If the server answers in
 * 40ms the row leaves in 40ms, partway through its fade. Fast is better than
 * pretty.
 *
 * 150ms rather than 200: short enough that a typical round trip outlasts it, so
 * in practice the fade usually does complete.
 */
export const ROW_EXIT =
  "pointer-events-none scale-[0.98] opacity-0 transition-all duration-150 ease-soft";

/**
 * Per-row delay for a staggered list entrance.
 *
 * Capped deliberately. An uncapped `index * step` looks considered for six
 * rows and broken for sixty — the sessions list pages in batches of 25, so the
 * last row of a second batch would sit blank for a full second while the
 * cascade crawled towards it. Past the cap every remaining row shares the
 * final delay and arrives together, which reads as one group rather than as a
 * stalled animation.
 */
export function staggerDelay(index: number, stepMs = 40, maxSteps = 8) {
  return { animationDelay: `${Math.min(index, maxSteps) * stepMs}ms` };
}
