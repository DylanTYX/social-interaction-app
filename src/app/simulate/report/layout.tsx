import { AppShell } from "@/components/layout/app-shell";

/**
 * The report gets the app chrome.
 *
 * This is the page that most needed it. You land here after every session, read
 * scores and model answers, and then want to go somewhere — and the only exit
 * was a back arrow to the dashboard.
 */
export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
