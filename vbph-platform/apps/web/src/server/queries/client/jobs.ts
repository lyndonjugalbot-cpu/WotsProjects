import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JobExperienceLevel, JobStatus } from "@vbph/schemas";

export interface ClientJobListItem {
  id: string;
  title: string;
  status: JobStatus;
  /** The client's own billing rate — never the VA payout rate or agency margin. */
  clientHourlyRate: number;
  hoursPerWeek: number | null;
  numVasRequired: number;
  applicationDeadline: string | null;
  createdAt: string;
}

export interface ClientJobDetail extends ClientJobListItem {
  description: string | null;
  responsibilities: string | null;
  requiredSkills: string[];
  experienceLevel: JobExperienceLevel | null;
  schedule: string | null;
  timezone: string | null;
  applicationCount: number;
}

/**
 * Client → Jobs list. Reads exclusively through client_jobs_view, which
 * has no agency_margin or va_hourly_rate column to begin with (see
 * docs/database.md) — there's no wrong-column mistake possible here.
 */
export const getClientJobs = cache(async (clientId: string): Promise<ClientJobListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("client_jobs_view")
    .select("id, title, status, client_hourly_rate, hours_per_week, num_vas_required, application_deadline, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((j): j is typeof j & { id: string; title: string; status: string; client_hourly_rate: number; created_at: string } =>
      !!j.id && !!j.title && !!j.status && j.client_hourly_rate != null && !!j.created_at
    )
    .map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status as JobStatus,
      clientHourlyRate: j.client_hourly_rate,
      hoursPerWeek: j.hours_per_week,
      numVasRequired: j.num_vas_required ?? 1,
      applicationDeadline: j.application_deadline,
      createdAt: j.created_at,
    }));
});

/**
 * A single job for the detail/edit page. Returns null if the job doesn't
 * exist or doesn't belong to this client — client_jobs_view already scopes
 * rows to is_client_member(client_id), and the explicit .eq() below is a
 * second, redundant check against the same clientId sourced from
 * getClientContext() (never from the URL) so cross-client access fails
 * closed even if the view's predicate were ever loosened.
 */
export const getClientJob = cache(
  async (clientId: string, jobId: string): Promise<ClientJobDetail | null> => {
    const supabase = await createSupabaseServerClient();

    const [{ data: job, error }, { count: applicationCount }] = await Promise.all([
      supabase
        .from("client_jobs_view")
        .select(
          "id, title, status, description, responsibilities, required_skills, experience_level, hours_per_week, schedule, timezone, client_hourly_rate, num_vas_required, application_deadline, created_at"
        )
        .eq("client_id", clientId)
        .eq("id", jobId)
        .maybeSingle(),
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId),
    ]);

    if (error || !job || !job.id || !job.title || !job.status || job.client_hourly_rate == null || !job.created_at) {
      return null;
    }

    return {
      id: job.id,
      title: job.title,
      status: job.status as JobStatus,
      clientHourlyRate: job.client_hourly_rate,
      hoursPerWeek: job.hours_per_week,
      numVasRequired: job.num_vas_required ?? 1,
      applicationDeadline: job.application_deadline,
      createdAt: job.created_at,
      description: job.description,
      responsibilities: job.responsibilities,
      requiredSkills: job.required_skills ?? [],
      experienceLevel: job.experience_level as JobExperienceLevel | null,
      schedule: job.schedule,
      timezone: job.timezone,
      applicationCount: applicationCount ?? 0,
    };
  }
);
