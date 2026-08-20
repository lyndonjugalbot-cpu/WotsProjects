import { withApiAuth, requireApiRole, ApiRequestError } from "@/lib/api/auth";
import { stopTimerSchema } from "@vbph/schemas";
import { stopTimer } from "@/server/time-tracking/service";

/**
 * PATCH /api/time/entries/:entryId/stop — Stop Timer. No body on a
 * normal Stop-button call; the desktop app's stale-session
 * reconciliation is the only caller that ever sends `endedAt`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  return withApiAuth(request, async ({ supabase, user }) => {
    requireApiRole(user, "VA");

    const body = await request.json().catch(() => ({}));
    const parsed = stopTimerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiRequestError(422, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const session = await stopTimer(supabase, entryId, parsed.data.endedAt);
    return Response.json(session);
  });
}
