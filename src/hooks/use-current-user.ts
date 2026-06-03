"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface CurrentUserState {
  user: User | null;
  status: "loading" | "ready";
}

/**
 * Reads the current Supabase user from the browser client and keeps it in
 * sync with Supabase auth state changes. Use this in client components that
 * need to display the signed-in user (e.g. the navbar).
 */
export function useCurrentUser(): CurrentUserState {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      setStatus("ready");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus("ready");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, status };
}

/**
 * Best-effort display name for the navbar / settings UI. Falls back through
 * the metadata fields the register page populates, then to the email local
 * part, and finally to "You".
 */
export function getDisplayName(user: User | null): string {
  if (!user) return "You";
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;

  const firstName =
    typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const lastName =
    typeof meta.last_name === "string" ? meta.last_name.trim() : "";
  if (firstName || lastName) return `${firstName} ${lastName}`.trim();

  if (user.email) return user.email.split("@")[0] ?? user.email;
  return "You";
}

export function getInitials(user: User | null): string {
  const name = getDisplayName(user);
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
