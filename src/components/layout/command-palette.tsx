"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Compass,
  Dumbbell,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Search,
  Settings,
  ShieldCheck,
  Database,
  FileUser,
  BookOpen,
  Plus,
  Users,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { START_TOUR_EVENT, TOUR_HREF } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type CommandGroup = "start" | "pages" | "library" | "help";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** Also fired on run, for a page that is already open and needs a nudge. */
  event?: string;
  group: CommandGroup;
  keywords?: string;
}

/**
 * The same groups as the sidebar, plus the ways to start something, so the
 * palette reads as the sidebar you can type into.
 */
const GROUPS: { id: CommandGroup; label: string }[] = [
  { id: "start", label: "Start" },
  { id: "pages", label: "Go to" },
  { id: "library", label: "Library" },
  { id: "help", label: "Help and settings" },
];

/**
 * In group order, because the arrow keys walk this array: the order on screen
 * and the order the keys move through must be the same list.
 *
 * Labels are the app's own names. The group heading carries the verb, so a row
 * says "Sessions" under "Go to" rather than "Your sessions"; the old phrasings
 * stay as keywords so typing them still finds the row.
 */
const COMMANDS: Command[] = [
  {
    id: "setup",
    label: "New interview",
    icon: Plus,
    href: "/simulate/setup",
    group: "start",
    keywords: "configure setup start practice",
  },
  {
    id: "voice",
    label: "Voice interview",
    icon: Mic,
    href: "/simulate/setup?mode=voice",
    group: "start",
    keywords: "start new practice speak",
  },
  {
    id: "text",
    label: "Text interview",
    icon: MessageSquare,
    href: "/simulate/setup?mode=text",
    group: "start",
    keywords: "start new practice chat type",
  },
  {
    id: "drill",
    label: "Quick drill",
    hint: "One question",
    icon: Dumbbell,
    href: "/dashboard/drills",
    group: "start",
    keywords: "practice question drills",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    group: "pages",
    keywords: "home go to",
  },
  {
    id: "sessions",
    label: "Sessions",
    icon: History,
    href: "/dashboard/sessions",
    group: "pages",
    keywords: "your history transcripts reports",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/dashboard/analytics",
    group: "pages",
    keywords: "stats progress trends",
  },
  {
    id: "personas",
    label: "Personas",
    icon: Users,
    href: "/dashboard/personas",
    group: "library",
    keywords: "interviewer style",
  },
  {
    id: "jds",
    label: "Job descriptions",
    icon: FileText,
    href: "/dashboard/job-descriptions",
    group: "library",
    keywords: "jd role upload",
  },
  {
    id: "resumes",
    label: "Resumes",
    icon: FileUser,
    href: "/dashboard/resumes",
    group: "library",
    // "cv" stays in the keywords, and only there: plenty of people will type
    // it looking for this page, and a search alias is not a claim that the two
    // documents are the same thing. Every label the user actually reads says
    // resume.
    keywords: "resume cv upload experience background",
  },
  {
    id: "help",
    label: "Tips & guides",
    icon: BookOpen,
    href: "/dashboard/help",
    group: "help",
    keywords: "guides star framework learn",
  },
  {
    id: "tour",
    label: "Take the tour",
    icon: Compass,
    href: TOUR_HREF,
    // Navigating to the dashboard runs the tour when it mounts. When the
    // dashboard is already open nothing remounts, so the event starts it.
    event: START_TOUR_EVENT,
    group: "help",
    keywords: "walkthrough onboarding introduction help getting started",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    group: "help",
    keywords: "account preferences",
  },
  // Reachable now that tab state lives in the URL. Password and the data
  // controls were four levels down and unaddressable before.
  {
    id: "account",
    label: "Account & security",
    icon: ShieldCheck,
    href: "/dashboard/settings?tab=account",
    group: "help",
    keywords: "password sign out session",
  },
  {
    id: "data",
    label: "Export or delete your data",
    icon: Database,
    href: "/dashboard/settings?tab=data",
    group: "help",
    keywords: "download backup wipe sessions",
  },
];

/** One key cap, used in the rows, the search bar and the footer. */
const KBD =
  "inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-200 bg-white px-1 font-sans text-[11px] leading-none font-medium text-slate-500";

/**
 * Global command palette. Opens with ⌘K / Ctrl+K (or "/" when not typing).
 * Built on the existing Dialog primitive with a filtered, keyboard-navigable
 * list — no extra dependency.
 *
 * It was one flat list of fourteen rows, a title-less box that moved as you
 * typed, and shortcuts you could only learn by accident. Now the rows sit in
 * the sidebar's groups, the box is anchored, and a footer names the keys.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  /** The filtered results under their headings, each keeping its flat index. */
  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: results
          .map((command, index) => ({ command, index }))
          .filter(({ command }) => command.group === group.id),
      })).filter((group) => group.items.length > 0),
    [results],
  );

  /**
   * Keep the highlighted row on screen. The list scrolls, and arrowing past its
   * last visible row used to move the highlight somewhere you could not see.
   */
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    router.push(command.href);
    if (command.event) window.dispatchEvent(new Event(command.event));
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
        // Anchored near the top rather than centred. Centred, the box shrank
        // around its middle as results filtered, so the search field you were
        // typing into moved up and down under your cursor.
        className="top-[14vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search pages and actions</DialogTitle>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onListKeyDown}
            placeholder="Search pages and actions…"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-autocomplete="list"
            aria-activedescendant={
              results[activeIndex]
                ? `command-${results[activeIndex].id}`
                : undefined
            }
            className="h-14 w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm"
          />
          <kbd className={cn(KBD, "hidden sm:inline-flex")}>esc</kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Pages and actions"
          className="max-h-[min(24rem,56vh)] overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                Nothing matches &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try a page name, such as Sessions or Resumes.
              </p>
            </div>
          ) : (
            grouped.map((group, groupIndex) => (
              <div
                key={group.id}
                role="group"
                aria-labelledby={`command-group-${group.id}`}
                className={cn(groupIndex > 0 && "mt-2")}
              >
                <p
                  id={`command-group-${group.id}`}
                  className={cn(PANEL_LABEL, "px-3 pt-2 pb-1.5")}
                >
                  {group.label}
                </p>
                {group.items.map(({ command, index }) => {
                  const Icon = command.icon;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={command.id}
                      id={`command-${command.id}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      tabIndex={-1}
                      data-index={index}
                      onClick={() => run(command)}
                      onMouseMove={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
                        active
                          ? "bg-primary-subtle text-primary-emphasis"
                          : "text-slate-700",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary" : "text-slate-400",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {command.label}
                      </span>
                      {command.hint && (
                        <span className="text-xs text-slate-500">
                          {command.hint}
                        </span>
                      )}
                      {/* Always in the row, only visible on the active one, so
                          moving the highlight never shifts the hint beside it. */}
                      <kbd
                        aria-hidden
                        className={cn(KBD, !active && "invisible")}
                      >
                        ↵
                      </kbd>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* The shortcuts, where they are used. This is the only place the app
            tells you that "/" opens the palette too. */}
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className={KBD}>↑</kbd>
              <kbd className={KBD}>↓</kbd>
              Move
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className={KBD}>↵</kbd>
              Open
            </span>
          </div>
          <span className="hidden items-center gap-1.5 sm:flex">
            Open anywhere with
            <kbd className={KBD}>⌘K</kbd>
            or
            <kbd className={KBD}>/</kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
