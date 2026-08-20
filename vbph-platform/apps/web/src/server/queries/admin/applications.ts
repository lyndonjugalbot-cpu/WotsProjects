import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@vbph/schemas";

export interface AdminApplicationListItem {
  id: string;
  jobTitle: string;
  companyName: string;
  vaFullName: string;
  status: ApplicationStatus;
  createdAt: string;
}

export interface AdminApplicationDetail {
  id: string;
  jobId: string;
  jobTitle: string;
  clientId: string;
  companyName: string;
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

export interface AdminNote {
  id: string;
  authorName: string | null;
  note: string;
  createdAt: string;
}

/**
 * Every application on the platform — admin only (job_applications_admin_all
 * grants unrestricted RLS access). Never joins application_admin_notes
 * here; that's fetched separately per-application on the detail page so
 * the list stays cheap.
 */
export const getAllApplications = cache(async (): Promise<AdminApplicationListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: applications, error } = await supabase
    .from("job_applications")
    .select("id, job_id, va_id, status, created_at")
    .order("created_at", { ascending: false });

  if (error || !applications || applications.length === 0) return [];

  const jobIds = [...new Set(applications.map((a) => a.job_id))];
  const vaIds = [...new Set(applications.map((a) => a.va_id))];

  // client_jobs_view, not the base `jobs` table: the base table has no
  // SELECT grant for `authenticated` at all beyond id/client_id (rate
  // privacy — see docs/database.md), which even admin doesn't bypass —
  // grants are enforced independently of RLS. client_jobs_view's WHERE
  // clause explicitly includes `or is_admin()`, so admin reads every
  // job's title through it, not just their own.
  const [{ data: jobs }, { data: profiles }] = await Promise.all([
    supabase.from("client_jobs_view").select("id, title, client_id").in("id", jobIds),
    supabase.from("profiles").select("id, full_name").in("id", vaIds),
  ]);

  const clientIds = [
    ...new Set((jobs ?? []).map((j) => j.client_id).filter((id): id is string => !!id)),
  ];
  const { data: clients } = await supabase.from("clients").select("id, company_name").in("id", clientIds);

  const jobById = new Map((jobs ?? []).filter((j) => !!j.id).map((j) => [j.id as string, j]));
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return applications.map((a) => {
    const job = jobById.get(a.job_id);
    const client = job?.client_id ? clientById.get(job.client_id) : undefined;
    return {
      id: a.id,
      jobTitle: job?.title ?? "Unknown job",
      companyName: client?.company_name ?? "Unknown company",
      vaFullName: nameById.get(a.va_id) ?? "Unnamed VA",
      status: a.status as ApplicationStatus,
      createdAt: a.created_at,
    };
  });
});

export const getAdminApplicationDetail = cache(
  async (applicationId: string): Promise<AdminApplicationDetail | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: application, error } = await supabase
      .from("job_applications")
      .select(
        "id, job_id, va_id, cover_note, relevant_experience, notes, expected_availability, status, created_at"
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (error || !application) return null;

    const [{ data: job }, { data: profile }, { data: vaProfile }] = await Promise.all([
      // client_jobs_view, not the base table — see the comment in
      // getAllApplications above.
      supabase
        .from("client_jobs_view")
        .select("id, title, client_id")
        .eq("id", application.job_id)
        .maybeSingle(),
      supabase.from("profiles").select("full_name, avatar_url").eq("id", application.va_id).maybeSingle(),
      supabase
        .from("va_profiles")
        .select("headline, skills, experience_years, resume_url, portfolio_url")
        .eq("id", application.va_id)
        .maybeSingle(),
    ]);

    const { data: client } = job?.client_id
      ? await supabase.from("clients").select("company_name").eq("id", job.client_id).maybeSingle()
      : { data: null };

    return {
      id: application.id,
      jobId: application.job_id,
      jobTitle: job?.title ?? "Unknown job",
      clientId: job?.client_id ?? "",
      companyName: client?.company_name ?? "Unknown company",
      vaId: application.va_id,
      vaFullName: profile?.full_name ?? "Unnamed VA",
      vaAvatarUrl: profile?.avatar_url ?? null,
      vaHeadline: vaProfile?.headline ?? null,
      vaSkills: vaProfile?.skills ?? [],
      vaExperienceYears: vaProfile?.experience_years ?? null,
      vaResumeUrl: vaProfile?.resume_url ?? null,
      vaPortfolioUrl: vaProfile?.portfolio_url ?? null,
      coverNote: application.cover_note,
      relevantExperience: application.relevant_experience,
      notes: application.notes,
      expectedAvailability: application.expected_availability,
      status: application.status as ApplicationStatus,
      createdAt: application.created_at,
    };
  }
);

/**
 * Confidential, admin-only notes for one application — reads
 * application_admin_notes, a table with no RLS path for CLIENT/VA at all
 * (see the application_workflow migration). This function is never
 * called from any client- or VA-facing page.
 */
export const getAdminNotes = cache(async (applicationId: string): Promise<AdminNote[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: notes, error } = await supabase
    .from("application_admin_notes")
    .select("id, note, created_at, author_id")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error || !notes || notes.length === 0) return [];

  const authorIds = [...new Set(notes.map((n) => n.author_id).filter((id): id is string => !!id))];
  const { data: authors } =
    authorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  return notes.map((n) => ({
    id: n.id,
    authorName: n.author_id ? (nameById.get(n.author_id) ?? "Unknown admin") : null,
    note: n.note,
    createdAt: n.created_at,
  }));
});
