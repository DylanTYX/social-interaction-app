/**
 * Tiny helper to read Supabase env vars consistently across client/server
 * code. Centralised so a missing value produces one clear error message.
 */

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

let cachedPublicEnv: SupabasePublicEnv | null = null;

/**
 * Supabase rolled out a new key naming convention in 2025: the "publishable
 * key" (`sb_publishable_*`) supersedes the legacy `anon` JWT, but both still
 * work with the supabase-js client. Accept either env var name so users can
 * paste whatever their dashboard gives them.
 */
function readPublicAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    undefined
  );
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = readPublicAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in your environment.",
    );
  }

  cachedPublicEnv = { url, anonKey };
  return cachedPublicEnv;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && readPublicAnonKey());
}
