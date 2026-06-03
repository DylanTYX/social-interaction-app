import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * Per-request server client used in Route Handlers and Server Components.
 *
 * Notes:
 *   - In Route Handlers we *can* write cookies; in Server Components we
 *     cannot. We swallow the cookie-write error in the latter case so the
 *     same factory works in both contexts. Sessions are still kept fresh
 *     because the Next middleware writes cookies on every request.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot mutate cookies; the middleware handles
          // refresh so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Read the currently authenticated user (or `null`). Throws only on a real
 * Supabase error — an unauthenticated request returns `null`.
 */
export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    // `getUser()` returns an error when there's no session; treat as
    // unauthenticated rather than throwing.
    if (error.status === 401 || error.name === "AuthSessionMissingError") {
      return { supabase, user: null };
    }
    throw error;
  }
  return { supabase, user: data.user ?? null };
}
