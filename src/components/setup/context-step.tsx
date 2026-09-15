"use client";

import { ChoiceChip } from "@/components/ui/choice-chip";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { ModeCards } from "@/components/setup/mode-cards";
import { JobDescriptionPicker } from "@/components/setup/job-description-picker";
import { ResumePicker } from "@/components/setup/resume-picker";
import type { InterviewSetupState, PracticeMode } from "@/lib/interview-setup";
import type { UseJobDescriptions } from "@/hooks/use-job-descriptions";
import type { UseResumes } from "@/hooks/use-resumes";

/**
 * Everything the interviewer needs before it can ask anything: how you want to
 * answer, what you are preparing for, and any documents that ground it.
 *
 * Merges what used to be two steps and half of a third. "Mode" was a whole step
 * spending two large gradient cards on a binary choice; the job description and
 * Resume pickers used to sit on the *last* step, which broke the round builder's
 * "Suggest from job description" button — it needed a JD collected two steps
 * after it.
 *
 * Each section is its own Card so every heading sits directly above the
 * controls it names, and each card has exactly one heading. The brief's card
 * used to be titled "Describe the role" over a field labelled "What are you
 * preparing for?" — two headings for one textarea. The question is the title
 * now, and the textarea carries it as its accessible name.
 *
 * The gap between cards lives on a root element here rather than being
 * inherited from the step container. This step used to return a fragment and
 * take whatever the parent gave it, which broke the moment anything was
 * inserted between the two: the transition wrapper became the container's only
 * child and the cards collapsed to no gap at all.
 */

export function ContextStep({
  setup,
  jobDescriptionLibrary,
  resumeLibrary,
  quickStarts,
  onUpdate,
  onModeChange,
}: {
  setup: InterviewSetupState;
  /**
   * The wizard's single job-description library instance, passed down rather
   * than mounted in the picker. Two `useJobDescriptions()` on one screen means
   * two copies of a mutable list, and adding a document updates only one of
   * them — which is how creating one in the wizard came to disable Continue.
   */
  jobDescriptionLibrary: UseJobDescriptions;
  /** Same reasoning, for resumes. */
  resumeLibrary: UseResumes;
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
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How you&apos;ll answer</CardTitle>
        </CardHeader>
        <CardContent>
          <ModeCards value={setup.practiceMode} onChange={onModeChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What are you preparing for?</CardTitle>
          <CardAction>
            {/* The one hint that survives here: it states a bar you have to
                clear, which nothing else on screen tells you. */}
            <span className="text-xs text-slate-500 tabular-nums">
              {charCount}/20 minimum
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          <Textarea
            id="interview-brief"
            aria-label="What are you preparing for?"
            value={brief}
            onChange={(event) =>
              onUpdate({ customScenarioBrief: event.target.value })
            }
            placeholder='e.g. "Senior data analyst at a mid-size SaaS company. Expecting questions on SQL, dashboards, stakeholder communication, and a behavioural round on cross-team conflict."'
            className="min-h-32 resize-y leading-6"
          />

          <div className="space-y-2">
            <p className={PANEL_LABEL}>Or start from a template</p>
            <div className="flex flex-wrap gap-2">
              {quickStarts.map((chip) => {
                const isActive = brief.trim() === chip.template.trim();
                return (
                  <ChoiceChip
                    key={chip.id}
                    selected={isActive}
                    onClick={() =>
                      onUpdate({ customScenarioBrief: chip.template })
                    }
                  >
                    {chip.label}
                  </ChoiceChip>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* One card each. They are separate decisions with separate storage and
          separate API routes; sharing a card only made them look like one. */}
      <JobDescriptionPicker
        value={setup.jobDescription}
        onChange={(next) => onUpdate({ jobDescription: next })}
        library={jobDescriptionLibrary}
      />

      <ResumePicker
        value={setup.resume}
        onChange={(next) => onUpdate({ resume: next })}
        library={resumeLibrary}
      />
    </div>
  );
}
