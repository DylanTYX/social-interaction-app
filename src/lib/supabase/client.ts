"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

let cachedClient: SupabaseClient | null = null;

/**
 * Singleton browser client. Re-using the same instance avoids spinning up
 * multiple GoTrue token refresh loops in a single tab.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { url, anonKey } = getSupabasePublicEnv();
  cachedClient = createBrowserClient(url, anonKey);
  return cachedClient;
}
