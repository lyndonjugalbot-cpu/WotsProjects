"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { createPlacementSchema, placementStatusSchema, rateOverrideSchema } from "@vbph/schemas";
import { logAdminAction } from "./audit";

export type AdminActionState = {
  error: string | null;
};

/**
 * Creates a placement — "assign a VA" to a job/project, the step that
 * follows marking an application HIRED. client_hourly_rate and
 * agency_margin are both written here directly (not through the
 * admin_update_placement_rates RPC) because this is the initial insert,
 * not an override of existing rates; margin is still always computed as
 * clientRate - vaRate, so the same consistency guarantee applies. Once
 * written, these columns are the placement's own historical record —
 * nothing here ever reads back from `jobs` again, so a later change to
 * the job's rate (via admin_update_job_rates) can't retroactively affect
 * this placement. The form pre-fills client/VA rate FROM the job's
 * current rate at creation time only (see getJobOptions), which is a
 * one-time copy, not a link.
 *
 * Two side effects on success, both best-effort (a failure here doesn't
 * roll back the placement — the placement is the source of truth the
 * admin explicitly asked for; these are conveniences, not invariants):
 *  - If a matching job_application (same job_id + va_id) exists and isn't
 *    already HIRED, mark it HIRED — covers creating a placement directly
 *    (skipping the "Assign VA" link on the application) without leaving
 *    the application stuck at an earlier status.
 *  - If the job now has num_vas_required-or-more non-ENDED placements,
 *    mark it FILLED — "the job can be marked FILLED when the required
 *    number of VAs has been hired."
 */
export async function createPlacementAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = createPlacementSchema.safeParse({
    clientId: formData.get("clientId"),
    vaId: formData.get("vaId"),
    jobId: formData.get("jobId"),
    projectId: formData.get("projectId"),
    clientHourlyRate: formData.get("clientHourlyRate"),
    vaHourlyRate: formData.get("vaHourlyRate"),
    hoursPerWeekExpected: formData.get("hoursPerWeekExpected") || undefined,
    startDate: formData.get("startDate"),
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const margin = parsed.data.clientHourlyRate - parsed.data.vaHourlyRate;

  // `placements` has SELECT revoked from `authenticated` entirely (same
  // rate-privacy grant pattern as `jobs` — see docs/database.md), so
  // INSERT ... RETURNING would fail on the grant check before RLS even
  // runs. Generating the id here (rather than relying on the column
  // default) is the same fix used for job creation: the caller already
  // knows the new row's id without ever reading it back.
  const placementId = crypto.randomUUID();

  const { error } = await supabase.from("placements").insert({
    id: placementId,
    client_id: parsed.data.clientId,
    va_id: parsed.data.vaId,
    job_id: parsed.data.jobId,
    project_id: parsed.data.projectId,
    client_hourly_rate: parsed.data.clientHourlyRate,
    agency_margin: margin,
    hours_per_week_expected: parsed.data.hoursPerWeekExpected,
    start_date: parsed.data.startDate,
    status: parsed.data.status,
  });

  if (error) {
    return { error: "Couldn't create the placement. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "placement_created", "placements", placementId, {
    clientId: parsed.data.clientId,
    vaId: parsed.data.vaId,
    jobId: parsed.data.jobId,
    clientHourlyRate: parsed.data.clientHourlyRate,
    vaHourlyRate: parsed.data.vaHourlyRate,
    agencyMargin: margin,
    status: parsed.data.status,
  });

  if (parsed.data.jobId) {
    await syncApplicationToHired(supabase, admin.id, parsed.data.jobId, parsed.data.vaId);
    await autoFillJobIfStaffed(supabase, admin.id, parsed.data.jobId);
    revalidatePath(`/admin/jobs/${parsed.data.jobId}`);
    revalidatePath("/admin/applications");
  }

  revalidatePath("/admin/placements");
  revalidatePath("/client/dashboard");
  revalidatePath("/va/dashboard");
  redirect(`/admin/placements/${placementId}`);
}

async function syncApplicationToHired(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  adminId: string,
  jobId: string,
  vaId: string
): Promise<void> {
  const { data: application } = await supabase
    .from("job_applications")
    .select("id, status")
    .eq("job_id", jobId)
    .eq("va_id", vaId)
    .maybeSingle();

  if (!application || application.status === "HIRED") return;

  const { error } = await supabase
    .from("job_applications")
    .update({ status: "HIRED" })
    .eq("id", application.id);

  if (!error) {
    await logAdminAction(supabase, adminId, "application_status_changed", "job_applications", application.id, {
      status: "HIRED",
      reason: "placement_created",
    });
  }
}

async function autoFillJobIfStaffed(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  adminId: string,
  jobId: string
): Promise<void> {
  const { data: job } = await supabase
    .from("admin_jobs_view")
    .select("num_vas_required, status")
    .eq("id", jobId)
    .maybeSingle();

  if (!job || job.status === "FILLED" || job.status === "CLOSED") return;

  const { count } = await supabase
    .from("admin_placements_view")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .neq("status", "ENDED");

  if ((count ?? 0) < (job.num_vas_required ?? 1)) return;

  const { error } = await supabase.from("jobs").update({ status: "FILLED" }).eq("id", jobId);
  if (!error) {
    await logAdminAction(supabase, adminId, "job_status_changed", "jobs", jobId, {
      status: "FILLED",
      reason: "required_va_count_reached",
    });
  }
}

export async function updatePlacementRatesAction(
  placementId: string,
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
  const { error } = await supabase.rpc("admin_update_placement_rates", {
    target_placement_id: placementId,
    new_client_hourly_rate: parsed.data.clientHourlyRate,
    new_va_hourly_rate: parsed.data.vaHourlyRate,
  });

  if (error) {
    return { error: "Couldn't update rates. Please try again." };
  }

  revalidatePath(`/admin/placements/${placementId}`);
  revalidatePath("/admin/placements");
  return { error: null };
}

export async function updatePlacementStatusAction(
  placementId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = placementStatusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) {
    return { error: "Invalid status." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("placements")
    .update({ status: parsed.data.status })
    .eq("id", placementId);

  if (error) {
    return { error: "Couldn't update status. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "placement_status_changed", "placements", placementId, parsed.data);

  revalidatePath(`/admin/placements/${placementId}`);
  revalidatePath("/admin/placements");
  return { error: null };
}
