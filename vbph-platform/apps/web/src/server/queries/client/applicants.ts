import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@vbph/schemas";

export interface JobApplicant {
  applicationId: string;
  vaId: string;
  vaFullName: string;
  vaAvatarUrl: string | null;
  vaHeadline: string | null;
  vaSkills: string[];
  vaExperienceYears: number | null;
  vaResumeUrl: string | null;
  vaPortfolioUrl: string | null;
  coverNote: string | null;
  relevantExperience: string | null;
  notes: string | null;
  expectedAvailability: string | null;
  status: ApplicationStatus;
  createdAt: string;
}

/**
 * Applicants for one of this client's own jobs. SECURITY: never call this
 * with a jobId that hasn't been confirmed to belong to clientId — this
 * function itself re-checks ownership via client_jobs_view (not just
 * trusting the caller), so a cross-client jobId returns an empty list
 * rather than another client's applicants. Admin notes are never queried
 * here at all — they live in a separate table (application_admin_notes)
 * this function doesn't touch, and RLS would deny a client's read of it
 * regardless (see docs/database.md).
 */
export const getJobApplicants = cache(
  async (clientId: string, jobId: string): Promise<JobApplicant[]> => {
    const supabase = await createSupabaseServerClient();

    const { data: job } = await supabase
      .from("client_jobs_view")
      .select("id")
      .eq("client_id", clientId)
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return [];

    const { data: applications, error } = await supabase
      .from("job_applications")
      .select(
        "id, va_id, cover_note, relevant_experience, notes, expected_availability, status, created_at"
      )
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error || !applications || applications.length === 0) return [];

    const vaIds = [...new Set(applications.map((a) => a.va_id))];
    const [{ data: profiles }, { data: vaProfiles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", vaIds),
      supabase
        .from("va_profiles")
        .select("id, headline, skills, experience_years, resume_url, portfolio_url")
        .in("id", vaIds),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const vaProfileById = new Map((vaProfiles ?? []).map((p) => [p.id, p]));

    return applications.map((a) => {
      const profile = profileById.get(a.va_id);
      const vaProfile = vaProfileById.get(a.va_id);
      return {
        applicationId: a.id,
        vaId: a.va_id,
        vaFullName: profile?.full_name ?? "Unnamed VA",
        vaAvatarUrl: profile?.avatar_url ?? null,
        vaHeadline: vaProfile?.headline ?? null,
        vaSkills: vaProfile?.skills ?? [],
        vaExperienceYears: vaProfile?.experience_years ?? null,
        vaResumeUrl: vaProfile?.resume_url ?? null,
        vaPortfolioUrl: vaProfile?.portfolio_url ?? null,
        coverNote: a.cover_note,
        relevantExperience: a.relevant_experience,
        notes: a.notes,
        expectedAvailability: a.expected_availability,
        status: a.status as ApplicationStatus,
        createdAt: a.created_at,
      };
    });
  }
);
