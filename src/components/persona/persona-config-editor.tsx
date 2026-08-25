"use client";

import { Input } from "@/components/ui/input";
import { Field, FieldSection } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialField, PERSONA_DIALS } from "@/components/persona/dial-field";
import {
  isQuestioningStyle,
  QUESTIONING_STYLE_META,
  QUESTIONING_STYLES,
  type CommunicationStyle,
  type PersonaConfig,
  type PersonaVoiceGender,
} from "@/lib/persona-engine";
import {
  describeResolvedVoice,
  resolveVoiceForPersona,
} from "@/lib/persona-voice";

/**
 * The persona editor, as sections.
 *
 * This was one flat two-column grid of sixteen fields inside a 512px dialog,
 * and it read as clutter for three separate reasons. Nothing grouped identity
 * from dials from character. shadcn's `SelectTrigger` defaults to `w-fit`
 * while `Input` fills its column, so every dropdown hugged its own content and
 * every text box did not — "the widths are all different" was one default
 * class. And the six dials were bare number inputs here while the setup wizard
 * had sliders with tooltips and a value readout for the same fields: two
 * implementations of one control, with the worse one on the page whose whole
 * job is editing dials.
 *
 * Now: `FieldSection` groups, `Field` owns the label/hint rhythm, every select
 * is `w-full`, and the dials are the wizard's `DialField`. Same props as before
 * — the two dialogs that host this do not change.
 */

const VOICE_GENDERS: Array<{ value: PersonaVoiceGender; label: string }> = [
  { value: "unspecified", label: "No preference" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const STYLES: Array<{ value: CommunicationStyle; label: string }> = [
  { value: "direct", label: "Direct" },
  { value: "diplomatic", label: "Diplomatic" },
  { value: "collaborative", label: "Collaborative" },
  { value: "analytical", label: "Analytical" },
];

interface PersonaConfigEditorProps {
  value: PersonaConfig;
  onChange: (patch: Partial<PersonaConfig>) => void;
}

/** Comma-separated list editing, as the fields have always worked. */
function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function PersonaConfigEditor({
  value,
  onChange,
}: PersonaConfigEditorProps) {
  return (
    <div className="space-y-8">
      <FieldSection title="Identity">
        <Field label="Display name" htmlFor="persona-name">
          <Input
            id="persona-name"
            value={value.name}
            placeholder="e.g. Priya Sharma"
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>

        {/* Nationality and voice share a row because one drives the other:
            the accent follows the nationality, and the hint under the voice
            says which voice that actually produces. Apart, a nationality with
            no accent voice looked like a bug rather than a stated limit. */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Nationality" htmlFor="persona-nationality">
            <Input
              id="persona-nationality"
              value={value.nationality}
              placeholder="e.g. Singaporean"
              onChange={(event) =>
                onChange({ nationality: event.target.value })
              }
            />
          </Field>
          <Field
            label="Voice"
            htmlFor="persona-voice"
            hint={describeResolvedVoice(
              resolveVoiceForPersona({
                nationality: value.nationality,
                voiceGender: value.voiceGender,
              }),
              value.name,
              value.nationality,
            )}
          >
            <Select
              value={value.voiceGender ?? "unspecified"}
              onValueChange={(next) =>
                onChange({ voiceGender: next as PersonaVoiceGender })
              }
            >
              <SelectTrigger id="persona-voice" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_GENDERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Industry" htmlFor="persona-industry">
            <Input
              id="persona-industry"
              value={value.industry}
              placeholder="e.g. Fintech"
              onChange={(event) => onChange({ industry: event.target.value })}
            />
          </Field>
          <Field label="Seniority" htmlFor="persona-seniority">
            <Input
              id="persona-seniority"
              value={value.seniority}
              placeholder="e.g. Engineering Manager"
              onChange={(event) => onChange({ seniority: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Years of experience" htmlFor="persona-years">
            <Input
              id="persona-years"
              type="number"
              min={0}
              max={50}
              value={value.yearsExperience}
              onChange={(event) =>
                onChange({
                  yearsExperience: Math.max(
                    0,
                    Math.min(50, Number(event.target.value) || 0),
                  ),
                })
              }
            />
          </Field>
          <Field
            label="Communication style"
            htmlFor="persona-communication"
            hint="How they speak — separate from how they conduct the interview, below."
          >
            <Select
              value={value.communicationStyle}
              onValueChange={(next) =>
                onChange({ communicationStyle: next as CommunicationStyle })
              }
            >
              <SelectTrigger id="persona-communication" className="w-full">
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
          </Field>
        </div>
      </FieldSection>

      <FieldSection title="How they interview">
        <Field
          label="Questioning style"
          htmlFor="persona-questioning-style"
          hint={
            QUESTIONING_STYLE_META[value.questioningStyle ?? "conversational"]
              .blurb
          }
        >
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
            <SelectTrigger id="persona-questioning-style" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTIONING_STYLES.map((style) => (
                <SelectItem key={style} value={style}>
                  {QUESTIONING_STYLE_META[style].label} —{" "}
                  {QUESTIONING_STYLE_META[style].blurb}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldSection>

      <FieldSection title="Dials">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONA_DIALS.map((dial) => (
            <DialField
              key={dial.key}
              label={dial.label}
              value={value[dial.key] ?? 5}
              helper={dial.helper}
              onChange={(next) =>
                onChange({ [dial.key]: next } as Partial<PersonaConfig>)
              }
            />
          ))}
        </div>
      </FieldSection>

      <FieldSection title="Character">
        <Field
          label="Personality traits"
          htmlFor="persona-traits"
          hint="Comma-separated. Shown on the card and read by the interviewer."
        >
          <Input
            id="persona-traits"
            value={value.personalityTraits.join(", ")}
            placeholder="e.g. analytical, impatient, precise"
            onChange={(event) =>
              onChange({ personalityTraits: splitList(event.target.value) })
            }
          />
        </Field>
        <Field
          label="Dislikes"
          htmlFor="persona-boundaries"
          hint="What they push back on hard. Comma-separated."
        >
          <Input
            id="persona-boundaries"
            value={value.boundaries.join(", ")}
            placeholder="e.g. vague answers, buzzwords"
            onChange={(event) =>
              onChange({ boundaries: splitList(event.target.value) })
            }
          />
        </Field>
        <Field
          label="Interest areas"
          htmlFor="persona-interests"
          hint="Where they like to dig in. Comma-separated."
        >
          <Input
            id="persona-interests"
            value={value.interestAreas.join(", ")}
            placeholder="e.g. system design, incident response"
            onChange={(event) =>
              onChange({ interestAreas: splitList(event.target.value) })
            }
          />
        </Field>
      </FieldSection>
    </div>
  );
}
