import { withApiAuth, requireApiRole } from "@/lib/api/auth";
import { getVaActivePlacements } from "@/server/time-tracking/service";

/**
 * GET /api/time/placements — Placement/Project retrieval for the desktop
 * app's Project Selection screen. ACTIVE placements only, and only this
 * VA's own — see getVaActivePlacements for why PENDING/PAUSED/ENDED are
 * excluded.
 */
export async function GET(request: Request) {
  return withApiAuth(request, async ({ supabase, user }) => {
    requireApiRole(user, "VA");
    const placements = await getVaActivePlacements(supabase);
    return Response.json({ placements });
  });
}
