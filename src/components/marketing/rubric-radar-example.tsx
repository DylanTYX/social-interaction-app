"use client";

import {
  buildRadarAxes,
  DimensionRadar,
} from "@/components/report/dimension-radar";
import { EXAMPLE_ANALYSES } from "@/components/marketing/landing-examples";

/**
 * The report's dimension profile for the example round, drawn by the report's
 * own component. A client component only because `buildRadarAxes` lives in
 * one, and a server component cannot call a client module's functions.
 */
export function RubricRadarExample() {
  const axes = buildRadarAxes(EXAMPLE_ANALYSES, false);
  if (!axes) return null;
  return (
    <DimensionRadar axes={axes} className="mx-auto h-auto w-full max-w-xs" />
  );
}
