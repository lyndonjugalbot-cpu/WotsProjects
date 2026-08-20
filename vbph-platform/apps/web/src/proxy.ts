import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@vbph/types";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` (see AGENTS.md at the app
// root). This runs on every request matched below, refreshes the Supabase
// session, and redirects unauthenticated users away from protected portals.
//
// This is the FIRST line of defense, not the only one. Every portal layout
// re-checks the session server-side, and every Server Action re-checks
// auth/authorization independently — a proxy matcher change must never be
// the sole thing standing between a request and protected data.
const PROTECTED_PREFIXES = ["/client", "/va", "/admin"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Misconfigured env — fail open to a clear error page rather than
    // silently letting protected routes through unauthenticated.
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value)
        );
      },
    },
  });

  // getClaims() verifies the JWT (locally, when possible) and transparently
  // refreshes the session first if the access token is close to expiring —
  // this is what keeps a signed-in user signed in across requests.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
