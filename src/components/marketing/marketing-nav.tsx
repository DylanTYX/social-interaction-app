"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MarketingNavLink {
  /** The id of the section the link scrolls to. */
  id: string;
  label: string;
}

interface MarketingNavProps {
  links: MarketingNavLink[];
}

/**
 * The landing page header. Three roles, three positions: the brand on the
 * left, page navigation centred as plain text with an active state, and the
 * two account actions on the right as a button pair. The active state is what
 * marks the centre links as navigation rather than actions.
 *
 * The active section is computed directly on every scroll rather than with an
 * IntersectionObserver: the section straddling a reading line a third of the
 * way down the viewport wins, and nothing is active while the hero or the
 * closing band is there. Observers only fire on edge crossings, which is what
 * made the earlier version stick on the wrong link after a jump.
 */
export function MarketingNav({ links }: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      setScrolled(window.scrollY > 8);
      const line = window.innerHeight * 0.35;
      let found: string | null = null;
      for (const { id } of links) {
        const section = document.getElementById(id);
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        if (rect.top <= line && rect.bottom > line) {
          found = id;
          break;
        }
      }
      setActive(found);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [links]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-white/85 backdrop-blur-xl transition-colors duration-200",
        scrolled ? "border-slate-200" : "border-transparent",
      )}
    >
      <div className="mx-auto grid h-[68px] max-w-[1180px] grid-cols-[auto_1fr] items-center gap-6 px-6 md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="#top"
          className="font-display text-[22px] font-bold tracking-[-0.02em] text-navy"
        >
          Convo<span className="text-primary">Trainer</span>
        </Link>

        <nav
          aria-label="Page sections"
          className="hidden items-center justify-center gap-0.5 md:flex"
        >
          {links.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-[14.5px] font-medium transition-colors duration-150",
                  "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
                  isActive
                    ? "text-primary after:opacity-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {label}
              </a>
            );
          })}
        </nav>

        {/* Two different doors, so they are named and weighted differently.
            "Sign in" is for an account you already have and is the quiet one;
            "Create account" is for a new one and is the filled one. The filled
            button used to say "Get started", which never said it made an
            account, so the pair read as two ways to do the same thing. The
            words match the auth pages exactly. */}
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" asChild className="max-[400px]:hidden">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/register">Create account</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
