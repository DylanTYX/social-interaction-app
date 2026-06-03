"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { useCurrentUser, getDisplayName, getInitials } from "@/hooks/use-current-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MessageSquare,
  LayoutDashboard,
  BarChart3,
  FileText,
  Users,
  Settings,
  Sparkles,
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
import { ThemeToggle } from "@/components/theme/theme-toggle";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Interview practice",
    href: "/simulate/setup",
    icon: Sparkles,
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
        // Base layout
        "flex items-center gap-3 rounded-lg px-3 py-2.5",
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
      {!isCollapsed && <span className="truncate">{item.name}</span>}
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

  const isNavItemActive = (href: string) => {
    if (pathname === href) {
      return true;
    }

    return pathname.startsWith(`${href}/`);
  };

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
            "flex h-16 items-center border-b border-gray-100",
            "transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "gap-3 px-4",
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
          {!isCollapsed && (
            <span className="text-lg font-bold text-gray-900 truncate">
              ConvoTrainer
            </span>
          )}
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
                <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
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
              isActive={isNavItemActive(item.href)}
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
              isActive={isNavItemActive(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
          <div className={cn(isCollapsed && "flex justify-center")}>
            <ThemeToggle
              showLabel={!isCollapsed}
              className={cn(!isCollapsed && "w-full")}
            />
          </div>
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
                        "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
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
