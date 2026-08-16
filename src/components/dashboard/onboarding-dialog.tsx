"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  defaultsForGoal,
  isOnboardingComplete,
  markOnboardingComplete,
  type OnboardingGoal,
} from "@/lib/onboarding";
import {
  createDefaultInterviewSetup,
  saveInterviewSetup,
} from "@/lib/interview-setup";

const GOALS: Array<{
  id: OnboardingGoal;
  title: string;
  description: string;
}> = [
  {
    id: "job-interview",
    title: "Job interview prep",
    description: "Practice structured answers for role-specific questions.",
  },
  {
    id: "feedback",
    title: "Giving feedback",
    description: "Rehearse difficult feedback conversations with empathy.",
  },
  {
    id: "negotiation",
    title: "Negotiation",
    description: "Build confidence negotiating offers or scope.",
  },
  {
    id: "presentation",
    title: "Presenting ideas",
    description: "Practice stakeholder updates and pitches.",
  },
  {
    id: "custom",
    title: "Something else",
    description: "Describe your own scenario in the setup wizard.",
  },
];

export function OnboardingDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !isOnboardingComplete()) {
        setOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePick = (goal: OnboardingGoal) => {
    const defaults = defaultsForGoal(goal);
    const setup = {
      ...createDefaultInterviewSetup(),
      scenarioValue: defaults.scenarioValue,
      customScenarioBrief: defaults.customScenarioBrief,
      practiceMode: defaults.practiceMode,
    };
    saveInterviewSetup(setup);
    markOnboardingComplete(goal);
    setOpen(false);
    router.push(
      `/simulate/setup?mode=${defaults.practiceMode}&scenario=${defaults.scenarioValue}`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>What are you preparing for?</DialogTitle>
          <DialogDescription>
            We&apos;ll seed your first practice session. You can change
            everything in the setup wizard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {GOALS.map((goal) => (
            <Button
              key={goal.id}
              variant="outline"
              className="h-auto flex-col items-start gap-1 py-3 text-left"
              onClick={() => handlePick(goal.id)}
            >
              <span className="font-semibold text-slate-900">{goal.title}</span>
              <span className="text-xs font-normal text-slate-500">
                {goal.description}
              </span>
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            markOnboardingComplete();
            setOpen(false);
          }}
        >
          Skip for now
        </Button>
      </DialogContent>
    </Dialog>
  );
}
