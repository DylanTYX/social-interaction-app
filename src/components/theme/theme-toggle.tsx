"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/**
 * Compact light/dark switch. Renders a stable placeholder until mounted so SSR
 * and the first client paint match (the real theme is applied pre-paint by the
 * inline script in the root layout).
 */
export function ThemeToggle({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex items-center gap-2 rounded-lg text-gray-500 transition-colors",
        "hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:text-gray-400 dark:hover:text-gray-200",
        showLabel ? "px-3 py-2 text-sm font-medium" : "h-9 w-9 justify-center",
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      {showLabel && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
