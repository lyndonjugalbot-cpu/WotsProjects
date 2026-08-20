"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { advanceTimesheetStatusSchema, setTimeEntryStatusSchema, correctLockedTimesheetSchema } from "@vbph/schemas";

export type AdminActionState = {
  error: string | null;
};

function revalidateTimesheet(timesheetId: string) {
  revalidatePath(`/admin/timesheets/${timesheetId}`);
  revalidatePath("/admin/timesheets");
}

/**
 * Forward-only status transition (OPEN -> SUBMITTED -> APPROVED -> LOCKED).
 * All the real enforcement — that this can only move one step forward,
 * that locking is what computes and freezes the hour snapshot — lives in
 * admin_set_timesheet_status() itself (see the weekly_timesheets
 * migration), not here; this Server Action is just auth + input shaping.
 */
export async function advanceTimesheetStatusAction(
  timesheetId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = advanceTimesheetStatusSchema.safeParse({ newStatus: formData.get("newStatus") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid status" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_timesheet_status", {
    target_timesheet_id: timesheetId,
    new_status: parsed.data.newStatus,
  });

  if (error) {
    return { error: error.message || "Couldn't update this timesheet's status." };
  }

  revalidateTimesheet(timesheetId);
  return { error: null };
}

/**
 * "Allow admin to approve/reject questionable time" — sets the review
 * status on one time_entry (a session) within the timesheet's week.
 * Deliberately allowed regardless of the timesheet's own status: if the
 * week is already LOCKED, this has no effect on its frozen numbers
 * unless a correction is ALSO made through correctLockedTimesheetAction
 * below — see admin_set_time_entry_status()'s migration comment.
 */
export async function setTimeEntryStatusAction(
  timesheetId: string,
  timeEntryId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = setTimeEntryStatusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid status" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_time_entry_status", {
    target_time_entry_id: timeEntryId,
    new_status: parsed.data.status,
  });

  if (error) {
    return { error: error.message || "Couldn't update this time entry." };
  }

  revalidateTimesheet(timesheetId);
  return { error: null };
}

/**
 * The one, always-audited way a LOCKED timesheet's frozen hours can
 * change — see admin_correct_locked_timesheet(). The RPC itself both
 * enforces "only while LOCKED" and writes the audit_logs row in the same
 * transaction as the update, so there's no code path here that could
 * apply a correction without it being recorded.
 */
export async function correctLockedTimesheetAction(
  timesheetId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = correctLockedTimesheetSchema.safeParse({
    trackedHours: formData.get("trackedHours"),
    approvedHours: formData.get("approvedHours"),
    rejectedHours: formData.get("rejectedHours"),
    pendingHours: formData.get("pendingHours"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_correct_locked_timesheet", {
    target_timesheet_id: timesheetId,
    new_tracked_hours: parsed.data.trackedHours,
    new_approved_hours: parsed.data.approvedHours,
    new_rejected_hours: parsed.data.rejectedHours,
    new_pending_hours: parsed.data.pendingHours,
    reason: parsed.data.reason,
  });

  if (error) {
    return { error: error.message || "Couldn't apply this correction." };
  }

  revalidateTimesheet(timesheetId);
  return { error: null };
}
