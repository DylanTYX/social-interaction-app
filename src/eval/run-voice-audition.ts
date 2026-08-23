/**
 * Accent audition harness. Decides which nationality→voice mappings are real.
 *
 *   npm run eval:voices                  # offline: what is mapped, what is unverified
 *   npm run eval:voices -- --list        # refresh the region's voice catalogue (free)
 *   npm run eval:voices -- --live        # synthesise a clip per candidate voice
 *   npm run eval:voices -- --live --stt  # + speech-to-text round trip
 *   npm run eval:voices -- --serve       # listen in a browser (recommended)
 *   npm run eval:voices -- --play        # listen in the terminal
 *   npm run eval:voices -- --live --only=Chinese,Japanese
 *
 * ## Why this exists
 *
 * Azure has real `en-XX` voices for fourteen locales, and those need no
 * checking — an `en-IN` voice speaking with an Indian accent is what the voice
 * *is*. It has no `en-CN`, `en-JP`, `en-SE` or `en-ES`. So a Chinese or Swedish
 * accent means pointing a `zh-CN` or `sv-SE` voice at English text, and that
 * has three possible outcomes, only one of which is the feature working:
 *
 *   1. intelligible English with a recognisable accent      — ship it
 *   2. near-native English with no accent                   — pointless
 *   3. Latin script read through native phonetics, mangled  — actively bad
 *
 * Nothing in Azure's documentation says which you get. So: synthesise, listen,
 * record. Every mapping in `speech-voices.ts` ships `verified: false` until a
 * human has heard it, and `persona-voice.test.ts` enforces that an unverified
 * voice never reaches a user.
 *
 * ## What is automated, and what is not
 *
 * **Only a person can decide any of the three.** The automation sorts the queue.
 *
 * Outcome 2 is the one thing catchable without listening, and it comes from
 * catalogue metadata rather than audio: Azure's `*MultilingualNeural` and
 * `*:DragonHDLatestNeural` variants advertise 100+ secondary locales and are
 * engineered to sound near-native in each. They are excluded from
 * `ACCENT_VOICES` and asserted against in the tests.
 *
 * `--stt` adds a rough signal for outcome 3: synthesise, recognise the audio
 * back with an `en-US` recogniser, and compare to the source. It is worth
 * having and worth distrusting. A recogniser has no context and no top-down
 * repair, so it fails on audio a person follows without effort — a high WER
 * means "the recogniser struggled", which is weaker than "a candidate would
 * struggle". It is also Azure scoring Azure, which is a closed loop.
 *
 * So WER ranks the listening order and nothing else. It cannot separate outcome
 * 1 from outcome 2 at the low end, and at the high end it over-reports
 * difficulty. Every mapping is decided by ear; `--play` and `--page` exist to
 * make that cheap.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { ACCENT_VOICES, type AccentVoice } from "@/lib/speech-voices";
import { localeForNationality } from "@/lib/persona-voice";
import { NATIONALITY_POOL } from "@/lib/persona-library";

/**
 * One sentence, every voice. Identical text is what makes the comparison fair.
 *
 * Interview-flavoured so the clip sounds like the product, and loaded with the
 * sounds accents actually diverge on: /θ/ and /ð/ (thanks, three, the, than),
 * /r/ vs /l/ (really, results, walk, difficult), /v/ vs /w/ (CV, walk, were,
 * worse), final consonant clusters (projects, results, expected), and
 * rhoticity (before, your, worse).
 */
const AUDITION_SENTENCE =
  "Thanks for joining today. Before we start, could you walk me through the " +
  "three projects on your CV, and describe a really difficult situation where " +
  "your team's results were worse than you had expected?";

/**
 * WER above which a clip is flagged for closer listening.
 *
 * Read off the controls rather than tuned: the fourteen real `en-*` voices all
 * land between 0% and 3%, and the observed distribution has a wide empty band
 * (nothing between 12% and 21%), so the exact value is not load-bearing.
 *
 * **This threshold decides nothing.** It sorts the listening order, and that is
 * all it is entitled to do. Two reasons it cannot stand in for a verdict:
 *
 *   - A recogniser is not a listener. It has no context and no top-down repair,
 *     so it fails on audio a person follows easily. WER almost certainly
 *     overstates how hard a clip is for a candidate.
 *   - It is Azure scoring Azure — a closed loop, not an independent measure.
 *
 * And it is blind in the other direction too: a clip at 0% may be perfectly
 * intelligible *and* have no accent at all, which is the failure that makes the
 * whole feature pointless. Neither end of the range is decidable from here.
 */
