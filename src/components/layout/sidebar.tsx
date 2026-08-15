"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { useSidebar } from "./sidebar-context";
import {
  useCurrentUser,
  getDisplayName,
  getInitials,
} from "@/hooks/use-current-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MessageSquare,
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
 * Destinations only.
 *
 * "Interview practice" used to sit second here, which weighted the app's whole
 * purpose the same as Settings and made a verb look like a place. It is now a
 * pinned action above the list.
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
    name: "Resumes",
    href: "/dashboard/resumes",
    icon: FileUser,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
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

/**
 * Sidebar collapse toggle button
 * Positioned at the vertical center of the sidebar edge for maximum discoverability
 * Uses semantic panel icons instead of chevrons for clearer intent
 */
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
            // Positioning: vertically centered on sidebar edge
            "absolute -right-3 top-1/2 -translate-y-1/2 z-20",
            // Size and shape
            "h-6 w-6 rounded-full",
            // Visual style
            "bg-white border border-gray-200 shadow-soft",
            // Flexbox centering
            "flex items-center justify-center",
            // Hover and active states
            "hover:bg-gray-50 hover:border-gray-300 hover:shadow-soft-md",
            "active:scale-95 active:bg-gray-100",
            // Focus states (accessibility)
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            // Transitions
            "transition-all duration-200 ease-out",
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5 text-gray-500",
              "transition-colors duration-150",
              "group-hover:text-gray-700",
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

/**
 * Navigation item component with tooltip support when collapsed
 */
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
        // Base layout. `overflow-hidden` so the label has something to be
        // clipped by as it collapses; `gap-0` when collapsed so the label's
        // vanished width does not leave 12px of dead space beside the icon.
        "flex items-center rounded-lg px-3 py-2.5 overflow-hidden",
        isCollapsed ? "gap-0" : "gap-3",
        "transition-[gap,padding] duration-300 ease-soft",
        // Typography
        "text-sm font-medium",
        // Centering when collapsed
        isCollapsed && "justify-center px-2",
        // Active state
        isActive && [
          "bg-blue-50 text-blue-700",
          "shadow-soft border border-blue-100",
        ],
        // Inactive state with hover
        !isActive && ["text-gray-600", "hover:bg-gray-50 hover:text-gray-900"],
        // Transition
        "transition-all duration-150",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          "transition-colors duration-150",
          isActive ? "text-blue-600" : "text-gray-500",
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

  const initials = getInitials(user);
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
          // Layout — hidden on phones; use MobileNav instead
          "relative hidden lg:flex h-full flex-col",
          // Visual style
          "bg-white border-r border-gray-200/80 shadow-soft",
          // Width with smooth transition
          isCollapsed ? "w-16" : "w-64",
          // Transition (applies to width change)
          "transition-[width] duration-300 ease-out",
        )}
        aria-label="Main navigation"
      >
        {/* Collapse Toggle - centered on sidebar edge */}
        <CollapseToggle isCollapsed={isCollapsed} onToggle={toggleSidebar} />

        {/* Logo Section */}
        <div
          className={cn(
            "flex h-16 items-center overflow-hidden border-b border-gray-100",
            "transition-all duration-300",
            isCollapsed ? "justify-center gap-0 px-2" : "gap-3 px-4",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center shrink-0",
              "h-9 w-9 rounded-xl",
              "bg-linear-to-br from-blue-600 via-purple-600 to-indigo-600",
              "shadow-lg shadow-blue-600/25",
            )}
          >
            <MessageSquare className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span
            className={cn(
              "truncate text-lg font-bold text-gray-900",
              "transition-[max-width,opacity] duration-300 ease-soft",
              isCollapsed ? "max-w-0 opacity-0" : "max-w-48 opacity-100",
            )}
          >
            ConvoTrainer
          </span>
        </div>

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
            className="w-full gap-2"
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

        {/* Command palette trigger */}
        <div className="p-2 pb-0">
          <button
            type="button"
            data-tour="search"
            onClick={() =>
              window.dispatchEvent(new Event("open-command-palette"))
            }
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-500",
              "hover:bg-gray-100 hover:text-gray-700 transition-colors duration-150",
              isCollapsed && "justify-center px-2",
            )}
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4 shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">Search…</span>
                <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Main Navigation */}
        <nav
          className="flex-1 p-2 space-y-1 overflow-y-auto"
          aria-label="Primary"
          data-tour="nav"
        >
          {navigation.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Bottom Navigation */}
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

        {/* User Section */}
        <div className="border-t border-gray-100 p-2">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg p-2",
              "transition-colors duration-150",
              isCollapsed && "justify-center",
            )}
          >
            <Link
              href="/dashboard/settings"
              className={cn(
                "flex items-center justify-center shrink-0",
                "h-8 w-8 rounded-lg",
                "bg-linear-to-br from-blue-600 via-purple-600 to-indigo-600",
                "text-white text-xs font-semibold",
                "shadow-md shadow-indigo-600/25",
                "hover:opacity-90 transition-opacity",
              )}
              aria-label="Account settings"
            >
              {initials}
            </Link>
            {!isCollapsed && (
              <>
                <Link
                  href="/dashboard/settings"
                  className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{subline}</p>
                </Link>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className={cn(
                        "p-1.5 rounded-md",
                        "text-muted-foreground hover:text-foreground hover:bg-gray-100",
                        "transition-colors duration-150",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
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
