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
      {/*
        One scrollbar, inside `main`. The classes below are what keep it that
        way — each closes a different route to a second one:

          - `overflow-hidden` + `relative`: nothing, positioned or not, can
            grow the shell or escape it to the document.
          - `min-h-0` + `h-dvh` on `main`: it sizes to the screen, not to
            its content, and still scrolls if the flex stretch never lands.
          - `h-dvh`, not `h-screen`: on a phone `100vh` is the height *behind* the
            browser bar, so a `100vh` shell ran under it and the bottom of the page
            was unreachable. `dvh` is the height actually visible.
          - `overscroll-contain`: reaching the end stops there instead of
            chaining the leftover scroll to the page behind.
          - `data-app-shell`: `globals.css` locks document scrolling on pages
            that render this, so anything injected outside it cannot scroll
            either.
      */}
      <div
        data-app-shell
        className="relative h-dvh flex overflow-hidden bg-white"
      >
        <Sidebar />
        {/* `pb-20 lg:pb-0` clears the fixed mobile bar below `lg`. */}
        <main className="h-dvh min-h-0 flex-1 overflow-y-auto overscroll-contain pb-20 lg:pb-0">
          {children}
        </main>
        <MobileNav />
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}
