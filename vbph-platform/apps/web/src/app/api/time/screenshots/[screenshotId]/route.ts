import { withApiAuth } from "@/lib/api/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteScreenshot } from "@/server/time-tracking/service";

/**
 * DELETE /api/time/screenshots/:screenshotId — Delete Screenshot/Segment.
 * Removing a screenshot removes its owning 10-minute segment too — that
 * segment stops counting toward billable tracked time the moment its
 * screenshot is deleted. Authorization (VA-owner or admin only — a
 * client can view, never delete) is enforced inside delete_screenshot(),
 * not here — see the time_tracking_api migration.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ screenshotId: string }> }
) {
  const { screenshotId } = await params;
  return withApiAuth(request, async ({ supabase }) => {
    await deleteScreenshot(supabase, createSupabaseAdminClient(), screenshotId);
    return new Response(null, { status: 204 });
  });
}
