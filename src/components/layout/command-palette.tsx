"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Dumbbell,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  keywords?: string;
}

const COMMANDS: Command[] = [
  { id: "text", label: "Start a text interview", icon: MessageSquare, href: "/simulate/setup?mode=text", keywords: "practice chat new" },
  { id: "voice", label: "Start a voice interview", icon: Mic, href: "/simulate/setup?mode=voice", keywords: "practice speak new" },
  { id: "drill", label: "Quick drill", hint: "One question", icon: Dumbbell, href: "/dashboard/drills", keywords: "practice question" },
  { id: "dashboard", label: "Go to dashboard", icon: LayoutDashboard, href: "/dashboard", keywords: "home" },
  { id: "sessions", label: "Your sessions", icon: History, href: "/dashboard/sessions", keywords: "history transcripts" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/dashboard/analytics", keywords: "stats progress trends" },
  { id: "personas", label: "Personas", icon: Users, href: "/dashboard/personas", keywords: "interviewer style" },
  { id: "jds", label: "Job descriptions", icon: FileText, href: "/dashboard/job-descriptions", keywords: "jd role upload" },
  { id: "setup", label: "Interview setup", icon: Sparkles, href: "/simulate/setup", keywords: "configure" },
  { id: "settings", label: "Settings", icon: Settings, href: "/dashboard/settings", keywords: "account preferences" },
];

/**
 * Global command palette. Opens with ⌘K / Ctrl+K (or "/" when not typing).
 * Built on the existing Dialog primitive with a filtered, keyboard-navigable
 * list — no extra dependency.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPalette = () => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      openPalette();
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCmdK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const isSlash = event.key === "/" && !isTyping;

      if (isCmdK || isSlash) {
        event.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setQuery("");
            setActiveIndex(0);
          }
          return !prev;
        });
      }
    };

    // Allow non-keyboard triggers (e.g. the sidebar search button) to open it.
    const onOpenEvent = () => openPalette();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenEvent);
    };
    // Listeners only need to bind once on mount.
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((command) =>
      `${command.label} ${command.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [query]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[activeIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-gray-200/80 px-4">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onListKeyDown}
            placeholder="Search actions…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              No matching actions.
            </p>
          ) : (
            results.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  onClick={() => run(command)}
                  onMouseMove={() => setActiveIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    index === activeIndex
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      index === activeIndex ? "text-blue-600" : "text-gray-400",
                    )}
                  />
                  <span className="flex-1 font-medium">{command.label}</span>
                  {command.hint && (
                    <span className="text-xs text-gray-400">
                      {command.hint}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
