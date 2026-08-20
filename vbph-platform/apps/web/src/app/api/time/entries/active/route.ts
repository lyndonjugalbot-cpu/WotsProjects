import { withApiAuth, requireApiRole } from "@/lib/api/auth";
import { getActiveSessions } from "@/server/time-tracking/service";

/**
 * GET /api/time/entries/active — the caller's currently-running time
 * entries. The desktop app calls this on every cold start and after any
 * reconnect to reconcile local timer state against the server's, which
 * is always the source of truth — see getActiveSessions.
 */
export async function GET(request: Request) {
  return withApiAuth(request, async ({ supabase, user }) => {
    requireApiRole(user, "VA");
    const sessions = await getActiveSessions(supabase);
    return Response.json({ sessions });
  });
}
