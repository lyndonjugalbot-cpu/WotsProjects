import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JobExperienceLevel, JobStatus } from "@vbph/schemas";

export interface AdminJobListItem {
  id: string;
  title: string;
  companyName: string;
  status: JobStatus;
  clientHourlyRate: number;
  vaHourlyRate: number;
  agencyMargin: number;
  applicationCount: number;
  createdAt: string;
}

export interface AdminJobDetail extends AdminJobListItem {
  clientId: string;
  description: string | null;
  responsibilities: string | null;
  requiredSkills: string[];
  experienceLevel: JobExperienceLevel | null;
  hoursPerWeek: number | null;
  schedule: string | null;
  timezone: string | null;
  numVasRequired: number;
  applicationDeadline: string | null;
  /** Placements not yet ENDED — "how many of numVasRequired are filled." */
  activePlacementCount: number;
}

export interface JobOption {
  id: string;
  title: string;
  clientId: string;
  /** So the placement-creation form can copy these in as a starting point. */
  clientHourlyRate: number;
  vaHourlyRate: number;
}

/** Lean list for admin placement-creation dropdowns. */
export const getJobOptions = cache(async (): Promise<JobOption[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("admin_jobs_view")
    .select("id, title, client_id, client_hourly_rate, va_hourly_rate")
    .order("title", { ascending: true });
  return (data ?? [])
    .filter(
      (j): j is { id: string; title: string; client_id: string; client_hourly_rate: number; va_hourly_rate: number } =>
        !!j.id && !!j.title && !!j.client_id && j.client_hourly_rate != null && j.va_hourly_rate != null
    )
    .map((j) => ({
      id: j.id,
      title: j.title,
      clientId: j.client_id,
      clientHourlyRate: j.client_hourly_rate,
      vaHourlyRate: j.va_hourly_rate,
    }));
});

/**
 * Every job on the platform, with client rate / VA rate / margin all
 * shown together — reads admin_jobs_view, the one place that's true (see
 * the admin_portal migration). Never reuse this pattern for a
 * client-facing or VA-facing query.
 */
export const getAllJobs = cache(async (): Promise<AdminJobListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: jobs, error } = await supabase
    .from("admin_jobs_view")
    .select("id, client_id, title, status, client_hourly_rate, agency_margin, va_hourly_rate, created_at")
    .order("created_at", { ascending: false });
  if (error || !jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id).filter((id): id is string => !!id);
  const clientIds = [...new Set(jobs.map((j) => j.client_id).filter((id): id is string => !!id))];

  const [{ data: clients }, { data: applications }] = await Promise.all([
    supabase.from("clients").select("id, company_name").in("id", clientIds),
    supabase.from("job_applications").select("job_id").in("job_id", jobIds),
  ]);

  const clientById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const appCountByJob = new Map<string, number>();
  for (const a of applications ?? []) {
    appCountByJob.set(a.job_id, (appCountByJob.get(a.job_id) ?? 0) + 1);
  }

  return jobs
    .filter(
      (j): j is typeof j & { id: string; title: string; status: string; client_hourly_rate: number; agency_margin: number; va_hourly_rate: number; created_at: string } =>
        !!j.id && !!j.title && !!j.status && j.client_hourly_rate != null && j.agency_margin != null && j.va_hourly_rate != null && !!j.created_at
    )
    .map((j) => ({
      id: j.id,
      title: j.title,
      companyName: j.client_id ? (clientById.get(j.client_id) ?? "Unknown company") : "Unknown company",
      status: j.status as JobStatus,
      clientHourlyRate: j.client_hourly_rate,
      vaHourlyRate: j.va_hourly_rate,
      agencyMargin: j.agency_margin,
      applicationCount: appCountByJob.get(j.id) ?? 0,
      createdAt: j.created_at,
    }));
});

export const getAdminJobDetail = cache(async (jobId: string): Promise<AdminJobDetail | null> => {
  const supabase = await createSupabaseServerClient();

  const { data: job, error } = await supabase
    .from("admin_jobs_view")
    .select(
      "id, client_id, title, description, responsibilities, required_skills, experience_level, hours_per_week, schedule, timezone, client_hourly_rate, agency_margin, va_hourly_rate, num_vas_required, application_deadline, status, created_at"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (
    error ||
    !job ||
    !job.id ||
    !job.title ||
    !job.status ||
    !job.client_id ||
    job.client_hourly_rate == null ||
    job.agency_margin == null ||
    job.va_hourly_rate == null ||
    !job.created_at
  ) {
    return null;
  }

  const [{ data: client }, { count: applicationCount }, { count: activePlacementCount }] = await Promise.all([
    supabase.from("clients").select("company_name").eq("id", job.client_id).maybeSingle(),
    supabase.from("job_applications").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    supabase
      .from("admin_placements_view")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .neq("status", "ENDED"),
  ]);

  return {
    id: job.id,
    clientId: job.client_id,
    title: job.title,
    companyName: client?.company_name ?? "Unknown company",
    status: job.status as JobStatus,
    clientHourlyRate: job.client_hourly_rate,
    agencyMargin: job.agency_margin,
    vaHourlyRate: job.va_hourly_rate,
    applicationCount: applicationCount ?? 0,
    createdAt: job.created_at,
    description: job.description,
    responsibilities: job.responsibilities,
    requiredSkills: job.required_skills ?? [],
    experienceLevel: job.experience_level as JobExperienceLevel | null,
    hoursPerWeek: job.hours_per_week,
    schedule: job.schedule,
    timezone: job.timezone,
    numVasRequired: job.num_vas_required ?? 1,
    applicationDeadline: job.application_deadline,
    activePlacementCount: activePlacementCount ?? 0,
  };
});
