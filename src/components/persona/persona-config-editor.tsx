"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isQuestioningStyle,
  type CommunicationStyle,
  type PersonaConfig,
  type QuestioningStyle,
} from "@/lib/persona-engine";

const STYLES: Array<{ value: CommunicationStyle; label: string }> = [
  { value: "direct", label: "Direct" },
  { value: "diplomatic", label: "Diplomatic" },
  { value: "collaborative", label: "Collaborative" },
  { value: "analytical", label: "Analytical" },
];

/**
 * Layer 3 archetypes — how the interview is *conducted*, as opposed to
 * `communicationStyle`, which is how the interviewer *speaks*. The blurbs are
 * the honest one-line versions of the prompt paragraphs in persona-engine.ts.
 */
const QUESTIONING_STYLE_OPTIONS: Array<{
  value: QuestioningStyle;
  label: string;
  blurb: string;
}> = [
  {
    value: "conversational",
    label: "Conversational",
    blurb: "Natural discussion; picks up your threads.",
  },
  {
    value: "supportive",
    label: "Supportive",
    blurb: "Room to think; clarifies, never pressures.",
  },
  {
    value: "socratic",
    label: "Socratic",
    blurb: "Answers with the next question — why, what if.",
  },
  {
    value: "deep_dive",
    label: "Deep Dive",
    blurb: "One thread, drilled to the bottom.",
  },
  {
    value: "bar_raiser",
    label: "Bar Raiser",
    blurb: "Evidence required for every claim.",
  },
  {
    value: "stress",
    label: "Stress",
    blurb: "Pressure on, reassurance off. Opt-in.",
  },
];

interface PersonaConfigEditorProps {
  value: PersonaConfig;
  onChange: (patch: Partial<PersonaConfig>) => void;
}

export function PersonaConfigEditor({
  value,
  onChange,
}: PersonaConfigEditorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>Display name</Label>
        <Input
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Nationality</Label>
        <Input
          value={value.nationality}
          onChange={(event) => onChange({ nationality: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Industry</Label>
        <Input
          value={value.industry}
          onChange={(event) => onChange({ industry: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Seniority</Label>
        <Input
          value={value.seniority}
          onChange={(event) => onChange({ seniority: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Communication style</Label>
        <Select
          value={value.communicationStyle}
          onValueChange={(next) =>
            onChange({ communicationStyle: next as CommunicationStyle })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Strictness (1–10)</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={value.strictness}
          onChange={(event) =>
            onChange({
              strictness: Math.min(
                10,
                Math.max(1, Number(event.target.value) || 1),
              ) as PersonaConfig["strictness"],
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Warmth (1–10)</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={value.warmth}
          onChange={(event) =>
            onChange({
              warmth: Math.min(
                10,
                Math.max(1, Number(event.target.value) || 1),
              ) as PersonaConfig["warmth"],
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Pace (1–10)</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={value.pace ?? 5}
          onChange={(event) =>
            onChange({
              pace: Math.min(
                10,
                Math.max(1, Number(event.target.value) || 1),
              ) as PersonaConfig["pace"],
            })
          }
        />
        <p className="text-xs text-slate-500">
          Higher = faster questions, less breathing room.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Pushback (1–10)</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={value.pushback ?? 5}
          onChange={(event) =>
            onChange({
              pushback: Math.min(
                10,
                Math.max(1, Number(event.target.value) || 1),
              ) as PersonaConfig["pushback"],
            })
          }
        />
        <p className="text-xs text-slate-500">
          Higher = challenges claims and probes for evidence.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Probing depth (1–10)</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={value.probingDepth ?? 5}
          onChange={(event) =>
            onChange({
              probingDepth: Math.min(
                10,
                Math.max(1, Number(event.target.value) || 1),
              ) as PersonaConfig["probingDepth"],
            })
          }
        />
        <p className="text-xs text-slate-500">
          Higher = every vague claim gets a follow-up.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Unpredictability (1–10)</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={value.unpredictability ?? 5}
          onChange={(event) =>
            onChange({
              unpredictability: Math.min(
                10,
                Math.max(1, Number(event.target.value) || 1),
              ) as PersonaConfig["unpredictability"],
            })
          }
        />
        <p className="text-xs text-slate-500">
          Higher = more curveballs: pivots and scenario twists.
        </p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Questioning style</Label>
        <Select
          value={value.questioningStyle ?? "conversational"}
          onValueChange={(next) =>
            onChange({
              questioningStyle: isQuestioningStyle(next)
                ? next
                : "conversational",
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTIONING_STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} — {option.blurb}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
