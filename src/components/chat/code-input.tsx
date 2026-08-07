"use client";

import { useCallback, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { sql } from "@codemirror/lang-sql";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAnswerTimer } from "@/hooks/use-answer-timer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CODE_LANGUAGES,
  describeCode,
  formatCodeAnswer,
  type CodeLanguage,
} from "@/lib/code-answer";

/**
 * Answer surface for technical rounds.
 *
 * CodeMirror 6 rather than Monaco: Monaco is roughly an order of magnitude
 * larger and pulls in a web-worker setup, and this codebase has kept its
 * dependency budget tight enough to hand-roll its charts.
 */
function languageExtension(language: CodeLanguage) {
  switch (language) {
    case "python":
      return [python()];
    case "javascript":
      return [javascript()];
    case "typescript":
      return [javascript({ typescript: true })];
    case "java":
      return [java()];
    case "sql":
      return [sql()];
    default:
      return [];
  }
}

export function CodeInput({
  onSend,
  disabled,
  language,
  onLanguageChange,
  timeLimitSeconds = 300,
  timeoutFallbackMessage = "[No response submitted before time expired.]",
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
  /**
   * The same limit prose answers get. Without this, switching to the editor
   * would quietly hand the candidate an untimed answer — the toggle is a
   * choice of *how* to answer, not of whether the clock runs.
   */
  timeLimitSeconds?: number;
  timeoutFallbackMessage?: string;
  /**
   * Owned by the caller so it survives the remount between turns.
   *
   * This used to be local state seeded with `DEFAULT_CODE_LANGUAGE`, and the
   * chat page remounts this component after every answer (`key={userTurnKey}`)
   * to clear the editor — so a five-question round in Java meant choosing Java
   * five times. The code and note still reset, which is the point of the
   * remount; the language is a round-level preference, not a per-answer one.
   */
  language: CodeLanguage;
  onLanguageChange: (next: CodeLanguage) => void;
}) {
  const setLanguage = onLanguageChange;
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");

  const extensions = useMemo(() => languageExtension(language), [language]);
  const canSend = !disabled && code.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(formatCodeAnswer(code, language, note));
    setCode("");
    setNote("");
  }, [canSend, code, language, note, onSend]);

  const { timerText, isWarning } = useAnswerTimer({
    timeLimitSeconds,
    disabled,
    // Closes over the live draft. `useAnswerTimer` keeps this in a ref, so a
    // new identity per keystroke does not re-arm the countdown.
    onExpire: () => {
      if (disabled) return false;
      // Half-written code is still an answer, and a partial solution tells the
      // report more than the fallback string does. Fall back only when the
      // editor is genuinely empty.
      onSend(
        code.trim()
          ? formatCodeAnswer(code, language, note)
          : timeoutFallbackMessage,
      );
      setCode("");
      setNote("");
      return true;
    },
  });

  return (
    <div className="space-y-2">
      <div
        className={`text-xs font-medium ${
          isWarning ? "text-red-600" : "text-slate-500"
        }`}
      >
        Response timer: {timerText}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Select
          value={language}
          onValueChange={(value) => setLanguage(value as CodeLanguage)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-40" aria-label="Answer language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CODE_LANGUAGES.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500" aria-live="polite">
          {code.trim() ? describeCode(code) : "Write your solution"}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <CodeMirror
          value={code}
          height="240px"
          extensions={extensions}
          editable={!disabled}
          onChange={setCode}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: false,
          }}
        />
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        disabled={disabled}
        rows={2}
        placeholder="Optional: talk through your approach, assumptions, or complexity…"
        aria-label="Notes on your approach"
        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Reviewed by the interviewer, not executed.
        </p>
        <Button onClick={handleSend} disabled={!canSend} className="gap-2">
          Submit answer
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
