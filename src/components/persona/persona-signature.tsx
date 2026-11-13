import { personaSignature } from "@/lib/interviewer-behaviour";
import type { PersonaConfig } from "@/lib/persona-engine";
import { cn } from "@/lib/utils";

/**
 * "How they interview": the two or three things this persona will do that a
 * typical interviewer will not, in words a candidate can listen for. Shared by
 * the card and the editor, so the summary on a card is always the one its
 * dials produce. See `personaSignature` for why only far-from-middle dials
 * count.
 */
export function PersonaSignature({
  config,
  className,
}: {
  config: PersonaConfig;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-foreground">How they interview</p>
      <ul className="list-disc space-y-0.5 pl-4 text-xs leading-5 text-muted-foreground">
        {personaSignature(config).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
