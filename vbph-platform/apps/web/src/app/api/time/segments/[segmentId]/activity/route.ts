import { withApiAuth, requireApiRole, ApiRequestError } from "@/lib/api/auth";
import { recordActivitySchema } from "@vbph/schemas";
import { recordActivity } from "@/server/time-tracking/service";

/**
 * PATCH /api/time/segments/:segmentId/activity — Record Activity. Updates
 * keyboard/mouse activity counts and/or the overall activity percentage
 * on an already-created segment — e.g. a correction, or activity reported
 * separately from segment creation. segment_start/segment_end are never
 * writable here (see the time_tracking_api migration's column grants) —
 * only the activity fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ segmentId: string }> }
) {
  const { segmentId } = await params;
  return withApiAuth(request, async ({ supabase, user }) => {
    requireApiRole(user, "VA");

    const body = await request.json().catch(() => null);
    const parsed = recordActivitySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiRequestError(422, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const segment = await recordActivity(supabase, segmentId, parsed.data);
    return Response.json(segment);
  });
}
