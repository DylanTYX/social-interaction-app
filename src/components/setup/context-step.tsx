"use client";

import { ChoiceChip } from "@/components/ui/choice-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
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
 * Each section is now its own Card so every heading sits directly above the
 * controls it names. The previous version wrapped all three in one card under a
 * step-level title and description, which meant the step's question got asked
 * twice: once as a container label with nothing to type into, and again as the
 * heading above the actual textarea. The first one looked broken because it
 * was labelling a box, not asking anything.
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
      <Card className="border border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">
            How do you want to answer?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ModeCards value={setup.practiceMode} onChange={onModeChange} />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Describe the role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field
            label="What are you preparing for?"
            htmlFor="interview-brief"
            aside={
              // The one hint that survives here: it states a bar you have to
              // clear, which nothing else on screen tells you.
              <span className="text-xs tabular-nums text-muted-foreground">
                {charCount}/20 minimum
              </span>
            }
          >
            <Textarea
              id="interview-brief"
              value={brief}
              onChange={(event) =>
                onUpdate({ customScenarioBrief: event.target.value })
              }
              placeholder='e.g. "Senior data analyst at a mid-size SaaS company. Expecting questions on SQL, dashboards, stakeholder communication, and a behavioural round on cross-team conflict."'
              className="min-h-32 resize-y leading-6"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Or start from a template
            </p>
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
