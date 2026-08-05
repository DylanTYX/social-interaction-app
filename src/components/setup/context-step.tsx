"use client";

import { MessageSquare, Mic } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JobDescriptionPicker } from "@/components/setup/job-description-picker";
import { ResumePicker } from "@/components/setup/resume-picker";
import type { InterviewSetupState, PracticeMode } from "@/lib/interview-setup";

/**
 * Everything the interviewer needs to know before it can ask anything: how you
 * want to answer, what you are preparing for, and any documents that ground it.
 *
 * This merges what used to be two steps and half of a third.
 *
 * "Mode" was its own step: two large gradient cards, each with an icon tile, a
 * paragraph and three bullet points, to make a binary choice. That is a lot of
 * screen for text-vs-voice, so it is a segmented control now.
 *
 * The job description and CV pickers moved here from the final step. They are
 * context, so this is where they belong — and it fixes a real bug: the round
 * builder's "Suggest from job description" button needs a job description, but
 * the JD was collected two steps *after* it, so on a first pass through the
 * wizard the button could never appear.
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

const QUICK_START_HINT =
  "Starting points, not constraints — edit freely once filled in.";

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
  const isValid = charCount >= 20;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          How do you want to answer?
        </h2>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          What are you preparing for?
        </h2>
        <div className="space-y-2">
          <Label htmlFor="interview-brief">
            Describe the role, company, or situation
          </Label>
          <Textarea
            id="interview-brief"
            value={brief}
            onChange={(event) =>
              onUpdate({ customScenarioBrief: event.target.value })
            }
            placeholder='e.g. "Senior data analyst at a mid-size SaaS company. Expecting questions on SQL, dashboards, stakeholder communication, and a behavioral round on cross-team conflict."'
            className="min-h-32 resize-y leading-6"
          />
          <p className="text-xs text-gray-500">
            <span className={isValid ? "text-emerald-600" : undefined}>
              {charCount} character{charCount === 1 ? "" : "s"}
            </span>
            {
              " · at least 20 required. This sets what you are asked about; the round types on the next step set how it is scored."
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">
            Quick starts
          </span>
          {quickStarts.map((chip) => {
            const isActive = brief.trim() === chip.template.trim();
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onUpdate({ customScenarioBrief: chip.template })}
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
        <p className="text-xs text-gray-500">{QUICK_START_HINT}</p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Ground it in real documents
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Optional. A job description tailors the questions to the role; a CV
            lets the interviewer ask about your actual experience.
          </p>
        </div>

        <JobDescriptionPicker
          value={setup.jobDescription}
          onChange={(next) => onUpdate({ jobDescription: next })}
        />

        <ResumePicker
          value={setup.resume}
          onChange={(next) => onUpdate({ resume: next })}
        />
      </section>
    </div>
  );
}
