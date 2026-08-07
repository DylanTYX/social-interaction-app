import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { CommandPalette } from "@/components/layout/command-palette";

/**
 * The application chrome: sidebar, mobile bottom nav, command palette.
 *
 * Lifted out of `dashboard/layout.tsx`, which was the only thing rendering it —
 * so every route under `/simulate` had no chrome at all. That was defensible for
 * the live interview and wrong for the other two:
 *
 *   - **The setup wizard.** Reaching it from a sidebar item changed the chrome
 *     as a side-effect of a *navigation* click, which reads as a bug.
 *   - **The session report.** You land there after every single session, read
 *     it, and want to go somewhere else — and its only exit was a back arrow.
 *     It is the page that was most wrongly stripped, and nobody noticed because
 *     the wizard is the one you click on purpose.
 *
 * The rule now: chrome on the pages you think on, none on the page you perform
 * on. `/simulate/chat`, `/voice` and `/loop` stay full-screen, so the seam falls
 * on "Begin interview" — a deliberate action — rather than on a nav click.
 *
 * A side-effect worth having: `CommandPalette` lived here too, so ⌘K was dead on
 * every `/simulate/*` route. It now works on setup and the report.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-screen flex bg-gray-50">
        <Sidebar />
        {/* `pb-20 lg:pb-0` clears the fixed mobile bar below `lg`. */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
        <MobileNav />
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}
