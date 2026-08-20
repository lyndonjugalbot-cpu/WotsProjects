import { withApiAuth } from "@/lib/api/auth";
import { getMyProfile } from "@/server/time-tracking/service";

/**
 * GET /api/time/me — who am I. The desktop app calls this immediately
 * after login (confirms the account is actually a VA before showing any
 * VA-only screen) and on every cold start (confirms a stored access
 * token is still valid before trusting anything else from local storage).
 */
export async function GET(request: Request) {
  return withApiAuth(request, async ({ supabase, user }) => {
    const profile = await getMyProfile(supabase, user.id);
    return Response.json(profile);
  });
}
