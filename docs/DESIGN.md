# Design guidelines

How ConvoTrainer looks and why. The landing page (`src/app/(marketing)/page.tsx`)
is the reference implementation; the rest of the app is to be brought in line
with it, screen by screen.

The one-sentence version: **product-led, one idea per section, one proof per
idea, and every colour answers a question.**

## Principles

1. **Show the product, don't describe it.** A mock of the real interface with
   real content beats a paragraph of adjectives. Feature cards with icons are
   out; interface mocks and real data are in.
2. **One idea per section, one proof per idea.** If a section needs a second
   heading to explain itself, it is two sections or too much.
3. **Honest copy.** Say what the product does, in the product's own terms. No
   outcomes it cannot promise ("get hired"), no business model that does not
   exist ("free in beta", "no credit card"), no borrowed startup phrasing.
   Numbers on the page are derived from code (`ROUND_TYPES.length`,
   `COMPETENCIES.length`), never typed.
4. **Hierarchy steps down.** One hero. Section headings are smaller than the
   hero, card titles smaller than section headings. Nothing lower on the page
   competes with the top.
5. **Nothing decorative.** No badge pills, sparkle icons, gradient text,
   numbered circles, blurred glows, or icon tiles. If an element does not carry
   information, it goes.

## Typography

| Role | Face | Weight | Tracking | Size |
|---|---|---|---|---|
| Page headline (h1) | Bricolage Grotesque (`font-display`) | 700 | −0.03em | `clamp(2.3rem, 4.6vw, 3.8rem)`, line-height 1.06, max 22ch, two lines |
| Section heading (h2) | `font-display` | 700 | −0.025em | `clamp(1.85rem, 3.1vw, 2.6rem)`, line-height 1.1, max 24ch |
| Card / story title (h3) | `font-display` | 600 | −0.01 to −0.02em | 1.1 to 2rem by context |
| Large numbers | `font-display` | 700 | −0.03em | Navy, `tabular-nums` |
| Section label (eyebrow) | Geist (`font-sans`) | 600 | normal | 13.5px, primary blue |
| Lede | Geist | 400 | normal | 18px, line-height 1.6, `text-slate-600`, max 54 to 58ch |
| Body | Geist | 400 | normal | 15 to 16px, line-height 1.55 to 1.65, `text-slate-600` |
| Small / meta | Geist | 400 to 500 | normal | 12.5 to 14.5px, `text-slate-500` |
| Code | Geist Mono (`font-mono`) | 400 | normal | Code only. Never for labels. |

Rules: headings get `text-balance`, paragraphs `text-pretty`. A headline
should sit on two lines, three at most, never with a single word on the last
line; if it does, reduce the size or widen the column, not the copy. Nav links
are nouns; buttons are verbs.

Fonts are loaded once in `src/app/layout.tsx` and exposed as `--font-display`,
`--font-sans`, `--font-mono` in `globals.css`.

## Colour

Every colour has one job. If a colour is on screen, a reader should be able to
say why.

| Colour | Token / classes | Used for | Never for |
|---|---|---|---|
| Blue (blue-600) | `primary`, `primary-subtle`, `primary-muted`, `primary-border`, `primary-emphasis` | Actions, links, section labels, the active nav link, anything the interviewer produces, the candidate's own messages, progress bars, the trend line | Decoration, backgrounds of whole sections |
| Navy | `navy` (`#0E1A3A`) | Large numbers, the wordmark, the closing band, the interviewer's avatar | Body text |
| Slate | `slate-900` text, `slate-600` body, `slate-500` meta, `slate-200` lines, `slate-100` inner lines, `slate-50` alternate section ground | The foundation | Anything that needs to be noticed |
| Round colours | `ROUND_TYPE_SPECS[type].accent` → `TILE_COLORS` (chip), `TILE_ACCENT` (solid edge) | Identifying a round type: the tag on a mock, the edge of a round card, a loop chain | Section colours, story colours, anything not a round |
| Green | `success`, `success-subtle`, `success-muted`, `success-emphasis` | A mark that means good, inside feedback only | Buttons, labels |
| Amber | `warning`, `warning-muted`, `warning-emphasis` | A mark that needs attention, inside feedback only | Buttons, labels |
| Red | `destructive` | Errors and destructive actions | Anything else |

Gradients: one, the hero stage, `from-primary-subtle to-indigo-50`, a soft
two-tone panel behind the product window with a faint dot grid. No other
gradients, no blurred colour glows, no gradient text.

## Layout

- Container `max-w-295` (1180px) with `px-6` gutters.
- **Centre for one focal thing; left edge for several things to read.** The
  hero, section heads above grids, and the closing action are centred. Lists,
  stories and two-column copy are left-aligned.
- Two-column sections are middle-aligned (`items-center`). If one side changes
  height on interaction, give it a fixed working height so the other side does
  not jump (see `TryQuestion`).
- The product is visible on arrival. No full-viewport hero; the hero is sized
  to its content and the top of the demo window shows before scrolling.
- Wide visuals go below the copy (top/bottom); tall visuals go beside it
  (left/right).
- Section rhythm `py-16 md:py-24 lg:py-28`. Backgrounds alternate white and
  `slate-50` so neighbouring sections never share a ground. The page closes
  with a full-bleed navy section that carries the footer; there is no
  separate footer.

## Components

- **Buttons.** The `Button` component. Primary is filled blue; secondary is
  `outline`; on navy use `bg-white text-navy`. Hero buttons are `h-11`. A
  primary button's arrow moves 2px right on hover.
- **Tags.** `inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold`
  with `TILE_COLORS[accent]` for rounds, `bg-warning-muted text-warning-emphasis`
  for a needs-attention mark.
- **Cards.** `rounded-[14px] border border-slate-200 bg-white shadow-soft`,
  hover `-translate-y-0.5 shadow-soft-md` with `ease-soft`. Round cards carry a
  4px left edge in `TILE_ACCENT[accent]`.
- **Interface mocks.** A white window with `rounded-[14px]`, `border-slate-200`,
  `shadow-soft-lg`, a header row with a round tag and a status chip, inner
  hairlines in `slate-100`, and real content. See `AnimatedDemo` and the report
  mock on the landing page.
- **Stats.** `StatCounter`: display-face number in navy, small label, `w-px`
  dividers between items, counting up on first view.
- **Header.** Three zones: brand left, page links centred as plain text with
  an active underline, account actions right as an outline plus filled pair.
  `MarketingNav` computes the active section on scroll, not with an observer.
- **Scoring bars.** `h-1.5` to `h-2`, `rounded-full`, track `slate-100`, fill
  `bg-primary`, score right-aligned and `tabular-nums`.

## Motion

- One easing: `ease-soft` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Colour and border transitions 150ms; hover lifts 200ms.
- Enter animations through `Reveal`; counts through `useCountUp`; the demo
  transcript types at 22ms per two characters.
- `prefers-reduced-motion` is honoured globally in `globals.css`; JS-driven
  motion checks `matchMedia` itself.
- No ambient motion. No floating shapes, no drifting backgrounds.

## Copy

- Headlines state what is different, not what the user will get.
- Nav labels are the same words as the section they land on.
- Eyebrow, heading, one lede. Bullets only where each one names something the
  visual beside it does not show.
- Fine print sits next to the button it de-risks, never floating on its own.

## Checklist before shipping a screen

- Could every colour on the screen be explained in one clause?
- Is there exactly one hero-scale element?
- Does any heading wrap to a lone word?
- Is anything decorative? Remove it.
- Are all numbers derived from code?
- Does it read the same at 400px wide?
