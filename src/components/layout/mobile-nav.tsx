"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Dumbbell,
  FileText,
  FileUser,
  History,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The bottom bar below `lg`, where the sidebar is not rendered.
 *
 * Four destinations and "More". The sidebar lists nine, and the five that did
 * not fit here — drills, personas, job descriptions, resumes, tips — had no way
 * in on a phone at all: the sidebar is `hidden lg:flex` and the ⌘K palette has
 * no touch trigger, so they were reachable only through links that happened to
 * exist on other pages. "More" is the way in, and it carries the search as
 * well, since that is the palette's only mobile entry point.
 */
const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/sessions", label: "Sessions", icon: History },
  { href: "/simulate/setup", label: "New interview", icon: Plus },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

/** Everything in the sidebar that is not a tab. Same order as the sidebar. */
const MORE = [
  { href: "/dashboard/drills", label: "Quick drills", icon: Dumbbell },
  { href: "/dashboard/personas", label: "Personas", icon: Users },
  { href: "/dashboard/job-descriptions", label: "Job descriptions", icon: FileText },
  { href: "/dashboard/resumes", label: "Resumes", icon: FileUser },
  { href: "/dashboard/help", label: "Tips & guides", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const TAB =
  "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-center text-[10px] leading-tight font-medium transition-colors";

export function MobileNav() {
  const pathname = usePathname();
  const moreActive = MORE.some((item) => isNavItemActive(pathname, item.href));

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          // Shared with the sidebar. The identical copy this replaced lit
          // "Home" on every dashboard sub-page alongside the real one.
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(TAB, active ? "text-primary" : "text-slate-500")}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More pages"
              className={cn(
                TAB,
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted",
                moreActive ? "text-primary" : "text-slate-500",
              )}
            >
              <MoreHorizontal
                className="h-5 w-5"
                strokeWidth={moreActive ? 2.25 : 1.75}
              />
              More
            </button>
          </DropdownMenuTrigger>
          {/* Opens upward from the bar, so the list sits over the page rather
              than under the bottom edge of the screen. */}
          <DropdownMenuContent side="top" align="end" sideOffset={10} className="w-56">
            {MORE.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={cn(active && "text-primary")}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => window.dispatchEvent(new Event("open-command-palette"))}
            >
              <Search className="h-4 w-4" />
              Search…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
