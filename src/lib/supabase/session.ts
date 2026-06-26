import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicEnv } from "./env";

/** Public paths reachable without a session. Everything else requires auth. */
const PUBLIC_PATHS = ["/login", "/signup"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every request and gates protected
 * routes. Called from the root `proxy.ts` (Next.js 16's renamed middleware).
 *
 * Bound to the request/response cookies — NOT `next/headers` — because a Proxy
 * must be able to write refreshed auth cookies onto the outgoing response.
 *
 * This is an *optimistic* gate (it reads the session cookie). Pages, Server
 * Actions, and Route Handlers must still verify via the DAL close to the data.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabasePublicEnv();

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

  // IMPORTANT: getUser() must run immediately after createServerClient with no
  // intervening logic, or the session refresh can be dropped.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated request to a protected route -> send to /login.
  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // Already signed in but sitting on /login or /signup -> send home.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
