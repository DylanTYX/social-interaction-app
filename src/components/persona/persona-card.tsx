"use client";

import type { CSSProperties, ReactNode } from "react";
import { Briefcase, Check, Globe, Mic } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { PERSONA_DIALS } from "@/components/persona/dial-field";
import { QUESTIONING_STYLE_META } from "@/lib/persona-engine";
import type { PersonaLibraryEntry } from "@/lib/persona-library";
import {
  describeVoiceBriefly,
  resolveVoiceForPersona,
} from "@/lib/persona-voice";
import { cn } from "@/lib/utils";

/**
 * The persona card, shared by the library page and the wizard's picker.
 *
 * They each had their own. The library's showed six dials, a style badge and
 * a voice line; the wizard's showed four dials and neither — so the same
 * persona looked like two different people depending on which screen you
 * were on, and one of the dials that actually drives behaviour silently
 * vanished between them. One card, two callers: the picker passes
 * `selected`/`onSelect` and gets a ring and an avatar check; the library
 * passes `onSelect` to open the editor and never marks anything selected.
 *
 * Pills are for closed sets you could filter by — Preset/Custom, the
 * questioning style. Traits and dislikes are free text and stay text.
 */

const KIND_LABEL: Record<PersonaLibraryEntry["kind"], string> = {
  preset: "Preset",
  user: "Custom",
};

/** Card-width labels for the two long dial names. */
const DIAL_SHORT_LABEL: Partial<
  Record<(typeof PERSONA_DIALS)[number]["key"], string>
> = {
  probingDepth: "Probing",
  unpredictability: "Curveballs",
};

export function PersonaCard({
  entry,
  selected = false,
  onSelect,
  menu,
  className,
  style,
}: {
  entry: PersonaLibraryEntry;
  selected?: boolean;
  onSelect?: () => void;
  /** Rendered top-right, outside the click target. Callers stop propagation. */
  menu?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { config } = entry;
  const interactive = Boolean(onSelect);

  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive && selected ? true : undefined}
      aria-label={interactive ? `${config.name}` : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        "group relative shadow-soft transition-all duration-200",
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-soft-md motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected && "border-primary bg-primary-subtle ring-2 ring-primary/20",
        className,
      )}
      style={style}
    >
      {menu && <div className="absolute right-2 top-2">{menu}</div>}
      <CardHeader>
        <div className="flex items-start gap-4 pr-8">
          <div className="relative shrink-0">
            <InitialsAvatar name={config.name} size="lg" shape="square" />
            {/* Selection lands on the avatar, not in the dial row, so picking
                a card never reflows the layout you are looking at. */}
            {selected && (
              <span
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary ring-2 ring-white"
                aria-hidden
              >
                <Check className="h-3 w-3 text-white" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-lg">
              {config.name}
              {selected && <span className="sr-only"> (selected)</span>}
            </CardTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {config.seniority}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge
                variant={entry.kind === "preset" ? "secondary" : "outline"}
              >
                {KIND_LABEL[entry.kind]}
              </Badge>
              {/* The headline of how this interviewer conducts a round — the
                  thing you would pick one for — so it sits by the name. */}
              <Badge variant="outline" className="bg-slate-50/80">
                {
                  QUESTIONING_STYLE_META[
                    config.questioningStyle ?? "conversational"
                  ].label
                }
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">
              {config.nationality} · {config.industry}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate capitalize">
              {config.communicationStyle} · {config.yearsExperience} yrs
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">
              {describeVoiceBriefly(
                resolveVoiceForPersona({
                  nationality: config.nationality,
                  voiceGender: config.voiceGender,
                }),
                config.nationality,
                config.voiceGender,
              )}
            </span>
          </div>
        </div>

        {(config.personalityTraits.length > 0 ||
          config.boundaries.length > 0) && (
          <div className="space-y-1">
            {config.personalityTraits.length > 0 && (
              <p className="text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">Traits:</span>{" "}
                {config.personalityTraits.slice(0, 3).join(", ")}
              </p>
            )}
            {config.boundaries.length > 0 && (
              <p className="text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">Dislikes:</span>{" "}
                {config.boundaries.slice(0, 3).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* All six, from the list both editors render — a dial that exists
            cannot be missing from either card again. */}
        <dl className="grid grid-cols-3 gap-x-2 gap-y-1 pt-1 text-xs tabular-nums">
          {PERSONA_DIALS.map((dial) => (
            <div key={dial.key} className="flex items-baseline gap-1 truncate">
              <dt className="text-muted-foreground">
                {DIAL_SHORT_LABEL[dial.key] ?? dial.label}
              </dt>
              <dd className="font-medium text-foreground">
                {config[dial.key] ?? 5}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
