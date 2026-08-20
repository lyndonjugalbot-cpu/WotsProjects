import { withApiAuth, requireApiRole, ApiRequestError } from "@/lib/api/auth";
import { startTimerSchema } from "@vbph/schemas";
import { startTimer } from "@/server/time-tracking/service";

/** POST /api/time/entries — Start Timer. Body: { placementId }. */
export async function POST(request: Request) {
  return withApiAuth(request, async ({ supabase, user }) => {
    requireApiRole(user, "VA");

    const body = await request.json().catch(() => null);
    const parsed = startTimerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiRequestError(422, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const session = await startTimer(supabase, parsed.data.placementId);
    return Response.json(session, { status: 201 });
  });
}
