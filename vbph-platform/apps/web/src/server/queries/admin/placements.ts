import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlacementStatus } from "@vbph/schemas";

export interface AdminPlacementListItem {
  id: string;
  companyName: string;
  vaFullName: string;
  jobTitle: string | null;
  projectName: string | null;
  clientHourlyRate: number;
  vaHourlyRate: number;
  agencyMargin: number;
  status: PlacementStatus;
  startDate: string;
}

export interface AdminPlacementDetail extends AdminPlacementListItem {
  clientId: string;
  vaId: string;
  jobId: string | null;
  projectId: string | null;
  hoursPerWeekExpected: number | null;
  endDate: string | null;
}

async function attachNames(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  placements: {
    id: string;
    client_id: string;
    va_id: string;
    job_id: string | null;
    project_id: string | null;
  }[]
) {
  const clientIds = [...new Set(placements.map((p) => p.client_id))];
  const vaIds = [...new Set(placements.map((p) => p.va_id))];
  const jobIds = [...new Set(placements.map((p) => p.job_id).filter((id): id is string => !!id))];
  const projectIds = [...new Set(placements.map((p) => p.project_id).filter((id): id is string => !!id))];

  const [{ data: clients }, { data: profiles }, { data: jobs }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, company_name").in("id", clientIds),
    supabase.from("profiles").select("id, full_name").in("id", vaIds),
    jobIds.length > 0
      ? supabase.from("admin_jobs_view").select("id, title").in("id", jobIds)
      : Promise.resolve({ data: [] as { id: string | null; title: string | null }[] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return {
    clientById: new Map((clients ?? []).map((c) => [c.id, c.company_name])),
    vaById: new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed VA"])),
    jobById: new Map((jobs ?? []).filter((j) => !!j.id).map((j) => [j.id as string, j.title ?? "Untitled job"])),
    projectById: new Map((projects ?? []).map((p) => [p.id, p.name])),
  };
}

export const getAllPlacements = cache(async (): Promise<AdminPlacementListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: placements, error } = await supabase
    .from("admin_placements_view")
    .select(
      "id, client_id, va_id, job_id, project_id, client_hourly_rate, agency_margin, va_hourly_rate, status, start_date"
    )
    .order("start_date", { ascending: false });

  if (error || !placements || placements.length === 0) return [];

  const valid = placements.filter(
    (p): p is typeof p & { id: string; client_id: string; va_id: string; client_hourly_rate: number; agency_margin: number; va_hourly_rate: number; status: string; start_date: string } =>
      !!p.id && !!p.client_id && !!p.va_id && p.client_hourly_rate != null && p.agency_margin != null && p.va_hourly_rate != null && !!p.status && !!p.start_date
  );

  const { clientById, vaById, jobById, projectById } = await attachNames(supabase, valid);

  return valid.map((p) => ({
    id: p.id,
    companyName: clientById.get(p.client_id) ?? "Unknown company",
    vaFullName: vaById.get(p.va_id) ?? "Unnamed VA",
    jobTitle: p.job_id ? (jobById.get(p.job_id) ?? null) : null,
    projectName: p.project_id ? (projectById.get(p.project_id) ?? null) : null,
    clientHourlyRate: p.client_hourly_rate,
    vaHourlyRate: p.va_hourly_rate,
    agencyMargin: p.agency_margin,
    status: p.status as PlacementStatus,
    startDate: p.start_date,
  }));
});

export const getAdminPlacementDetail = cache(
  async (placementId: string): Promise<AdminPlacementDetail | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: placement, error } = await supabase
      .from("admin_placements_view")
      .select(
        "id, client_id, va_id, job_id, project_id, client_hourly_rate, agency_margin, va_hourly_rate, hours_per_week_expected, start_date, end_date, status"
      )
      .eq("id", placementId)
      .maybeSingle();

    if (
      error ||
      !placement ||
      !placement.id ||
      !placement.client_id ||
      !placement.va_id ||
      placement.client_hourly_rate == null ||
      placement.agency_margin == null ||
      placement.va_hourly_rate == null ||
      !placement.status ||
      !placement.start_date
    ) {
      return null;
    }

    const { clientById, vaById, jobById, projectById } = await attachNames(supabase, [
      {
        id: placement.id,
        client_id: placement.client_id,
        va_id: placement.va_id,
        job_id: placement.job_id,
        project_id: placement.project_id,
      },
    ]);

    return {
      id: placement.id,
      clientId: placement.client_id,
      vaId: placement.va_id,
      jobId: placement.job_id,
      projectId: placement.project_id,
      companyName: clientById.get(placement.client_id) ?? "Unknown company",
      vaFullName: vaById.get(placement.va_id) ?? "Unnamed VA",
      jobTitle: placement.job_id ? (jobById.get(placement.job_id) ?? null) : null,
      projectName: placement.project_id ? (projectById.get(placement.project_id) ?? null) : null,
      clientHourlyRate: placement.client_hourly_rate,
      vaHourlyRate: placement.va_hourly_rate,
      agencyMargin: placement.agency_margin,
      hoursPerWeekExpected: placement.hours_per_week_expected,
      startDate: placement.start_date,
      endDate: placement.end_date,
      status: placement.status as PlacementStatus,
    };
  }
);
