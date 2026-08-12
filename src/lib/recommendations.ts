import type { InterviewSessionSummary } from "@/hooks/use-interview-history";

export interface SessionRecommendation {
  id: string;
  title: string;
  description: string;
  href: string;
  reason: string;
  accent: "blue" | "purple" | "indigo" | "green" | "orange";
}

function daysSince(iso: string): number {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 0;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

/**
 * Picks one concrete next step from interview history — weakest scenario,
 * longest gap, voice mode never tried, or a sensible default.
 */
export function getSuggestedNextSession(
  sessions: InterviewSessionSummary[],
  options?: {
    /** `undefined` means "not known" — e.g. the library failed to load. */
    hasJobDescriptions?: boolean;
    hasVoiceSessions?: boolean;
  },
): SessionRecommendation | null {
  // Unknown is treated as "no", which only ever costs the user an *extra*
  // suggestion — never a wrong one.
  const hasJds = options?.hasJobDescriptions ?? false;
  const hasVoice = options?.hasVoiceSessions ?? false;

  if (sessions.length === 0) {
    return {
      id: "first-session",
      title: "Start your first practice interview",
      description:
        "Write a quick brief, pick an interviewer, and start — text mode is the fastest way in.",
      href: "/simulate/setup?mode=text",
      reason: "You have not completed a session yet.",
      accent: "blue",
    };
  }

  const inProgress = sessions.find((s) => s.status === "in_progress");
  if (inProgress) {
    const path =
      inProgress.practiceMode === "voice"
        ? `/simulate/voice?session=${inProgress.id}`
        : `/simulate/chat?session=${inProgress.id}`;
    return {
      id: "resume",
      title: `Continue: ${inProgress.scenarioTitle ?? inProgress.scenarioValue}`,
      description: `Pick up your in-progress ${inProgress.practiceMode} session with ${inProgress.personaName}.`,
      href: path,
      reason: "You have an interview still in progress.",
      accent: "orange",
    };
  }

  if (hasJds && !hasVoice) {
    return {
      id: "voice-jd",
      title: "Try a voice interview with your job description",
      description:
        "You have saved role context — practice answering out loud with JD-aware questions.",
      href: "/simulate/setup?mode=voice",
      reason: "Job descriptions work best when you practice speaking.",
      accent: "indigo",
    };
  }

  const scored = sessions.filter(
    (s): s is InterviewSessionSummary & { averageScore: number } =>
      typeof s.averageScore === "number",
  );

  if (scored.length > 0) {
    const byScenario = new Map<
      string,
      { title: string; scores: number[]; lastAt: string }
    >();

    for (const session of scored) {
      const key = session.scenarioValue;
      const title = session.scenarioTitle ?? session.scenarioValue;
      const bucket = byScenario.get(key) ?? {
        title,
        scores: [],
        lastAt: session.createdAt,
      };
      bucket.scores.push(session.averageScore);
      if (Date.parse(session.createdAt) > Date.parse(bucket.lastAt)) {
        bucket.lastAt = session.createdAt;
      }
      byScenario.set(key, bucket);
    }

    let weakest: {
      key: string;
      title: string;
      avg: number;
      lastAt: string;
    } | null = null;

    for (const [key, bucket] of byScenario.entries()) {
      const avg =
        bucket.scores.reduce((sum, value) => sum + value, 0) /
        bucket.scores.length;
      if (!weakest || avg < weakest.avg) {
        weakest = { key, title: bucket.title, avg, lastAt: bucket.lastAt };
      }
    }

    if (weakest && weakest.avg < 80) {
      return {
        id: "weakest-scenario",
        title: `Improve on: ${weakest.title}`,
        description: `Your average here is ${Math.round(weakest.avg)}%. Another round will help you close the gap.`,
        href: "/simulate/setup",
        reason: "This scenario has your lowest average score.",
        accent: "purple",
      };
    }

    let stalest: { key: string; title: string; days: number } | null = null;
    for (const [key, bucket] of byScenario.entries()) {
      const days = daysSince(bucket.lastAt);
      if (!stalest || days > stalest.days) {
        stalest = { key, title: bucket.title, days };
      }
    }

    if (stalest && stalest.days >= 7) {
      return {
        id: "stale-scenario",
        title: `Revisit: ${stalest.title}`,
        description: `It has been ${stalest.days} days since you practiced this — a quick refresh keeps skills sharp.`,
        href: "/simulate/setup",
        reason: "Longest gap since you last practiced this scenario.",
        accent: "green",
      };
    }
  }

  const last = sessions[0];
  if (last?.practiceMode === "text") {
    return {
      id: "try-voice",
      title: "Switch to voice mode",
      description:
        "You have been practicing in text — try speaking your answers aloud for a more realistic rehearsal.",
      href: "/simulate/setup?mode=voice",
      reason: "Adds variety and builds spoken confidence.",
      accent: "indigo",
    };
  }

  return {
    id: "new-session",
    title: "Start a fresh practice session",
    description: "Try a new scenario or persona to broaden your preparation.",
    href: "/simulate/setup",
    reason: "Keep your practice streak going.",
    accent: "blue",
  };
}
