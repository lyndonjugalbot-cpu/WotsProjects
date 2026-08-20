import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplicationStatus, JobExperienceLevel, JobStatus } from "@vbph/schemas";

// SECURITY: every query in this file reads exclusively through
// va_jobs_view, which has no client_hourly_rate or agency_margin column
// to begin with — not filtered out, structurally absent from the result
// set. See docs/database.md's rate-privacy section. Never add a query
// here that reads from the base `jobs` table directly (it would also
// simply fail: `authenticated` has no SELECT grant on jobs' rate columns
// at all).

export interface VaJobFilters {
  q?: string;
  skills?: string[];
  minRate?: number;
  maxRate?: number;
  minHours?: number;
  maxHours?: number;
  timezone?: string;
}

export interface VaJobListItem {
  id: string;
  title: string;
  descriptionPreview: string | null;
  requiredSkills: string[];
  schedule: string | null;
  timezone: string | null;
  hoursPerWeek: number | null;
  experienceLevel: JobExperienceLevel | null;
  vaHourlyRate: number;
  numVasRequired: number;
  applicationDeadline: string | null;
  createdAt: string;
}

export interface VaJobDetail extends Omit<VaJobListItem, "descriptionPreview"> {
  description: string | null;
  responsibilities: string | null;
  status: JobStatus;
  hasApplied: boolean;
  applicationStatus: ApplicationStatus | null;
}

const PREVIEW_LENGTH = 180;

function toPreview(text: string | null): string | null {
  if (!text) return null;
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…` : text;
}

// PostgREST's `.or()` filter string is delimited by commas/parens; strip
// them from free-text search input so a query like "support, remote (PHT)"
// can't produce a malformed filter. This is a correctness safeguard, not a
// security boundary — the column names in the filter are hardcoded below,
// so user input can only ever supply the ilike pattern, never a column or
// operator.
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()]/g, " ").trim().slice(0, 200);
}

export const getVaJobs = cache(async (filters: VaJobFilters): Promise<VaJobListItem[]> => {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("va_jobs_view")
    .select(
      "id, title, description, required_skills, schedule, timezone, hours_per_week, experience_level, va_hourly_rate, num_vas_required, application_deadline, created_at"
    )
    .eq("status", "OPEN")
    .order("created_at", { ascending: false });

  if (filters.q) {
    const term = sanitizeSearchTerm(filters.q);
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,description.ilike.%${term}%,responsibilities.ilike.%${term}%`
      );
    }
  }
  if (filters.skills && filters.skills.length > 0) {
    query = query.overlaps("required_skills", filters.skills);
  }
  if (filters.minRate != null) query = query.gte("va_hourly_rate", filters.minRate);
  if (filters.maxRate != null) query = query.lte("va_hourly_rate", filters.maxRate);
  if (filters.minHours != null) query = query.gte("hours_per_week", filters.minHours);
  if (filters.maxHours != null) query = query.lte("hours_per_week", filters.maxHours);
  if (filters.timezone) query = query.eq("timezone", filters.timezone);

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter(
      (j): j is typeof j & { id: string; title: string; va_hourly_rate: number; created_at: string } =>
        !!j.id && !!j.title && j.va_hourly_rate != null && !!j.created_at
    )
    .map((j) => ({
      id: j.id,
      title: j.title,
      descriptionPreview: toPreview(j.description),
      requiredSkills: j.required_skills ?? [],
      schedule: j.schedule,
      timezone: j.timezone,
      hoursPerWeek: j.hours_per_week,
      experienceLevel: j.experience_level as JobExperienceLevel | null,
      vaHourlyRate: j.va_hourly_rate,
      numVasRequired: j.num_vas_required ?? 1,
      applicationDeadline: j.application_deadline,
      createdAt: j.created_at,
    }));
});

export interface VaJobFilterOptions {
  skills: string[];
  timezones: string[];
}

/**
 * Distinct skills/timezones across all currently-open jobs, for the
 * filter UI — computed unfiltered so the option lists stay stable as the
 * VA narrows their search, instead of shrinking to just what's already
 * selected.
 */
export const getVaJobFilterOptions = cache(async (): Promise<VaJobFilterOptions> => {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("va_jobs_view")
    .select("required_skills, timezone")
    .eq("status", "OPEN");

  if (error || !data) return { skills: [], timezones: [] };

  const skills = new Set<string>();
  const timezones = new Set<string>();
  for (const row of data) {
    for (const skill of row.required_skills ?? []) skills.add(skill);
    if (row.timezone) timezones.add(row.timezone);
  }

  return {
    skills: [...skills].sort((a, b) => a.localeCompare(b)),
    timezones: [...timezones].sort((a, b) => a.localeCompare(b)),
  };
});

/**
 * A single job for the "View Job" page, plus whether this VA has already
 * applied — read from job_applications, scoped to `va_id = auth.uid()` by
 * RLS regardless of the .eq() filter here (defense in depth, same
 * pattern as the client-side job DAL).
 */
export const getVaJob = cache(async (jobId: string): Promise<VaJobDetail | null> => {
  const supabase = await createSupabaseServerClient();

  const [{ data: job, error }, { data: application }] = await Promise.all([
    supabase
      .from("va_jobs_view")
      .select(
        "id, title, description, responsibilities, required_skills, schedule, timezone, hours_per_week, experience_level, va_hourly_rate, num_vas_required, application_deadline, created_at, status"
      )
      .eq("id", jobId)
      .maybeSingle(),
    supabase
      .from("job_applications")
      .select("status")
      .eq("job_id", jobId)
      .maybeSingle(),
  ]);

  if (error || !job || !job.id || !job.title || job.va_hourly_rate == null || !job.created_at) {
    return null;
  }

  return {
    id: job.id,
    title: job.title,
    description: job.description,
    responsibilities: job.responsibilities,
    requiredSkills: job.required_skills ?? [],
    schedule: job.schedule,
    timezone: job.timezone,
    hoursPerWeek: job.hours_per_week,
    experienceLevel: job.experience_level as JobExperienceLevel | null,
    vaHourlyRate: job.va_hourly_rate,
    numVasRequired: job.num_vas_required ?? 1,
    applicationDeadline: job.application_deadline,
    createdAt: job.created_at,
    status: (job.status as JobStatus) ?? "OPEN",
    hasApplied: !!application,
    applicationStatus: (application?.status as ApplicationStatus | undefined) ?? null,
  };
});
