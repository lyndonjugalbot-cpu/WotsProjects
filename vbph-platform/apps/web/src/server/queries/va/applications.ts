import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@vbph/schemas";

export interface VaApplicationListItem {
  id: string;
  jobId: string;
  jobTitle: string;
  status: ApplicationStatus;
  createdAt: string;
}

/**
 * The VA's own applications. Reads job_applications directly (RLS:
 * job_applications_select_own_va scopes this to va_id = auth.uid()
 * already) joined against va_jobs_view for the job title — va_jobs_view
 * always includes a job this VA has applied to regardless of its current
 * status, so the title lookup can't silently go missing.
 */
export const getVaApplications = cache(async (vaId: string): Promise<VaApplicationListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: applications, error } = await supabase
    .from("job_applications")
    .select("id, job_id, status, created_at")
    .eq("va_id", vaId)
    .order("created_at", { ascending: false });

  if (error || !applications || applications.length === 0) return [];

  const jobIds = [...new Set(applications.map((a) => a.job_id))];
  const { data: jobs } = await supabase.from("va_jobs_view").select("id, title").in("id", jobIds);
  const titleById = new Map((jobs ?? []).map((j) => [j.id, j.title ?? "Untitled job"]));

  return applications.map((a) => ({
    id: a.id,
    jobId: a.job_id,
    jobTitle: titleById.get(a.job_id) ?? "Untitled job",
    status: a.status as ApplicationStatus,
    createdAt: a.created_at,
  }));
});
