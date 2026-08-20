import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlacementStatus } from "@vbph/schemas";

export interface VaPlacementCard {
  id: string;
  companyName: string;
  projectName: string | null;
  jobTitle: string | null;
  /** The VA's own payout rate — never the client's rate or the agency margin. */
  vaHourlyRate: number;
  hoursPerWeekExpected: number | null;
  status: PlacementStatus;
  startDate: string;
}

/**
 * The VA's own placements, visible "after activation" — ACTIVE and PAUSED
 * (a paused placement is still a real assignment, just on hold; PENDING
 * isn't shown here since the VA hasn't actually started yet, and ENDED
 * ones are history, not the current dashboard). Reads va_placements_view
 * (va_hourly_rate only, no client_hourly_rate/agency_margin — see
 * docs/database.md), joined against clients/projects/va_jobs_view for
 * display names. Each of those three reads is scoped by its own RLS to
 * rows this VA actually has a placement against
 * (clients_select_va/projects_select_va/va_jobs_view's placement clause).
 */
export const getVaPlacements = cache(async (vaId: string): Promise<VaPlacementCard[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: placements, error } = await supabase
    .from("va_placements_view")
    .select("id, client_id, job_id, project_id, va_hourly_rate, hours_per_week_expected, status, start_date")
    .eq("va_id", vaId)
    .in("status", ["ACTIVE", "PAUSED"])
    .order("start_date", { ascending: false });

  if (error || !placements || placements.length === 0) return [];

  const valid = placements.filter(
    (p): p is typeof p & { id: string; client_id: string; va_hourly_rate: number; status: string; start_date: string } =>
      !!p.id && !!p.client_id && p.va_hourly_rate != null && !!p.status && !!p.start_date
  );

  const clientIds = [...new Set(valid.map((p) => p.client_id))];
  const jobIds = [...new Set(valid.map((p) => p.job_id).filter((id): id is string => !!id))];
  const projectIds = [...new Set(valid.map((p) => p.project_id).filter((id): id is string => !!id))];

  const [{ data: clients }, { data: jobs }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, company_name").in("id", clientIds),
    jobIds.length > 0
      ? supabase.from("va_jobs_view").select("id, title").in("id", jobIds)
      : Promise.resolve({ data: [] as { id: string | null; title: string | null }[] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const clientById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const jobById = new Map((jobs ?? []).filter((j) => !!j.id).map((j) => [j.id as string, j.title ?? "Untitled job"]));
  const projectById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return valid.map((p) => ({
    id: p.id,
    companyName: clientById.get(p.client_id) ?? "Unknown company",
    projectName: p.project_id ? (projectById.get(p.project_id) ?? null) : null,
    jobTitle: p.job_id ? (jobById.get(p.job_id) ?? null) : null,
    vaHourlyRate: p.va_hourly_rate,
    hoursPerWeekExpected: p.hours_per_week_expected,
    status: p.status as PlacementStatus,
    startDate: p.start_date,
  }));
});
