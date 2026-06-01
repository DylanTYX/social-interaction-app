import {
  type CommunicationStyle,
  type PersonaConfig,
} from "@/lib/personaEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type PersonaCustomizerProps = {
  value: PersonaConfig;
  onChange: (nextValue: PersonaConfig) => void;
};

const QUESTION_STYLE_OPTIONS: Array<{
  value: CommunicationStyle;
  label: string;
  description: string;
}> = [
  {
    value: "direct",
    label: "Direct",
    description: "Fast, candid, and to the point",
  },
  {
    value: "diplomatic",
    label: "Diplomatic",
    description: "Tactful with measured pushback",
  },
  {
    value: "collaborative",
    label: "Collaborative",
    description: "Warm, supportive, and exploratory",
  },
  {
    value: "analytical",
    label: "Analytical",
    description: "Structured, evidence-driven, and precise",
  },
];

function updatePersona(
  current: PersonaConfig,
  patch: Partial<PersonaConfig>,
): PersonaConfig {
  return {
    ...current,
    ...patch,
  };
}

function SliderField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
  onChange: (nextValue: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Badge variant="secondary" className="text-xs px-2 py-0.5">
          {value}/10
        </Badge>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-600"
      />
      <p className="text-xs text-gray-500">{helper}</p>
    </div>
  );
}

export function PersonaCustomizer({ value, onChange }: PersonaCustomizerProps) {
  return (
    <Card className="border-gray-200/80 shadow-soft">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm">Persona Customizer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-gray-200/80 bg-gray-50/80 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{value.name}</Badge>
            <Badge variant="secondary">{value.communicationStyle}</Badge>
          </div>
          <p className="text-sm text-gray-600">
            {value.nationality} • {value.industry} • {value.seniority}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nationality</Label>
            <Input
              value={value.nationality}
              onChange={(event) =>
                onChange(
                  updatePersona(value, { nationality: event.target.value }),
                )
              }
              placeholder="e.g. Japanese"
            />
          </div>

          <div className="space-y-2">
            <Label>Industry</Label>
            <Input
              value={value.industry}
              onChange={(event) =>
                onChange(updatePersona(value, { industry: event.target.value }))
              }
              placeholder="e.g. Healthcare"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Seniority</Label>
          <Input
            value={value.seniority}
            onChange={(event) =>
              onChange(updatePersona(value, { seniority: event.target.value }))
            }
            placeholder="e.g. Director of Product"
          />
        </div>

        <div className="space-y-2">
          <Label>Question Style</Label>
          <Select
            value={value.communicationStyle}
            onValueChange={(nextStyle) =>
              onChange(
                updatePersona(value, {
                  communicationStyle: nextStyle as CommunicationStyle,
                }),
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_STYLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {
              QUESTION_STYLE_OPTIONS.find(
                (option) => option.value === value.communicationStyle,
              )?.description
            }
          </p>
        </div>

        <SliderField
          label="Strictness"
          value={value.strictness}
          onChange={(nextValue) =>
            onChange(
              updatePersona(value, {
                strictness: nextValue as PersonaConfig["strictness"],
              }),
            )
          }
          helper="Higher values make the interviewer more demanding and less forgiving."
        />

        <SliderField
          label="Warmth"
          value={value.warmth}
          onChange={(nextValue) =>
            onChange(
              updatePersona(value, {
                warmth: nextValue as PersonaConfig["warmth"],
              }),
            )
          }
          helper="Higher values make the interviewer more encouraging and supportive."
        />
      </CardContent>
    </Card>
  );
}
