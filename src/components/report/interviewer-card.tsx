import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PersonaSignature } from "@/components/persona/persona-signature";
import { describeMoves, summariseMoves } from "@/lib/interviewer-behaviour";
import type { PersonaConfig } from "@/lib/persona-engine";

/**
 * What the interviewer actually did this round, beside what it was set to do.
 *
 * The persona's dials changed the questions by amounts a blind judge could
 * measure but a candidate could not always hear. The
 * engine already stores the move it chose after every scored answer, so the
 * report can say it plainly: "pushed for specifics 3 times, changed topic
 * twice". Two rounds with different interviewers then differ on the page, not
 * only in the transcript.
 */
export function InterviewerCard({
  personaName,
  personaConfig,
  strategies,
}: {
  personaName: string;
  personaConfig: PersonaConfig | null | undefined;
  strategies: readonly (string | null)[];
}) {
  const moves = describeMoves(summariseMoves(strategies));
  if (!personaConfig && !moves) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          How {personaName} interviewed you
        </CardTitle>
        <CardDescription>
          {moves ??
            "No scored answers this round, so there are no moves to count."}
        </CardDescription>
      </CardHeader>
      {personaConfig && (
        <CardContent>
          <PersonaSignature config={personaConfig} />
        </CardContent>
      )}
    </Card>
  );
}
