/**
 * Where to go after signing in.
 *
 * `redirectTo` comes from the URL, so anyone can write one. Only a path on
 * this site is followed: "https://…" leaves it, and so do "//host" and
 * "/\host", which a browser reads as another origin.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
