# Design guidelines

How ConvoTrainer looks and why. One system covers the landing page, the sign-in
and create-account screens, and every page inside the app. The landing page
(`src/app/(marketing)/page.tsx`) and the dashboard home
(`src/app/dashboard/page.tsx`) are the two reference implementations.

The one-sentence version: **show the product, one idea per section, and every
colour answers a question.**

## Principles

1. **Show the product, don't describe it.** A mock of the real interface with
   real content beats a paragraph of adjectives. Inside the app, the data is
   the content; nothing decorates it.
2. **One idea per section, one proof per idea.** If a section needs a second
   heading to explain itself, it is two sections or too much.
3. **Honest copy.** Say what the product does, in its own terms. No outcomes it
   cannot promise ("get hired"), no business model that does not exist ("free
   in beta", "no credit card"), no borrowed startup phrasing. Counts shown on a
   page are derived from code (`ROUND_TYPES.length`, `COMPETENCIES.length`),
   never typed.
4. **Hierarchy steps down.** One top-level heading per screen. Section headings
   are smaller, card titles smaller again. Nothing lower competes with the top.
5. **Nothing decorative.** No badge pills with sparkles, gradient text, glows,
   numbered circles, blurred colour blobs, or icon tiles. If an element carries
   no information, it goes.

## Typography

| Role | Face | Weight | Size |
|---|---|---|---|
| Landing headline | Bricolage Grotesque (`font-display`) | 700 | `clamp(2.3rem, 4.6vw, 3.8rem)`, tracking −0.03em, two lines |
| Landing section heading | `font-display` | 700 | `clamp(1.85rem, 3.1vw, 2.6rem)`, `tracking-tight` |
| App page title | `font-display` | 700 | `text-3xl`, `tracking-tight` (`PageHeader`) |
| Auth page title | `font-display` | 700 | `text-3xl`, `tracking-tight` |
| App section heading | `font-display` | 600 | `text-xl`, `tracking-tight` (`SectionHeader`) |
| Card and dialog title | `font-display` | 600 | `text-lg` on app pages; built into `CardTitle` and `DialogTitle` |
| Large number | `font-display` | 700 | Navy, `tabular-nums`: stats and scores |
| Landing eyebrow | Geist (`font-sans`) | 600 | 13.5px, primary blue, sentence case |
| Panel label | Geist | 600 | `text-xs uppercase tracking-wide text-slate-500` (`PANEL_LABEL`) |
| Lede / description | Geist | 400 | 16–18px, `text-slate-600`, max ~60ch |
| Body | Geist | 400 | 14–16px, `text-slate-600` |
| Meta | Geist | 400–500 | 12–13.5px, `text-slate-500` |
| Code | Geist Mono (`font-mono`) | 400 | Code only |

Rules:
- Headings get `text-balance`; paragraphs `text-pretty`.
- A headline never leaves one word on its last line. Fix the size or the column, not the copy.
- **Two kinds of small label, never mixed.** An *eyebrow* sits above a landing-page heading and is sentence case in blue. A *panel label* names something inside a card, like a column, a group or a readout, and is small uppercase in slate. App page headers have neither.
- **Sentence case everywhere**: titles, buttons, menu items, dialog titles, select options. "Get feedback", not "Get Feedback".

Fonts are loaded once in `src/app/layout.tsx` and exposed as `--font-display`,
`--font-sans` and `--font-mono` in `globals.css`.

## Colour

Every colour has one job. If a colour is on screen, a reader should be able to
say why.

| Colour | Tokens / classes | Used for | Never for |
|---|---|---|---|
| Blue (blue-600) | `primary`, `primary-subtle`, `primary-muted`, `primary-border`, `primary-emphasis` | Actions, links, focus rings, the landing header's active link, landing eyebrows, the candidate's own messages, scoring bars and chart lines, the one primary card on a page | Decoration, whole-section backgrounds |
| Navy | `navy` (`#0E1A3A`) | Large numbers, the wordmark, your own avatar, the landing closing section, the auth brand panel, the app sidebar | Body text, cards, page backgrounds |
| Slate | `slate-900` text, `slate-600` body, `slate-500` meta, `slate-200` borders, `slate-100` inner hairlines, `slate-50` row hover and inset panels | The foundation, and user-made labels such as session tags | Anything that must be noticed |
| Identity colours | Seven hues in `lib/tile-colors.ts`. Rounds: `ROUND_TYPE_SPECS[type].accent`. People: `tileColorForKey(name)` | Telling identities apart. A **round** is a tinted chip (`TILE_COLORS`) or a solid card edge (`TILE_ACCENT`). A **person** is a solid circle (`TILE_ACCENT`, white initials). Shape says which kind of thing; hue says which one | Pages, features, chart series, statuses, user-made tags, icons |
| Green | `success-*` | Good: a strong mark, a completed session, a goal met, an improvement | Buttons, headings |
| Amber | `warning-*` | Needs attention: a weak mark, an unfinished session, a regression, a blind spot | Buttons, headings |
| Red | `destructive-*` | Errors and destructive actions only | A bad score or a regression; those are amber |

Gradients: one, the landing hero stage (`from-primary-subtle to-indigo-50`)
behind the product window. No other gradients anywhere, inside the app or out.

## Icons

- **Functional icons only**, at text size, beside the words they clarify: nav items, buttons, inline metadata such as a microphone for a voice session, menu items.
- **No icon tiles.** An icon in a tinted square beside a heading carries nothing the heading does not.
- **No sparkles.** The action icon for creating something is `Plus`.
- An error state keeps its warning icon without a tile, because there it carries meaning.
- Buttons already space their icons (`gap-2`); never add `mr-2` to an icon inside a `Button`.

## Vocabulary

One name per thing, everywhere it appears: sidebar, mobile bar, command
palette, page title, button and docs.

| Thing | Name | Not |
|---|---|---|
| Starting one | **New interview** (page actions, sidebar, mobile bar, palette, setup page title) | New session, Start a session, Practice, Interview setup |
| A recommended or resumed one | **Start interview**, **Resume interview**, **Open last attempt** (dashboard home and Analytics) | |
| Landing and closing CTA | **Start a mock interview** | Get started |
| The saved record | **Session** | |
| Account | **Sign in**, **Create account**, **Sign out** | Log in, Sign up, Get started, Start free |
| Pages | Dashboard, Quick drills, Sessions, Analytics; Library: Personas, Job descriptions, Resumes; then Tips & guides, Settings | Home, Stats, Insights, History |

## Layout

- **Centre for one focal thing; left edge for several things to read.** The landing hero, section heads above grids and the closing action are centred. Lists, stories, app pages and forms are left-aligned.
- Two-column sections are middle-aligned. If one side changes height on interaction, give it a fixed working height so the other side does not jump.
- The landing hero is sized to its content, so the top of the product shows before scrolling.
- Wide visuals go below the copy; tall visuals go beside it.

## Landing page

- Container `max-w-295` (1180px), `px-6`.
- Section rhythm `py-16 md:py-24 lg:py-28`. Backgrounds alternate white and `slate-50`. The page closes with a full-bleed navy section that carries the footer.
- **Header.** Three zones: wordmark left; page links centred as plain text with a blue active underline; account actions right. "Sign in" is a ghost button and "Create account" the filled one, so the two doors are named and weighted differently. `MarketingNav` computes the active section on scroll.
- **Interface mocks.** White window, `rounded-[14px]`, `border-slate-200`, `shadow-soft-lg`, a header row with a round tag and a status chip, `slate-100` hairlines, real content. See `AnimatedDemo`.

## App screens

### Shell
- **Sidebar.** Navy, the same surface as the sign-in panel, and the only dark surface in the app. It is drawn for a dark ground: hairlines `white/10`; the wordmark white with "Trainer" in `blue-300`, as on the sign-in panel, and "CT" when collapsed; a filled "New interview" button, then search on `white/5`, then destinations in `slate-300` with `slate-400` icons. The active item is `bg-white/10 text-white` with a `blue-300` icon, no border or shadow. Your avatar at the bottom inverts to white with navy initials, because navy on navy would vanish.
- **Sidebar order.** Two groups. The app itself, unlabelled: Dashboard, Quick drills, Sessions, Analytics. Then the material you prepare, under a "Library" panel label: Personas, Job descriptions, Resumes. Collapsed, a `white/10` hairline replaces the label. Tips & guides and Settings sit at the bottom. The command palette lists pages in the same order.
- **Mobile bar.** Stays white. A navy bar across the bottom of a phone would outweigh the screen it serves.
- **Mobile bar destinations.** Dashboard, Sessions, New interview (`Plus`), Analytics, and More. More opens upward as a menu listing what the bar could not hold, in the sidebar's order — Quick drills, Personas, Job descriptions, Resumes, Tips & guides, Settings — then Search, which opens the command palette. It is the only way onto those pages from a phone: the sidebar is not drawn below `lg`, and ⌘K has no touch equivalent.
- **Dashboard tour.** A spotlight with a 2px white outline inside a 2px blue one, so it reads on the white page and on the navy sidebar alike. The tooltip sits beside a sidebar target and below or above a page target, with a step count, Skip tour, Back and Next. Page steps come first, top to bottom, then the sidebar. It runs once after the goal picker and again from Take the tour in Tips & guides or the palette.
- **Settings.** One page, no tabs. Usage sits between security and your data: two figures, a period picker, and a hairline table of what the tokens bought. Each section is a heading and one line on the left with its card on the right, stacked below `lg`, with a `slate-200` hairline between sections. A card is a list of rows: a title, a line saying what happens, and one outline button. Save is the only filled button and stays disabled until something changes. A read-only value is shown as text, not as a disabled field. Delete sessions sits last, in a card with a `destructive-border`. `?section=` scrolls to a section.
- **Tips & guides.** How this app judges an answer, not general interview advice. Five sections with headings outside their cards, in the order you meet them: How practice works (four numbered steps in a hairline grid), What each round is scored on (underline tabs per round type: the scored criteria as chips, the shape of a strong answer, what scores well beside what costs marks, and for Behavioral and Technical SWE the report's own advice per part), Back up every claim (the wording that draws a follow-up, the report's reading in amber, what to say instead), Speaking out loud, and Getting better over time. Every threshold and reading is imported from the code that applies it.
- **Command palette** (⌘K or /). The sidebar you can type into: the same groups, headed Start, Go to, Library, and Help and settings, with rows named as the sidebar names them. Anchored near the top of the screen so the search field does not move as results filter. The highlighted row is `bg-primary-subtle` with an enter key cap; a footer names the keys. Key caps share one style everywhere.
- **Page ground** white, set once by `AppShell`. Pages never paint their own background. The navy sidebar is the shell's contrast; cards separate from the page by their border and soft shadow, not by a grey ground.

### Phones
Checked at 360px and 390px on every screen, by rendering each page under
mobile emulation and measuring: nothing may extend past the viewport or
scroll `main` sideways, and the page must still read. The rules that came out
of it:
- **Heights are `dvh`, never `vh`.** `100vh` on a phone is the height behind the browser bar; a `h-screen` shell ran under it and its bottom was unreachable. The shell, the live interview and the loading screens use `h-dvh`.
- **Every grid names its columns at the base size** (`grid-cols-1` before any `sm:`/`lg:` variant). An implicit `auto` column grows to its widest child's minimum width, and one `truncate` title — which is `nowrap` — made the dashboard 65px wider than the screen.
- **A dialog never overrides the mobile clamp.** `DialogContent` is `max-w-[calc(100%-2rem)]` first; wider sizes are `sm:max-w-*`. An unprefixed `max-w-3xl` produced a 768px dialog on a 360px phone.
- **Charts are drawn at the width they occupy**, not scaled from a fixed viewBox: a 760-unit chart on a 312px screen shrank its labels to 4px. See `useElementWidth`.
- **Rows give the title the width.** In lists, the score or status joins the meta line below `sm` rather than taking a column; icon actions sit in one tight group; the checkbox and menu gutters narrow.
- **One column where two cannot fit the words**: persona dials, and radar and bar labels allowed to wrap or overflow the drawing. A usage row becomes a title over one meta line — "89 calls · 186,000 tokens · $0.031" — the way every other row in the app reads; the four-column grid returns from `sm`.
- **Filters tile.** Below `sm` a toolbar's selects are two to a row and fill it, the sort control among them; an odd last one takes the whole row. A sort pushed right with `ml-auto` sat alone on a third row looking dropped. A filter with one option is not drawn at all — one company made a dropdown that could only show what was already on screen.
- **A card's action goes under its title** below `sm` (`CardAction` takes its own row). Beside the title it left "Pick an interviewer" a column ninety pixels wide.
- **The wizard's Continue and Back are `fixed`** on the mobile bar below `lg`, never `sticky`: sticky inside the `dvh` scroll container drifted up the screen as a phone browser's toolbar collapsed. The container pads its bottom so the last field clears the bar.
- **A tab strip scrolls in one row** on a phone, bleeding to the screen edge so the cut-off tab says there are more; wrapping six tabs into three rows read as a list. From `sm` it wraps.
- **Menus and selects keep 12px from the screen edge** (`collisionPadding`, set once in the primitives). A dialog's options are `whitespace-normal`: a `Button` is `nowrap` by default, and a two-line option that cannot wrap is as wide as its longest line.

### Page frame
- **`PageContainer`.** Every app page body: `max-w-295`, `p-6 lg:p-8`, `space-y-8`. No page sets its own width or gutter.
- **`PageHeader`.** Title, one-line description, actions. The title names the page as the sidebar does. The dashboard home greets you by name instead, because it is the page you land on rather than choose. No eyebrow, no icon tile.
- **One primary button per header.** It is a filled "New interview" with `Plus` on every page where starting an interview makes sense. Actions in a toolbar below the header are `outline`.
- **`SectionHeader`.** A group heading within a page, with an optional blue text link to the page that owns the data ("View analytics →"). Section headings sit outside their cards.

### Content
- **Cards.** `Card`: `rounded-xl`, `border`, `shadow-soft`, white. Do not add `shadow-soft` or border colours per page; the primitive has them. Use a card to separate objects, not to wrap every block. Group related blocks inside one card with `divide-y divide-slate-100` rather than nesting tinted panels.
- **Stat tiles.** `StatTile`: label, a large navy number and a caption. The same component on the dashboard home and Analytics.
- **Lists and rows.** A row is `rounded-xl border border-slate-200 bg-white p-3` or `p-4`, with a `slate-50` hover. A selected row is `border-primary-border bg-primary-subtle`. Rows never lead with an icon tile; a person leads with their identity-coloured `InitialsAvatar`. A score on a row is a large number.
- **Document input.** `DocumentInput`: one box that is a text area, a PDF drop target and, in its footer, the upload and save buttons. There is no paste-or-upload mode to choose first. Used for job descriptions and resumes in the library and the wizard.
- **Buttons by job.** Filled for the one primary action in view. Outline for other actions that do something on this screen, such as Add round or Add a job description. Ghost for quiet actions inside rows and toolbars. A text link, with an arrow when it leaves the page, for going somewhere else, such as Manage in library or View all. A link inside a sentence for switching mode, as in Quick drills. Never a bare icon for an action that needs a word.
- **Tags and badges.** One shape, `rounded-md`, `h-6`, `text-xs`. A round's tag uses its `TILE_COLORS`. A status uses the `Badge` `success`, `warning` or `outline` variants. A user-made tag is neutral slate.
- **Empty states.** `EmptyStateCard`: a dashed box with a title, a description and up to two actions, with no icon. It is a box rather than a card, so it nests inside a card.
- **Error states.** `ErrorStateCard`: the same shape in `destructive` colours, with a warning icon and a retry.
- **A dropped request is not a wall.** A request that fails below HTTP — the browser's "Failed to fetch" — is retried once by `fetchWithRetry`, and what the user reads is "Couldn't reach the server. Check your connection and try again", never the browser's phrasing. A card that blocks a whole screen offers Try again before it offers a way back.
- **Charts.** Drawn in theme colours through `currentColor` with `text-primary`: the line, area and points in blue, the grid in `slate-100`, labels in `slate-400`. Each series has its own labelled panel instead of its own colour. A trend is not drawn below four points.
- **Tables.** Column heads use the panel label. Rows are separated by `slate-100` hairlines. Numbers are `tabular-nums`.
- **Sessions list.** One card holding one list: a heading row of panel labels (Session, Mode, Date, Score), hairline rows, and a footer with the count and "Load more". A row leads with the interviewer's avatar; the score column shows the score, and a badge only for the exceptions, In progress in amber and Abandoned in outline. Ticking a row turns the heading row into the action bar, so nothing below moves. Active and Archived are underline tabs above the controls; search, filters and sort sit on the page, not in a card.
- **Analytics.** Scores are compared only within a round type, because each has its own rubric. Order: three headline tiles; Progress by round type, as underline tabs over three full-width cards (score over time, the rubric as a radar beside its list, what answers lacked beside the AI's latest notes); Voice delivery; the tinted What to practise next card; a Not tracked here note. Side-by-side content lives inside one card so heights match by construction, never two cards stretched to each other. A chart point's shape shows interviewer difficulty: hollow supportive, filled balanced, diamond demanding. The radar's dashed outline is the older half of your answers. Every card states what its data says in one sentence and nothing it cannot support: a direction or a change needs eight, a chart four, a named weakest part four answers with a clear lowest. The weakest rubric part is amber; everything else is blue. The rules live in `lib/progress-insights.ts`, with tests.
- **Forms.** `Input` and `Textarea` focus with `border-primary` and a `ring-primary-muted` ring, the same on every field. Never override focus per page. Inline errors sit in a `rounded-lg` `destructive-subtle` box; confirmations in a `success-subtle` box.
- **Dialogs.** `DialogTitle` is in the display face. A destructive confirm uses `Button variant="destructive"`.

### Setup wizard
- **Voice first.** New setups are voice interviews. Step one opens with "How you'll answer" as two radio rows, voice first and marked Recommended; a saved text choice and `?mode=text` are respected. Every entry point that offers both lists voice first.
- **Four steps, named Brief, Rounds, Interviewer, Ready**, in a full-width stepper of four equal columns: a `h-1` bar on each, blue for steps reached and `slate-200` for steps ahead, with the number and name below. The current name is `slate-900` semibold with its number in blue. Reached steps can be clicked to go back. No numbered circles, and nothing turns green.
- **The summary beside every step.** A `20rem` "Your interview" panel, sticky on large screens, shows the mode, questions and minutes, brief, rounds as their tags with the break between them, the interviewer with their difficulty band, the documents and, for voice, the microphone. It holds Continue or Start interview and Back, with the reason when a step is incomplete in amber. On the last step one line above Start says what to expect: each answer is scored and shapes the next question, and a full report follows. Below `lg` it follows the step, and Continue and Back move into a bar pinned above the mobile bar (`sticky`, so it scrolls with the page and settles into the flow at the end) — the summary under a long form put the primary action a screen or two away. There is no separate review summary.
- **Round cards.** Type and length on one row, focus and title on the next, the code editor switch where it applies, and "What this round is like" folded at the bottom.
- **Ready.** Only what you act on: for voice, the microphone status with a status icon at text size, then the voice toggles; for text, one line offers switching to voice. Then the in-interview toggles. No reading-only cards. The microphone has no button of its own: Start interview checks it, and a failed check offers a text interview.
- **Documents.** Choosing and adding happen in the wizard; editing and deleting stay in the library. Adding is a labelled outline button under the list, never a bare icon.

### Live interview
- One header: the mode as the `h1` ("Text interview" or "Voice interview"), then `scenario · persona` in one line, the question count as an outline badge, the job chip, a settings icon button and "End interview" as `outline`. No second band of badges.
- **A voice interview prints nothing to read from.** The interviewer's words are withheld by default: the bubble says "Asked out loud" and offers to show them, and the header carries one Show transcript / Hide transcript button. Your own answers always show, since reading back what was heard is how you check the microphone. The text reveals itself when playback fails and whenever the interviewer's voice is switched off, because there is then nothing else to go on. See DESIGN-DECISIONS §16.
- The transcript sits on the `slate-50` ground; the composer is a white `border-t` strip. Bubbles are `rounded-xl` with no shadow. The interviewer's avatar is their identity colour; yours is navy.
- The coaching rail is one bordered white panel: a 2×2 hairline grid of measures drawn in blue, then a `divide-y` list of notes. A note's mark is green for good, amber for needs attention, slate for a focus. It is drawn from `xl` only, deliberately: on a phone the screen is the transcript and the recorder, and coaching mid-answer would compete with answering. Everything the rail shows is in the report.
- Below `sm` the header keeps its one 64px line: the title truncates, the question badge, job chip and transcript switch fold into the settings menu, and End interview reads "End".
- **The spoken answer surface is one recorder**, the same in an interview and in a drill: a bordered panel whose top row is the round button, what is happening now with what ends the answer, and the clock as a large `tabular-nums` figure; under it the transcript at reading size, with recognised words dark and words still being recognised light. Recording marks the panel the way focus marks a field, `border-primary` with a `ring-primary-muted` ring, never red. A speech failure is amber and says what to do, not the SDK's own words.
- **States in the transcript, by weight.** A failure the app is retrying is a quiet slate line with a spinner, not a red card; the red `destructive` card is only for a failure that stands after the retries. The blocked-audio card is amber: no request failed, but every browser refuses to play sound before you interact with the page, and the interview waits there until you tap.
- Loading is a spinner with one line ("Preparing your interview…", "Maya is thinking…", "Coach is reviewing your answer…"). A failed bootstrap is an `ErrorStateCard`; a failed send is an inline `destructive-subtle` box above the composer.
- Ending is a dialog titled "End this interview?" with "Keep going" and "End interview".

### Quick drills
- One question card: a toolbar with the topic menu and "New question", the question as an `h2` in the display face, then the answer surface. Speaking is the default; the other mode is one text link under the surface, not a segmented toggle.
- **Recorder** (`DrillSpeakInput`). One row: a 56px round blue button, a title and a hint stating the rules from the constants that enforce them, and the clock. Below, the transcript at reading size on `slate-50`: recognised words dark, words still being recognised light, and the sent answer kept on screen. The open microphone is marked like a focused field, with `border-primary` and a `ring-primary-muted` ring. Recording is never red, here or in the interview.
- **Typed answer.** One box like `DocumentInput`: the text area, and a footer with the word count and "Get feedback". Its resting height matches the recorder, so switching modes does not move the page.
- **Delivery** (`DeliveryReadout`). Pace, filler words, pauses to think and speaking time in the rail's hairline grid, each a navy number with a caption. A green or amber mark appears only where the code makes a judgement — pace and fillers have one, pauses and speaking time never do, because they are reported and not scored.
- The coaching card appears only after an answer. Its footer holds "Revise this answer" and a filled "Next question".

### Report
- The session title is the `h1` (`EditableTitle`, display face), with the facts line under it. "Practise again" is the one filled button; pin, print and share sit in a menu.
- The overall score is a large navy display number in a full-width card; the three measures beside it are `StatTile`s. No icon tiles.
- A per-answer score is a `success` badge at 75 and above and a `warning` badge below. There is no red band. A drop since last time is amber, never red.
- The round progression chart is blue like every chart. The only tinted card is the "Start next round" card, because it holds the one action that moves the loop on.
- Transcript bubbles match the live interview. Coaching under an answer opens below a hairline, not in an amber box.
- The loop report uses the same frame, tiles and round tags, inside `AppShell`.

### Sign in and create account
- Large screens split in two. The left is a navy brand panel with two things only: the wordmark at the top and the landing headline anchored at the bottom. No lede, mock or footer; the visitor has already read the pitch, and the form is the only thing with a job. The right is the form on white, with no card.
- Small screens show the form only, with the wordmark above it and "Back to home" at the top.
- The form title is in the display face ("Sign in" or "Create account"). The link to the other form uses the same words.

## Motion

- One easing: `ease-soft` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Colour and border transitions 150ms; hover lifts 200ms.
- Landing sections enter through `Reveal`; app lists through `CONTENT_ENTER`, `ROW_ENTER` and `staggerDelay` in `lib/motion.ts`; numbers count through `useCountUp`.
- `prefers-reduced-motion` is honoured globally in `globals.css`; JS-driven motion checks `matchMedia` itself.
- No ambient motion.

## Copy

- Headlines state what is different, not what the user will get.
- A nav label is the same word as the page or section it lands on.
- Fine print sits next to the button it de-risks, never floating on its own.
- Describe the state, do not issue instructions the screen cannot fulfil.
- British spelling in every string a user reads: practise (verb), customise, behavioural, colour, summarise. Code identifiers keep whatever they have.
- A pending button keeps its verb and gains a real ellipsis: "Saving…", "Deleting…", "Signing in…". Never three full stops. Placeholders end the same way.

## Checklist before shipping a screen

- Can every colour on the screen be explained in one clause from the colour table?
- Is there exactly one top-level heading, and does every heading use the display face?
- Is the page inside `PageContainer` with a `PageHeader`?
- Does any heading wrap to a lone word?
- Is there an icon tile, a sparkle, a gradient or a glow? Remove it.
- Is every label sentence case, and every name the one in the vocabulary table?
- Are all counts derived from code?
- Does it read the same at 400px wide?
