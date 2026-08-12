"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { initialsFromName } from "@/lib/format";

export interface CurrentUserState {
  user: User | null;
  status: "loading" | "ready";
  /**
   * Set when the auth check itself failed — which is not the same as being
   * signed out. Signed out is `{ user: null, status: "ready", error: null }`.
   */
  error: string | null;
}

/**
 * Reads the current Supabase user from the browser client and keeps it in
 * sync with Supabase auth state changes. Use this in client components that
 * need to display the signed-in user (e.g. the navbar).
 */
export function useCurrentUser(): CurrentUserState {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data.user);
        setError(null);
        setStatus("ready");
      })
      // Without this, a network failure or a misconfigured Supabase URL left
      // `status` at "loading" permanently, which callers render as an infinite
      // skeleton. Resolve the status either way and say what happened.
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn("Could not read the current user:", err);
        setUser(null);
        setError(
          err instanceof Error ? err.message : "Could not verify your session.",
        );
        setStatus("ready");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setError(null);
      setStatus("ready");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, status, error };
}

/**
 * Best-effort display name for the navbar / settings UI. Falls back through
 * the metadata fields the register page populates, then to the email local
 * part, and finally to "You".
 */
export function getDisplayName(user: User | null): string {
  if (!user) return "You";
  const meta = user.user_metadata ?? {};
  const fullName =
    typeof meta.full_name === "string" ? meta.full_name.trim() : "";
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
  return initialsFromName(getDisplayName(user));
}