const WER_INTELLIGIBILITY_CEILING = 0.15;

const OUT_DIR = path.join("docs", "artifacts", "voice-audition");
const SHEET = path.join("docs", "artifacts", "voice-audition.md");
const CATALOGUE = (region: string) =>
  path.join("docs", "artifacts", `azure-voices-${region}.json`);

interface Args {
  list: boolean;
  live: boolean;
  stt: boolean;
  play: boolean;
  page: boolean;
  serve: boolean;
  only: string[];
}

function parseArgs(argv: string[]): Args {
  const only = argv.find((a) => a.startsWith("--only="));
  return {
    list: argv.includes("--list"),
    live: argv.includes("--live"),
    stt: argv.includes("--stt"),
    play: argv.includes("--play"),
    page: argv.includes("--page"),
    serve: argv.includes("--serve"),
    only: only ? only.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean) : [],
  };
}

function credentials(): { key: string; region: string } {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    console.error(
      "AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set in .env.local.",
    );
    process.exit(1);
  }
  return { key, region };
}

// ---------------------------------------------------------------------------
// --list: the region's catalogue
// ---------------------------------------------------------------------------

interface CatalogueVoice {
  ShortName: string;
  Locale: string;
  LocaleName: string;
  DisplayName: string;
  Gender: string;
  Status: string;
  SecondaryLocaleCount: number;
  WordsPerMinute: number;
}

