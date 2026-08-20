import { withApiAuth, requireApiRole, ApiRequestError } from "@/lib/api/auth";
import { createSegmentSchema } from "@vbph/schemas";
import { createSegment } from "@/server/time-tracking/service";

/**
 * POST /api/time/segments — Create 10-Minute Segment. The desktop app
 * aggregates a segment's keyboard/mouse counts and activity percentage
 * locally over its ~10-minute window, then submits the whole segment
 * here in one call once that window closes.
 */
export async function POST(request: Request) {
  return withApiAuth(request, async ({ supabase, user }) => {
    requireApiRole(user, "VA");

    const body = await request.json().catch(() => null);
    const parsed = createSegmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiRequestError(422, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const segment = await createSegment(supabase, parsed.data);
    return Response.json(segment, { status: 201 });
  });
}
