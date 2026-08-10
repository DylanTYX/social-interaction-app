"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        // `transition-transform`, not `transition-all`: the only animated
        // property here is the translate, and `all` also watches the
        // background, which makes a theme change animate for no reason. The
        // duration was unstated too, so the bar snapped across in Tailwind's
        // 150ms default regardless of how far it had to travel.
        className="bg-primary h-full w-full flex-1 transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
