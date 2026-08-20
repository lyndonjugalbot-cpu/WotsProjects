import { withApiAuth } from "@/lib/api/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionSegments } from "@/server/time-tracking/service";

/**
 * GET /api/time/entries/:entryId/segments — the Work Diary drill-down:
 * every segment for one session, each with a fresh short-lived signed
 * screenshot URL (or null if that segment has none). RLS on
 * time_segments (_select_va/_select_client/_admin_all) determines
 * whether the caller sees any rows at all — an entryId they're not
 * authorized for just returns an empty list, not an error.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  return withApiAuth(request, async ({ supabase }) => {
    const segments = await getSessionSegments(supabase, createSupabaseAdminClient(), entryId);
    return Response.json({ segments });
  });
}
