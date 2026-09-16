"use client";

import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A turn that failed, in the transcript where it failed.
 *
 * Red, because this one stands: the answer is not recorded and the interviewer
 * is not replying until something is done about it. Where the answer itself
 * survives — a request that never reached the server — the card carries it and
 * offers to send it again, so a dropped connection costs a tap rather than the
 * whole answer.
 *
 * Both interview screens render it. The voice screen passes an unsent answer;
 * the text screen has the composer's own contents to fall back on and passes
 * none.
 */
export function TurnErrorCard({
  message,
  unsentAnswer,
  isSending = false,
  onSendAgain,
}: {
  message: string;
  /** The answer to offer again, verbatim. */
  unsentAnswer?: string | null;
  isSending?: boolean;
  onSendAgain?: () => void;
}) {
  const canResend = Boolean(unsentAnswer && onSendAgain);

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-3 text-sm text-destructive-emphasis"
    >
      <p className="font-medium">
        {canResend ? "Your answer wasn't sent" : "Something went wrong"}
      </p>
      <p className="mt-0.5">{message}</p>
      {canResend && (
        <>
          {/* Their own words, so "send again" is a known quantity rather than
              a guess at what is about to be sent. */}
          <p className="mt-2 line-clamp-2 text-destructive-emphasis/80 italic">
            &ldquo;{unsentAnswer}&rdquo;
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2.5 border-destructive-border bg-white text-destructive-emphasis hover:bg-destructive-muted hover:text-destructive-emphasis"
            disabled={isSending}
            onClick={onSendAgain}
          >
            <RotateCw />
            {isSending ? "Sending…" : "Send again"}
          </Button>
        </>
      )}
    </div>
  );
}
