import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv, isSupabaseConfigured } from "./env";

const PROTECTED_PREFIXES = ["/dashboard", "/simulate"];
const AUTH_PAGES = ["/auth/login", "/auth/register"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PAGES.includes(pathname);
}

/**
 * Proxy-friendly Supabase wrapper used by `src/proxy.ts`. Two responsibilities:
 *   1. Refresh the user's session cookie on every request so server
 *      components see fresh auth state.
 *   2. Redirect unauthenticated users away from `/dashboard` and `/simulate`,
 *      and bounce signed-in users away from the login/register pages.
 *
 * If Supabase env vars are missing we let the request through unchanged so
 * developers can boot the app without configuring a backend.
 */
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectTo", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
