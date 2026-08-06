"use client";

import { MessageSquare, Mic } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { JobDescriptionPicker } from "@/components/setup/job-description-picker";
import { ResumePicker } from "@/components/setup/resume-picker";
import type { InterviewSetupState, PracticeMode } from "@/lib/interview-setup";

/**
 * Everything the interviewer needs before it can ask anything: how you want to
 * answer, what you are preparing for, and any documents that ground it.
 *
 * Merges what used to be two steps and half of a third. "Mode" was a whole step
 * spending two large gradient cards on a binary choice; the job description and
 * CV pickers used to sit on the *last* step, which broke the round builder's
 * "Suggest from job description" button — it needed a JD collected two steps
 * after it.
 *
 * Each section is now its own Card so every heading sits directly above the
 * controls it names. The previous version wrapped all three in one card under a
 * step-level title and description, which meant the step's question got asked
 * twice: once as a container label with nothing to type into, and again as the
 * heading above the actual textarea. The first one looked broken because it
 * was labelling a box, not asking anything.
 */

const MODES: Array<{
  value: PracticeMode;
  label: string;
  hint: string;
  icon: typeof MessageSquare;
}> = [
  {
    value: "text",
    label: "Text",
    hint: "Type your answers",
    icon: MessageSquare,
  },
  {
    value: "voice",
    label: "Voice",
    hint: "Speak, and hear the interviewer",
    icon: Mic,
  },
];

export function ContextStep({
  setup,
  quickStarts,
  onUpdate,
  onModeChange,
}: {
  setup: InterviewSetupState;
  quickStarts: ReadonlyArray<{ id: string; label: string; template: string }>;
  onUpdate: (partial: Partial<InterviewSetupState>) => void;
  /**
   * Separate from `onUpdate` on purpose: changing the mode also has to rewrite
   * every round's `practiceMode`, so it cannot be a plain field patch.
   */
  onModeChange: (mode: PracticeMode) => void;
}) {
  const brief = setup.customScenarioBrief ?? "";
  const charCount = brief.trim().length;

  return (
    <>
      <Card className="border border-gray-200/80 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">
            How do you want to answer?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {MODES.map((option) => {
              const Icon = option.icon;
              const isActive = setup.practiceMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onModeChange(option.value)}
                  aria-pressed={isActive}
                  className={`flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-gray-500">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200/80 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Describe the role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              id="interview-brief"
              value={brief}
              onChange={(event) =>
                onUpdate({ customScenarioBrief: event.target.value })
              }
              aria-label="Describe the role you are preparing for"
              placeholder='e.g. "Senior data analyst at a mid-size SaaS company. Expecting questions on SQL, dashboards, stakeholder communication, and a behavioural round on cross-team conflict."'
              className="min-h-32 resize-y leading-6"
            />
            {/* The one hint that survives here: it states a bar you have to
                clear, which nothing else on screen tells you. */}
            <p className="text-xs text-gray-500">
              {charCount}/20 characters minimum
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              Or start from
            </span>
            {quickStarts.map((chip) => {
              const isActive = brief.trim() === chip.template.trim();
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    onUpdate({ customScenarioBrief: chip.template })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200/80 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Documents
            <Badge variant="outline" className="font-normal">
              Optional
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <JobDescriptionPicker
            value={setup.jobDescription}
            onChange={(next) => onUpdate({ jobDescription: next })}
          />

          <ResumePicker
            value={setup.resume}
            onChange={(next) => onUpdate({ resume: next })}
          />
        </CardContent>
      </Card>
    </>
  );
}
