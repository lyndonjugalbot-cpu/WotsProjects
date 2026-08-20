"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { deleteScreenshot } from "@/server/time-tracking/service";
import { ApiRequestError } from "@/lib/api/auth";
import { logAdminAction } from "./audit";

export type WorkDiaryActionState = {
  error: string | null;
};

/**
 * A VA deleting their own screenshot/time block. Not audit-logged — this
 * app only logs *admin* actions (see logAdminAction's own callers); a
 * VA acting on their own data isn't an admin action. Authorization is
 * enforced inside delete_screenshot() itself (VA-owner or admin only —
 * see the time_tracking_api migration), not by anything here.
 */
export async function deleteOwnScreenshotAction(screenshotId: string): Promise<WorkDiaryActionState> {
  await requireRole("VA");
  const supabase = await createSupabaseServerClient();

  try {
    await deleteScreenshot(supabase, createSupabaseAdminClient(), screenshotId);
  } catch (err) {
    if (err instanceof ApiRequestError) {
      return { error: err.message };
    }
    return { error: "Couldn't delete this screenshot. Please try again." };
  }

  revalidatePath("/va/work-diary");
  return { error: null };
}

/**
 * Admin removing an inappropriate/invalid segment — the one deletion
 * path in this feature that must leave an audit trail. Segment context
 * (whose it was, when, what the memo said) is captured BEFORE deletion,
 * since delete_screenshot() removes the row; logging after the fact with
 * only a screenshotId would leave a much less useful audit_logs entry.
 */
export async function adminDeleteSegmentAction(screenshotId: string): Promise<WorkDiaryActionState> {
  const admin = await requireRole("ADMIN");
  const supabase = await createSupabaseServerClient();

  const { data: screenshot } = await supabase
    .from("screenshots")
    .select("id, time_segment_id")
    .eq("id", screenshotId)
    .maybeSingle();

  const { data: segment } = screenshot
    ? await supabase
        .from("time_segments")
        .select("id, segment_start, segment_end, memo, time_entry_id")
        .eq("id", screenshot.time_segment_id)
        .maybeSingle()
    : { data: null };

  const { data: entry } = segment
    ? await supabase.from("time_entries").select("placement_id").eq("id", segment.time_entry_id).maybeSingle()
    : { data: null };

  try {
    await deleteScreenshot(supabase, createSupabaseAdminClient(), screenshotId);
  } catch (err) {
    if (err instanceof ApiRequestError) {
      return { error: err.message };
    }
    return { error: "Couldn't delete this segment. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "time_segment_deleted", "time_segments", segment?.id ?? screenshotId, {
    screenshotId,
    segmentStart: segment?.segment_start ?? null,
    segmentEnd: segment?.segment_end ?? null,
    memo: segment?.memo ?? null,
    placementId: entry?.placement_id ?? null,
  });

  revalidatePath("/admin/time");
  return { error: null };
}
