import { withApiAuth, ApiRequestError } from "@/lib/api/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { workDiaryQuerySchema } from "@vbph/schemas";
import { getWorkDiary } from "@/server/time-tracking/service";

/**
 * GET /api/time/diary — Retrieve Work Diary. Returns time sessions
 * (Start Time/End Time/Total Time/Status, VA/Placement/Project),
 * scoped entirely by RLS: a VA sees their own, a client sees VAs on
 * their own projects, an admin sees everything (time_entries_select_va /
 * _select_client / _admin_all) — see docs/database.md. Optional query
 * params (vaId, placementId, startDate, endDate) only ever narrow within
 * what the caller could already see.
 */
export async function GET(request: Request) {
  return withApiAuth(request, async ({ supabase }) => {
    const url = new URL(request.url);
    const parsed = workDiaryQuerySchema.safeParse({
      vaId: url.searchParams.get("vaId") ?? undefined,
      placementId: url.searchParams.get("placementId") ?? undefined,
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
    });
    if (!parsed.success) {
      throw new ApiRequestError(422, parsed.error.issues[0]?.message ?? "Invalid query parameters");
    }

    const sessions = await getWorkDiary(supabase, createSupabaseAdminClient(), parsed.data);
    return Response.json({ sessions });
  });
}