async function fetchCatalogue(key: string, region: string): Promise<void> {
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
  const response = await fetch(endpoint, {
    headers: { "Ocp-Apim-Subscription-Key": key },
  });
  if (!response.ok) {
    console.error(`Voice list failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  const raw = (await response.json()) as Array<
    CatalogueVoice & { SecondaryLocaleList?: string[] }
  >;
  const voices: CatalogueVoice[] = raw
    .map((v) => ({
      ShortName: v.ShortName,
      Locale: v.Locale,
      LocaleName: v.LocaleName,
      DisplayName: v.DisplayName,
      Gender: v.Gender,
      Status: v.Status,
      SecondaryLocaleCount: (v.SecondaryLocaleList ?? []).length,
      WordsPerMinute: v.WordsPerMinute,
    }))
    .sort((a, b) => a.ShortName.localeCompare(b.ShortName));

  const file = CATALOGUE(region);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        _comment:
          "Azure Neural TTS voice catalogue for the region this project is configured against. " +
          "Fetched by `npm run eval:voices -- --list`. Trimmed to the fields the accent mapping and " +
          "its tests rely on; SecondaryLocaleList is reduced to a count because the full arrays " +
          "(100+ locales on Multilingual voices) dominated the file. Regenerate rather than hand-edit.",
        region,
        fetchedOn: new Date().toISOString().slice(0, 10),
        endpoint,
        totalVoices: voices.length,
        voices,
      },
      null,
      2,
    ) + "\n",
  );
  const locales = [...new Set(voices.filter((v) => v.Locale.startsWith("en-")).map((v) => v.Locale))].sort();
  console.log(`Wrote ${file} — ${voices.length} voices.`);
  console.log(`English locales in ${region}: ${locales.join(" ")}`);
}

// ---------------------------------------------------------------------------
// Candidates — read from the shipping table, never re-declared
// ---------------------------------------------------------------------------

interface Candidate {
  index: number;
  nationality: string;
  voice: AccentVoice;
}

/**
 * Auditing a copy of the mapping is how a mapping drifts out of its evidence,
 * so candidates are derived from `ACCENT_VOICES` and the real nationality list.
 */
function candidates(only: string[]): Candidate[] {
  const nationalities = NATIONALITY_POOL.filter(
    (n) => only.length === 0 || only.some((o) => o.toLowerCase() === n.toLowerCase()),
  );
  const rows: Candidate[] = [];
  for (const nationality of nationalities) {
    const locale = localeForNationality(nationality);
    if (!locale) continue;
    for (const voice of ACCENT_VOICES.filter((v) => v.locale === locale)) {
      rows.push({ index: rows.length + 1, nationality, voice });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// --live: synthesis
// ---------------------------------------------------------------------------

function synthesise(
  key: string,
  region: string,
  voiceUri: string,
  outFile: string,
): Promise<{ ok: boolean; bytes: number; detail: string }> {
  return new Promise((resolve) => {
    const config = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    config.speechSynthesisVoiceName = voiceUri;
    config.speechSynthesisOutputFormat =
      SpeechSDK.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;
    // `null` audio config keeps the bytes in memory. Passing a speaker output
    // would try to open an audio device, which a CLI does not have.
    const synth = new SpeechSDK.SpeechSynthesizer(config, null);
    synth.speakTextAsync(
      AUDITION_SENTENCE,
      (result) => {
        const ok =
          result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted;
        resolve({
          ok,
          bytes: ok ? result.audioData.byteLength : 0,
          // A voice that fails in this region is a result, not a row to skip.
          detail: ok ? "" : `${SpeechSDK.ResultReason[result.reason]} ${result.errorDetails ?? ""}`.trim(),
        });
        if (ok) {
          fs.writeFileSync(outFile, Buffer.from(result.audioData));
        }
        synth.close();
      },
      (error) => {
        resolve({ ok: false, bytes: 0, detail: String(error) });
        synth.close();
      },
    );
  });
}

// ---------------------------------------------------------------------------
// --stt: intelligibility floor
// ---------------------------------------------------------------------------

const NORMALISE = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/** Levenshtein distance over words, divided by reference length. */
function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = NORMALISE(reference).split(" ");
  const hyp = NORMALISE(hypothesis).split(" ");
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  let prev = Array.from({ length: hyp.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ref.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= hyp.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[hyp.length] / ref.length;
}

function recognise(key: string, region: string, wav: string): Promise<string> {
  return new Promise((resolve) => {
    const config = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    // Deliberately en-US: the question is whether an English listener can
    // follow this audio, not whether a matched-locale model can.
    config.speechRecognitionLanguage = "en-US";
    const audio = SpeechSDK.AudioConfig.fromWavFileInput(fs.readFileSync(wav));
    const recognizer = new SpeechSDK.SpeechRecognizer(config, audio);
    const parts: string[] = [];
    recognizer.recognized = (_s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        parts.push(e.result.text);
      }
    };
    recognizer.sessionStopped = () => {
      recognizer.stopContinuousRecognitionAsync(() => {
        recognizer.close();
        resolve(parts.join(" "));
      });
    };
    recognizer.canceled = () => {
      recognizer.stopContinuousRecognitionAsync(() => {
        recognizer.close();
        resolve(parts.join(" "));
      });
    };
    recognizer.startContinuousRecognitionAsync();
  });
}

// ---------------------------------------------------------------------------

/**
 * The machine's half, which is smaller than it first looks.
 *
 * Synthesis failing is the only real rejection here — there is no audio. A
 * native English locale needs no audition because the accent is what the voice
 * is. Everything else is a listening-priority hint, not a verdict.
 */
function autoVerdict(r: Row): string {
  if (!r.ok) return "no audio — synthesis failed";
  if (r.voice.locale.startsWith("en-")) return "native English locale";
  if (r.wer === null) return "no WER — run with --stt";
  if (r.wer > WER_INTELLIGIBILITY_CEILING) return `listen closely — recogniser struggled`;
  return "listen";
}

interface Row extends Candidate {
  file: string;
  ok: boolean;
  bytes: number;
  detail: string;
  heard: string;
  wer: number | null;
}

function writeSheet(rows: Row[], region: string, chars: number, stt: boolean): void {
  const lines: string[] = [];
  lines.push("# Accent audition");
  lines.push("");
  lines.push(`- Run: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`- Region: \`${region}\``);
  lines.push(`- SDK: microsoft-cognitiveservices-speech-sdk`);
  lines.push(`- Format: Riff24Khz16BitMonoPcm`);
  lines.push(`- Characters synthesised: ${chars}`);
  lines.push(`- Command: \`npm run eval:voices -- --live${stt ? " --stt" : ""}\``);
  lines.push("");
  lines.push("Sentence, identical for every voice:");
  lines.push("");
  lines.push(`> ${AUDITION_SENTENCE}`);
  lines.push("");
  lines.push(
    "**The `Accent` and `Verdict` columns are for a human to fill in after listening.** " +
      "Everything else is machine-generated. WER is what Azure's own `en-US` recogniser scored " +
      "the audio, and it decides nothing: a recogniser has no context, so it fails on speech a " +
      "person follows easily, and it is Azure scoring Azure either way. It ranks the listening " +
      "order. A high-WER clip that you can follow by ear is fine to ship — nothing in the " +
      "product ever runs a recogniser over the interviewer's voice.",
  );
  lines.push("");
  lines.push(
    "> Verdict column is one listener's judgement on a single sentence, N=1. Not a rater study.",
  );
  lines.push("");
  lines.push(
    "| # | Nationality | Voice | Locale | Gender | Synth | WER | Auto | Recognised as | Accent (none/slight/clear) | Verdict (use/reject) |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    lines.push(
      `| ${r.index} | ${r.nationality} | \`${r.voice.uri}\` | ${r.voice.locale} | ${r.voice.gender} | ` +
        `${r.ok ? "ok" : "FAIL: " + r.detail} | ` +
        `${r.wer === null ? "" : (r.wer * 100).toFixed(0) + "%"} | ${autoVerdict(r)} | ` +
        `${r.heard ? r.heard.slice(0, 90) : ""} | | |`,
    );
  }
  lines.push("");
  lines.push(`Audio: \`${OUT_DIR}/\` (git-ignored — regenerate rather than commit).`);
  lines.push("");
  fs.writeFileSync(SHEET, lines.join("\n"));
  console.log(`\nWrote ${SHEET}`);
}

