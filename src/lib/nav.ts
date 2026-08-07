/**
 * Which navigation item the current route belongs to.
 *
 * This was two identical copies — one in `sidebar.tsx`, one in
 * `mobile-nav.tsx` — of:
 *
 *     pathname === href || pathname.startsWith(`${href}/`)
 *
 * which has a bug that both copies inherited. `/dashboard` is a prefix of every
 * other dashboard route, so on `/dashboard/sessions` the rule matches twice and
 * **both "Dashboard" and "Sessions" render as active**. The highlight is
 * supposed to answer "where am I"; two answers is no answer.
 *
 * The fix is that a route which is the *index* of a section must match exactly.
 * Prefix matching is still right for the others — `/dashboard/sessions` should
 * stay lit on a hypothetical `/dashboard/sessions/[id]`.
 */

/**
 * Section indexes: hrefs that are a prefix of their siblings and must therefore
 * match exactly. Adding a nav item at `/dashboard/foo` needs no change here;
 * adding a new *section index* does.
 */
const EXACT_MATCH_ONLY = new Set(["/", "/dashboard"]);

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (EXACT_MATCH_ONLY.has(href)) return false;
  return pathname.startsWith(`${href}/`);
}
