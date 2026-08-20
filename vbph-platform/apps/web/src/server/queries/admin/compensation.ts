import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminCompensationRow {
  timesheetId: string;
  placementId: string;
  vaFullName: string;
  companyName: string;
  projectName: string | null;
  weekStart: string;
  weekEnd: string;
  approvedHours: number;
  clientRevenue: number;
  vaCompensation: number;
  grossMargin: number;
}

/**
 * Client Revenue / VA Compensation / Gross Margin, per LOCKED timesheet,
 * for one week across every placement — reads admin_compensation_view
 * (see the va_compensation migration), which does the actual
 * hours-times-rate arithmetic in Postgres `numeric`, not here. This
 * function only resolves display names for the ids the view returns.
 */
export const getCompensationForWeek = cache(async (weekStartIso: string): Promise<AdminCompensationRow[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("admin_compensation_view")
    .select(
      "timesheet_id, placement_id, client_id, va_id, week_start, week_end, approved_hours, client_revenue, va_compensation, gross_margin"
    )
    .eq("week_start", weekStartIso);

  const valid = (rows ?? []).filter(
    (
      r
    ): r is typeof r & {
      timesheet_id: string;
      placement_id: string;
      client_id: string;
      va_id: string;
      week_start: string;
      week_end: string;
      approved_hours: number;
    } =>
      !!r.timesheet_id &&
      !!r.placement_id &&
      !!r.client_id &&
      !!r.va_id &&
      !!r.week_start &&
      !!r.week_end &&
      r.approved_hours != null
  );
  if (valid.length === 0) return [];

  const { data: placements } = await supabase
    .from("admin_placements_view")
    .select("id, project_id")
    .in(
      "id",
      valid.map((r) => r.placement_id)
    );
  const projectIdByPlacement = new Map((placements ?? []).map((p) => [p.id, p.project_id]));

  const clientIds = [...new Set(valid.map((r) => r.client_id))];
  const vaIds = [...new Set(valid.map((r) => r.va_id))];
  const projectIds = [...new Set([...projectIdByPlacement.values()].filter((id): id is string => !!id))];

  const [{ data: clients }, { data: profiles }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, company_name").in("id", clientIds),
    supabase.from("profiles").select("id, full_name").in("id", vaIds),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const clientById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const vaById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed VA"]));
  const projectById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return valid
    .map((r) => {
      const projectId = projectIdByPlacement.get(r.placement_id) ?? null;
      return {
        timesheetId: r.timesheet_id,
        placementId: r.placement_id,
        vaFullName: vaById.get(r.va_id) ?? "Unnamed VA",
        companyName: clientById.get(r.client_id) ?? "Unknown company",
        projectName: projectId ? (projectById.get(projectId) ?? null) : null,
        weekStart: r.week_start,
        weekEnd: r.week_end,
        approvedHours: r.approved_hours,
        clientRevenue: r.client_revenue ?? 0,
        vaCompensation: r.va_compensation ?? 0,
        grossMargin: r.gross_margin ?? 0,
      };
    })
    .sort((a, b) => a.vaFullName.localeCompare(b.vaFullName));
});