interface SheetRow {
  index: string;
  nationality: string;
  uri: string;
  locale: string;
  gender: string;
  wer: string;
  auto: string;
  heard: string;
  file: string;
}

/**
 * Re-read the last audition from its own artifact.
 *
 * `--play` and `--page` exist to be run repeatedly while deciding, so they must
 * not re-synthesise: the clips are already on disk and Azure has already been
 * paid. Parsing the sheet rather than keeping a second machine-readable copy
 * keeps one file as the source of truth.
 */
function readSheet(): SheetRow[] {
  if (!fs.existsSync(SHEET)) return [];
  return fs
    .readFileSync(SHEET, "utf8")
    .split("\n")
    .filter((line) => /^\| \d+ \|/.test(line))
    .map((line) => {
      const c = line.split("|").map((cell) => cell.trim());
      const uri = c[3].replace(/`/g, "");
      return {
        index: c[1],
        nationality: c[2],
        uri,
        locale: c[4],
        gender: c[5],
        wer: c[7],
        auto: c[8].replace(/\*\*/g, ""),
        heard: c[9],
        file: path.join(OUT_DIR, `${c[1].padStart(2, "0")}-${c[2]}-${uri}.wav`),
      };
    });
}

/** Play clips in order through the system player. No Azure, no cost. */
function play(rows: SheetRow[]): void {
  const missing = rows.filter((r) => !fs.existsSync(r.file));
  if (missing.length === rows.length) {
    console.error(`No clips on disk. Run: npm run eval:voices -- --live --stt`);
    process.exit(1);
  }
  for (const r of rows) {
    if (!fs.existsSync(r.file)) continue;
    console.log(
      `▶ ${r.index.padStart(2)}  ${r.nationality.padEnd(12)} ${r.uri.padEnd(26)} WER ${r.wer.padEnd(5)} ${r.auto}`,
    );
    try {
      execFileSync("afplay", [r.file], { stdio: "ignore" });
    } catch {
      console.log(`   (could not play — open ${r.file} manually)`);
    }
  }
}

/**
 * A browser page for the part that actually needs judgement.
 *
 * Sequential terminal playback is fine for a first pass, but the question is
 * comparative — "does this sound accented, or just American?" — and that needs
 * the neutral control one click away, not twenty clips ago. Audio is referenced
 * by relative path rather than embedded, so the page stays a few KB however
 * many clips there are.
 */
function writePage(rows: SheetRow[]): void {
  const control = rows.find((r) => r.uri === "en-US-AriaNeural");
  const groups = new Map<string, SheetRow[]>();
  for (const r of rows) groups.set(r.nationality, [...(groups.get(r.nationality) ?? []), r]);

  const rel = (r: SheetRow) => path.basename(r.file);
  const card = (r: SheetRow) => `
    <tr data-uri="${r.uri}">
      <td><audio controls preload="none" src="${rel(r)}"></audio></td>
      <td><code>${r.uri}</code><br><span class="muted">${r.gender}</span></td>
      <td class="${r.auto.includes("reject") ? "bad" : ""}">${r.wer || "—"}</td>
      <td class="muted">${r.auto}</td>
      <td>
        <select data-verdict="${r.uri}">
          <option value="">—</option>
          <option value="clear">clear accent</option>
          <option value="slight">slight accent</option>
          <option value="none">no accent (sounds American)</option>
          <option value="broken">not English</option>
        </select>
      </td>
    </tr>`;

  const html = `<!doctype html>
<meta charset="utf-8">
<title>Accent audition</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  h2 { font-size: 1rem; margin: 1.75rem 0 .4rem; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: .35rem .5rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); vertical-align: middle; }
  code { font-size: .85em; }
  .muted { opacity: .6; font-size: .85em; }
  .bad { color: #c0392b; font-weight: 600; }
  audio { height: 2rem; width: 15rem; }
  .control { position: sticky; top: 0; padding: .75rem; margin-bottom: 1rem;
             background: Canvas; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); border-radius: .5rem; z-index: 1; }
  textarea { width: 100%; height: 9rem; font-family: ui-monospace, monospace; font-size: .8rem; margin-top: .5rem; }
  .note { opacity: .75; font-size: .9em; }
</style>
<h1>Accent audition</h1>
<p class="note">
  Every clip is the same sentence. The question is <strong>not</strong> whether you can
  understand it — decide whether it sounds like a <em>person with an accent</em> (ship it)
  or like a voice mispronouncing English (don't). WER is what Azure's own
  <code>en-US</code> recogniser scored the audio; it is a rough guide only, and it has no
  role in the product. A high-WER clip you can follow by ear is fine to ship.
</p>
<div class="control">
  <strong>Neutral control</strong> — what "no accent" sounds like${control ? `<br><audio controls preload="none" src="${rel(control)}"></audio>` : ""}
</div>
${[...groups]
  .map(
    ([nationality, items]) =>
      `<h2>${nationality}</h2><table>${items.map(card).join("")}</table>`,
  )
  .join("\n")}
<h2>Your verdicts</h2>
<p class="note">Paste into <code>docs/artifacts/voice-audition.md</code>, or tell Claude which to enable.</p>
<textarea id="out" readonly></textarea>
<script>
  const out = document.getElementById("out");
  const render = () => {
    out.value = [...document.querySelectorAll("select[data-verdict]")]
      .filter((s) => s.value)
      .map((s) => s.dataset.verdict.padEnd(28) + s.value)
      .join("\n") || "(nothing recorded yet)";
  };
  document.addEventListener("change", render);
  render();
</script>
`;
  const file = path.join(OUT_DIR, "index.html");
  fs.writeFileSync(file, html);
  console.log(`Wrote ${file}`);
  console.log(`Open it with:  open ${file}`);
}

/**
 * Serve the audition page over HTTP instead of opening it as a file.
 *
 * `file://` looks like it should be enough and often is not. This repo lives
 * under `~/Documents`, which macOS gates per-application, so a browser without
 * Documents access loads the page and then silently fails to fetch the audio —
 * the play button does nothing and there is no error to see. Serving over
 * localhost sidesteps the permission prompt, `file://` media restrictions, and
 * any Range handling the browser wants for <audio>.
 */
function serve(port: number): void {
  const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".wav": "audio/wav",
  };

  http
    .createServer((req, res) => {
      const raw = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const name = path.basename(raw);
      const file = path.join(OUT_DIR, name === "" ? "index.html" : name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end("not found");
        return;
      }
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "Content-Length": body.length,
        // <audio> asks for ranges; answering the whole file is fine at this
        // size and avoids a partial-content path that could go wrong.
        "Accept-Ranges": "none",
      });
      res.end(body);
    })
    .listen(port, () => {
      console.log(`Audition page: http://localhost:${port}/`);
      console.log("Ctrl-C to stop.");
    });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Both of these read what is already on disk, so they run before the
  // credential check — deciding what to ship should not require a key.
  if (args.play || args.page || args.serve) {
    const all = readSheet();
    const rows = args.only.length
      ? all.filter((r) =>
          args.only.some((o) => o.toLowerCase() === r.nationality.toLowerCase()),
        )
      : all;
    if (rows.length === 0) {
      console.error("No rows in the audition sheet. Run --live --stt first.");
      process.exit(1);
    }
    if (args.page || args.serve) writePage(all);
    if (args.serve) {
      serve(8321);
      return;
    }
    if (args.play) play(rows);
    return;
  }

  const { key, region } = credentials();

  if (args.list) {
    await fetchCatalogue(key, region);
    if (!args.live) return;
  }

  const rows = candidates(args.only);

  if (!args.live) {
    const unverified = ACCENT_VOICES.filter((v) => !v.verified);
    console.log(`${ACCENT_VOICES.length} voices mapped, ${unverified.length} still unverified.\n`);
    const byLocale = new Map<string, AccentVoice[]>();
    for (const v of unverified) {
      byLocale.set(v.locale, [...(byLocale.get(v.locale) ?? []), v]);
    }
    for (const [locale, voices] of [...byLocale].sort()) {
      console.log(`  ${locale.padEnd(7)} ${voices.map((v) => v.uri.replace(locale + "-", "")).join(", ")}`);
    }
    const unmapped = NATIONALITY_POOL.filter((n) => !localeForNationality(n));
    if (unmapped.length) console.log(`\nNationalities with no locale at all: ${unmapped.join(", ")}`);
    console.log(`\n${rows.length} candidates would be auditioned. Re-run with --live to synthesise.`);
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const done: Row[] = [];
  let chars = 0;

  for (const c of rows) {
    const stem = `${String(c.index).padStart(2, "0")}-${c.nationality}-${c.voice.uri}`;
    const file = path.join(OUT_DIR, `${stem}.wav`);
    process.stdout.write(`[${c.index}/${rows.length}] ${c.nationality.padEnd(12)} ${c.voice.uri.padEnd(28)} `);
    const result = await synthesise(key, region, c.voice.uri, file);
    chars += AUDITION_SENTENCE.length;
    let heard = "";
    let wer: number | null = null;
    if (result.ok && args.stt) {
      heard = await recognise(key, region, file);
      wer = wordErrorRate(AUDITION_SENTENCE, heard);
    }
    console.log(
      result.ok
        ? `ok ${(result.bytes / 1024).toFixed(0)}KB${wer === null ? "" : `  WER ${(wer * 100).toFixed(0)}%`}`
        : `FAIL ${result.detail}`,
    );
    done.push({ ...c, file, ...result, heard, wer });
  }

  writeSheet(done, region, chars, args.stt);

  const listen = done.filter((r) => autoVerdict(r) === "listen");
  const rejected = done.filter((r) => autoVerdict(r).includes("struggled"));
  console.log(
    `\n${done.filter((r) => r.voice.locale.startsWith("en-")).length} native English voices need no audition.`,
  );
  console.log(`${rejected.length} the recogniser struggled with — listen to these too, it is not the judge:`);
  for (const r of rejected) {
    console.log(`  ${r.nationality.padEnd(12)} ${r.voice.uri.padEnd(26)} WER ${((r.wer ?? 0) * 100).toFixed(0)}%`);
  }
  console.log(`\n${listen.length} passed the intelligibility floor and need an ear:`);
  for (const r of listen) {
    console.log(`  ${String(r.index).padStart(2)} ${r.nationality.padEnd(12)} ${r.voice.uri.padEnd(26)} ${r.file}`);
  }
  console.log(
    `\nAll ${listen.length + rejected.length} need an ear. Two different questions:\n` +
      `  low WER  — does it sound accented, or does it just sound American?\n` +
      `  high WER — is it a strong accent (ship it) or the voice mispronouncing English (do not)?\n` +
      `\nnpm run eval:voices -- --page    a browser page, control clip pinned at the top\n` +
      `npm run eval:voices -- --play    play them all in order in the terminal\n`,
  );
}

void main();
