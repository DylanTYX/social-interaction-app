import { AppShell } from "@/components/layout/app-shell";

/**
 * The loop report is a page you read and leave, like the session report, so
 * it gets the app chrome: without this layout it rendered with no sidebar and
 * a back arrow as its only exit. See `report/layout.tsx`.
 */
export default function LoopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
