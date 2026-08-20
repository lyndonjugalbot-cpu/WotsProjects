"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { jobStatusSchema, rateOverrideSchema } from "@vbph/schemas";
import { logAdminAction } from "./audit";

export type AdminActionState = {
  error: string | null;
};

/**
 * Admin status override — unlike the client's own updateJobStatusAction,
 * this has no LOCKED_STATUSES restriction: admin is the final authority
 * and may reopen a FILLED/CLOSED job if the business situation changes.
 */
export async function updateJobStatusAdminAction(
  jobId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = jobStatusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) {
    return { error: "Invalid status." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("jobs").update({ status: parsed.data.status }).eq("id", jobId);
  if (error) {
    return { error: "Couldn't update job status. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "job_status_changed", "jobs", jobId, parsed.data);

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  return { error: null };
}

/**
 * Rate override — client_hourly_rate and va_hourly_rate are the only two
 * fields ever accepted; margin is computed and persisted entirely inside
 * admin_update_job_rates() (see the admin_portal migration), so there is
 * no path here where an inconsistent margin could be written. That RPC
 * also writes its own audit_logs row (it has the before/after values
 * already in hand), so this action doesn't log separately.
 */
export async function updateJobRatesAction(
  jobId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = rateOverrideSchema.safeParse({
    clientHourlyRate: formData.get("clientHourlyRate"),
    vaHourlyRate: formData.get("vaHourlyRate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_job_rates", {
    target_job_id: jobId,
    new_client_hourly_rate: parsed.data.clientHourlyRate,
    new_va_hourly_rate: parsed.data.vaHourlyRate,
  });

  if (error) {
    return { error: "Couldn't update rates. Please try again." };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  return { error: null };
}
