"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { useSidebar } from "./sidebar-context";
import { useCurrentUser, getDisplayName } from "@/hooks/use-current-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Users,
  Settings,
  Plus,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  History,
  Dumbbell,
  Search,
  BookOpen,
  FileUser,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Destinations only, in two groups, and only the second is labelled.
 *
 * "Interview practice" used to sit second here, which weighted the app's whole
 * purpose the same as Settings and made a verb look like a place. It is now a
 * pinned action above the list.
 *
 * The first group is the app itself: where you land, quick drills, your
 * sessions and the analytics that summarise them. Analytics used to sit last,
 * below Resumes, a whole library away from the Sessions it summarises.
 *
 * The second group is the material you prepare once and reuse in every interview.
 * It is labelled "Library" because that is already the word the app uses when
 * you save a persona ("Saved to your library"). The first group needs no label:
 * a heading reading "Practice" over Dashboard would name nothing new.
 */
const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Quick drills",
    href: "/dashboard/drills",
    icon: Dumbbell,
  },
  {
    name: "Sessions",
    href: "/dashboard/sessions",
    icon: History,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
];

const libraryNavigation = [
  {
    name: "Personas",
    href: "/dashboard/personas",
    icon: Users,
  },
  {
    name: "Job descriptions",
    href: "/dashboard/job-descriptions",
    icon: FileText,
  },
  {
    // Not "CVs". A CV is the long academic record; a resume is the short
    // targeted one, and the short one is what this app asks for.
    name: "Resumes",
    href: "/dashboard/resumes",
    icon: FileUser,
  },
];

const bottomNavigation = [
  {
    name: "Tips & guides",
    href: "/dashboard/help",
    icon: BookOpen,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

/** Panel icons rather than chevrons, which read as "scroll" rather than "collapse". */
function CollapseToggle({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const Icon = isCollapsed ? PanelLeft : PanelLeftClose;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onToggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 z-20",
            "h-6 w-6 rounded-full",
            "bg-white border border-slate-200 shadow-soft",
            "flex items-center justify-center",
            "hover:bg-slate-50 hover:border-slate-300 hover:shadow-soft-md",
            "active:scale-95 active:bg-slate-100",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "transition-all duration-200 ease-out",
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5 text-slate-500",
              "transition-colors duration-150",
              "group-hover:text-slate-700",
            )}
            strokeWidth={2}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      </TooltipContent>
    </Tooltip>
  );
}

