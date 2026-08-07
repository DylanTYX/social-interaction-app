import { AppShell } from "@/components/layout/app-shell";

/**
 * The wizard gets the app chrome.
 *
 * It is a page you think on — you compare interviewers, read example questions,
 * attach documents — so stripping the sidebar made arriving here feel like a
 * mode change triggered by a navigation click. The interview itself stays
 * full-screen, which puts the seam on "Begin interview" instead.
 */
export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
