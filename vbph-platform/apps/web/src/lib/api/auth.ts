import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole, AccountStatus } from "@vbph/types";

/**
 * Auth for the time-tracking API (apps/web/src/app/api/time/*). These
 * routes exist for the future desktop app — a non-browser client with no
 * cookies — so auth is a Bearer access token, not the cookie-based
 * `createSupabaseServerClient()` used everywhere else in this app. The
 * desktop app authenticates directly against Supabase Auth
 * (`signInWithPassword`, same as the web app) and sends the resulting
 * access token on every request; this file's only job is validating that
 * token and handing back an RLS-scoped client for it.
 */

export interface ApiUser {
  id: string;
  role: UserRole;
  status: AccountStatus;
}

export interface ApiAuthResult {
  supabase: SupabaseClient<Database>;
  user: ApiUser;
}

export class ApiAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractBearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    throw new ApiAuthError(401, "Missing or invalid Authorization header. Expected 'Bearer <access_token>'.");
  }
  return token;
}

/**
 * Validates the request's bearer token and returns an RLS-scoped Supabase
 * client (every query through it runs as that user — RLS is still the
 * real enforcement, same as the rest of this app) plus the caller's role
 * and account status.
 *
 * `auth.getUser(token)` — not `getClaims()` — deliberately: this client
 * never calls `setSession()`, so it has no internal session for
 * `getClaims()` to introspect. `getUser(token)` is the stateless,
 * server-side-verify-an-arbitrary-token form, exactly this use case.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const token = extractBearerToken(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new ApiAuthError(500, "Server misconfigured.");
  }

  const supabase = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    throw new ApiAuthError(401, "Invalid or expired access token.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new ApiAuthError(401, "No profile found for this account.");
  }
  if (profile.status === "suspended") {
    throw new ApiAuthError(403, "This account is suspended.");
  }

  return { supabase, user: { id: profile.id, role: profile.role, status: profile.status } };
}

export function requireApiRole(user: ApiUser, allowed: UserRole | UserRole[]): void {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(user.role)) {
    throw new ApiAuthError(403, `Requires role: ${roles.join(" or ")}.`);
  }
}

/**
 * Wraps a route handler with auth + uniform error handling, so each route
 * only writes its own business logic. `ApiAuthError`/`ApiRequestError`
 * become clean JSON error responses; anything else is logged and reported
 * as a generic 500 rather than leaking internals to the caller.
 */
export async function withApiAuth(
  request: Request,
  handler: (ctx: ApiAuthResult) => Promise<Response>
): Promise<Response> {
  try {
    const ctx = await authenticateApiRequest(request);
    return await handler(ctx);
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof ApiRequestError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/time] unhandled error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
