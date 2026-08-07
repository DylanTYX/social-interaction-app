"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  Sparkles,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/sessions", label: "Sessions", icon: History },
  { href: "/simulate/setup", label: "Practice", icon: Sparkles },
  { href: "/dashboard/analytics", label: "Stats", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200/80 bg-white/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
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
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-blue-600" : "text-gray-500",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
