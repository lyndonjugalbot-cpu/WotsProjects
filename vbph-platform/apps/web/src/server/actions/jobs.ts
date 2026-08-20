"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientContext } from "@/server/queries/client/context";
import { jobFormSchema, jobStatusSchema, type JobStatus } from "@vbph/schemas";

export type JobFormState = {
  error: string | null;
};

// Statuses a job can no longer be edited or re-parented from — a filled or
// closed role is done, historically, regardless of what a client resends.
const LOCKED_STATUSES: JobStatus[] = ["FILLED", "CLOSED"];

function parseJobForm(formData: FormData) {
  const skillsRaw = formData.get("requiredSkills");
  return jobFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    responsibilities: formData.get("responsibilities"),
    requiredSkills:
      typeof skillsRaw === "string"
        ? skillsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    experienceLevel: formData.get("experienceLevel"),
    hoursPerWeek: formData.get("hoursPerWeek") || undefined,
    schedule: formData.get("schedule"),
    timezone: formData.get("timezone"),
    clientHourlyRate: formData.get("clientHourlyRate"),
    numVasRequired: formData.get("numVasRequired") || undefined,
    applicationDeadline: formData.get("applicationDeadline"),
  });
}

/**
 * Creates a job. Agency margin and VA-facing rate are never referenced
 * here: the DB applies the $2/hr default and computes va_hourly_rate as a
 * generated column, and `authenticated` has no column grant to write
 * either even if this code changed (see job_posting_fields migration).
 *
 * `id` is generated here (not left to the DB default) because the base
 * `jobs` table has no SELECT grant for `authenticated` at all — an
 * INSERT ... RETURNING would fail — so this is the only way to know the
 * new row's id for the post-create redirect.
 */
export async function createJobAction(
  _prevState: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const { clientId } = await getClientContext();

  const parsed = parseJobForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const publish = formData.get("intent") === "publish";
  const supabase = await createSupabaseServerClient();
  const jobId = crypto.randomUUID();

  const { error } = await supabase.from("jobs").insert({
    id: jobId,
    client_id: clientId,
    title: parsed.data.title,
    description: parsed.data.description,
    responsibilities: parsed.data.responsibilities,
    required_skills: parsed.data.requiredSkills,
    experience_level: parsed.data.experienceLevel,
    hours_per_week: parsed.data.hoursPerWeek,
    schedule: parsed.data.schedule,
    timezone: parsed.data.timezone,
    client_hourly_rate: parsed.data.clientHourlyRate,
    num_vas_required: parsed.data.numVasRequired,
    application_deadline: parsed.data.applicationDeadline,
    status: publish ? "OPEN" : "DRAFT",
  });

  if (error) {
    return { error: "Couldn't create the job. Please try again." };
  }

  revalidatePath("/client/jobs");
  redirect(`/client/jobs/${jobId}`);
}

/**
 * Updates a job's editable fields. Re-fetches the job through
 * client_jobs_view first — never trusts a status/ownership claim from the
 * form — both to confirm this client owns it and to enforce "editable
 * while open" server-side (FILLED/CLOSED are terminal).
 *
 * Rate changes are allowed while the job is still open for edits, but a
 * job that already has applicants gets flagged back to the caller so the
 * UI can warn the client before they submit — applicants applied under
 * the rate they saw, and existing placements snapshot their own rate
 * independently (see placements table), so this is a fairness notice, not
 * a data-integrity concern.
 */
export async function updateJobAction(
  jobId: string,
  _prevState: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const { clientId } = await getClientContext();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("client_jobs_view")
    .select("id, status")
    .eq("client_id", clientId)
    .eq("id", jobId)
    .maybeSingle();

  if (!existing) {
    return { error: "Job not found." };
  }
  if (LOCKED_STATUSES.includes(existing.status as JobStatus)) {
    return { error: "This job is filled or closed and can no longer be edited." };
  }

  const parsed = parseJobForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      responsibilities: parsed.data.responsibilities,
      required_skills: parsed.data.requiredSkills,
      experience_level: parsed.data.experienceLevel,
      hours_per_week: parsed.data.hoursPerWeek,
      schedule: parsed.data.schedule,
      timezone: parsed.data.timezone,
      client_hourly_rate: parsed.data.clientHourlyRate,
      num_vas_required: parsed.data.numVasRequired,
      application_deadline: parsed.data.applicationDeadline,
    })
    .eq("id", jobId)
    .eq("client_id", clientId);

  if (error) {
    return { error: "Couldn't save changes. Please try again." };
  }

  revalidatePath(`/client/jobs/${jobId}`);
  revalidatePath("/client/jobs");
  redirect(`/client/jobs/${jobId}`);
}

/**
 * Status-only transition (Publish / Pause / Reopen / Close / Mark Filled).
 * A separate, narrower action from updateJobAction so the status buttons
 * on the job detail page don't need to resubmit the whole form, and so
 * this one path is the sole place status transitions are validated.
 */
export async function updateJobStatusAction(
  jobId: string,
  status: JobStatus
): Promise<JobFormState> {
  const { clientId } = await getClientContext();

  const parsed = jobStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { error: "Invalid status." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("client_jobs_view")
    .select("id, status")
    .eq("client_id", clientId)
    .eq("id", jobId)
    .maybeSingle();

  if (!existing) {
    return { error: "Job not found." };
  }
  if (LOCKED_STATUSES.includes(existing.status as JobStatus)) {
    return { error: "This job is filled or closed and can no longer be changed." };
  }

  const { error } = await supabase
    .from("jobs")
    .update({ status: parsed.data.status })
    .eq("id", jobId)
    .eq("client_id", clientId);

  if (error) {
    return { error: "Couldn't update the job's status. Please try again." };
  }

  revalidatePath(`/client/jobs/${jobId}`);
  revalidatePath("/client/jobs");
  return { error: null };
}