function NavItem({
  item,
  isActive,
  isCollapsed,
}: {
  item: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  };
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center rounded-lg px-3 py-2.5 overflow-hidden",
        isCollapsed ? "gap-0" : "gap-3",
        "transition-[gap,padding] duration-300 ease-soft",
        "text-sm font-medium",
        isCollapsed && "justify-center px-2",
        // A lighter band and white text mark where you are, with the icon in
        // the wordmark's light blue. The light-blue tint used on a white
        // sidebar disappears on navy. Still a tint, not a bordered chip.
        isActive && "bg-white/10 text-white",
        !isActive && ["text-slate-300", "hover:bg-white/5 hover:text-white"],
        "transition-all duration-150",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          "transition-colors duration-150",
          isActive ? "text-blue-300" : "text-slate-400",
        )}
        strokeWidth={isActive ? 2.25 : 1.75}
      />
      {/* Always mounted, never `aria-hidden`. The sidebar animates its width
          over 300ms but this used to unmount, so the labels vanished in one
          frame while the panel was still moving — and a collapsed link was
          left with no accessible name at all, since lucide icons render a bare
          <svg> and the tooltip only contributes aria-describedby. Collapsing
          the width instead fixes both: the text slides away with the panel, and
          screen readers still get a name in either state. */}
      <span
        className={cn(
          "truncate transition-[max-width,opacity] duration-300 ease-soft",
          isCollapsed ? "max-w-0 opacity-0" : "max-w-48 opacity-100",
        )}
      >
        {item.name}
      </span>
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="font-medium">
          {item.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { user } = useCurrentUser();

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  const displayName = getDisplayName(user);
  const subline = user?.email ?? "Signed in";

  // Shared with the mobile nav, and tested. The local copy this replaced lit
  // "Dashboard" on every dashboard sub-page, because `/dashboard` is a prefix
  // of all of them — two items active at once.
  const isActive = (href: string) => isNavItemActive(pathname, href);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative hidden lg:flex h-full flex-col",
          // Navy, the brand's dark: the same surface as the sign-in panel and
          // the landing page's closing band, so the app is framed by the
          // colour you just walked through. It also gives an otherwise white
          // screen one dark anchor, which keeps the content area reading as
          // the work surface. Every state below is drawn for a dark ground.
          "bg-navy",
          isCollapsed ? "w-16" : "w-64",
          "transition-[width] duration-300 ease-out",
        )}
        aria-label="Main navigation"
      >
        <CollapseToggle isCollapsed={isCollapsed} onToggle={toggleSidebar} />

        {/* The wordmark, set exactly as the landing page sets it. Collapsed,
            it keeps its two colours as initials rather than turning into an
            icon tile with a glow. */}
        <div
          className={cn(
            "flex h-16 items-center overflow-hidden border-b border-white/10",
            "transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <Link
            href="/dashboard"
            aria-label="ConvoTrainer, go to dashboard"
            className="font-display text-xl font-bold tracking-[-0.02em] whitespace-nowrap text-white"
          >
            {isCollapsed ? (
              <>
                C<span className="text-blue-300">T</span>
              </>
            ) : (
              <>
                Convo<span className="text-blue-300">Trainer</span>
              </>
            )}
          </Link>
        </div>

        {/* Things you do, separated from the places you go. Without the rule
            the search box reads as the first item of the nav list. */}
        <div className="border-b border-white/10 pb-3">
          {/* The one thing this app is for.

              A sidebar lists places you go and return to with state; starting an
              interview is a verb that produces a session. Pinning it as an action
              above the destinations is the Linear/Notion pattern for creation.

              The mobile bar keeps its Practice tab. The sidebar is `hidden
              lg:flex`, so dropping it there too would leave no way to start an
              interview below `lg` — which is exactly the regression an earlier
              attempt at this shipped. */}
          <div className="p-2 pb-0">
            <Button
              asChild
              // No gap when collapsed. The label shrinks to zero width but a
              // flex gap is still spent beside it, which pushed the plus 4px
              // left of centre and left the button looking wider on the right.
              // `NavItem` drops its gap the same way.
              className={cn(
                "w-full transition-[gap,background-color] duration-300 ease-soft",
                isCollapsed ? "gap-0" : "gap-2",
              )}
              size={isCollapsed ? "icon" : "default"}
            >
              <Link
                href="/simulate/setup"
                aria-label="Start a new interview"
                className="overflow-hidden"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    "truncate transition-[max-width,opacity] duration-300 ease-soft",
                    isCollapsed ? "max-w-0 opacity-0" : "max-w-48 opacity-100",
                  )}
                >
                  New interview
                </span>
              </Link>
            </Button>
          </div>

          <div className="p-2 pb-0">
            <button
              type="button"
              data-tour="search"
              onClick={() =>
                window.dispatchEvent(new Event("open-command-palette"))
              }
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400",
                "hover:bg-white/10 hover:text-white transition-colors duration-150",
                isCollapsed && "justify-center px-2",
              )}
              aria-label="Open command palette"
            >
              <Search className="h-4 w-4 shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">Search…</span>
                  <kbd className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
          </div>
        </div>

        <nav
          className="flex-1 overflow-y-auto p-2 pt-3"
          aria-label="Primary"
          data-tour="nav"
        >
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>

          <div
            role="group"
            aria-labelledby="sidebar-library-label"
            className={cn("space-y-1", isCollapsed ? "mt-3" : "mt-6")}
          >
            {/* Collapsed, the words cannot fit, so a hairline marks the
                boundary instead. The label stays in the accessibility tree
                either way, so the group keeps its name. */}
            <p
              id="sidebar-library-label"
              className={cn(
                PANEL_LABEL,
                "px-3 pb-1 text-slate-400",
                isCollapsed && "sr-only",
              )}
            >
              Library
            </p>
            {isCollapsed && (
              <div className="mx-2 mb-3 border-t border-white/10" aria-hidden />
            )}
            {libraryNavigation.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </nav>

        <div className="p-2 space-y-1" aria-label="Secondary">
          {bottomNavigation.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        <div className="border-t border-white/10 p-2">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg p-2",
              "transition-colors duration-150",
              isCollapsed && "justify-center",
            )}
          >
            <Link
              href="/dashboard/settings"
              className="shrink-0 rounded-full transition-opacity hover:opacity-90"
              aria-label="Account settings"
            >
              {/* Your avatar is navy everywhere else, which would vanish
                  here, so on the sidebar it inverts to white with navy
                  initials. */}
              <InitialsAvatar
                name={displayName}
                size="sm"
                tone="you"
                className="bg-white text-navy"
              />
            </Link>
            {!isCollapsed && (
              <>
                <Link
                  href="/dashboard/settings"
                  className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <p className="text-sm font-medium text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{subline}</p>
                </Link>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className={cn(
                        "p-1.5 rounded-md",
                        "text-slate-400 hover:text-white hover:bg-white/10",
                        "transition-colors duration-150",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      )}
                      aria-label="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
