import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface VaCompensationRow {
  timesheetId: string;
  placementId: string;
  companyName: string;
  projectName: string | null;
  weekStart: string;
  weekEnd: string;
  approvedHours: number;
  vaHourlyRate: number;
  expectedCompensation: number;
}

/**
 * A VA's own Hours / Rate / Expected Compensation, per LOCKED timesheet,
 * most recent week first. Reads va_compensation_view (see the
 * va_compensation migration) — that view has no client_hourly_rate or
 * margin column at all, so there is nothing rate-sensitive this function
 * could select even by mistake; it only resolves company/project display
 * names for the placements the view already scoped to this VA.
 */
export const getVaCompensationHistory = cache(async (vaId: string): Promise<VaCompensationRow[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("va_compensation_view")
    .select("timesheet_id, placement_id, week_start, week_end, approved_hours, va_hourly_rate, expected_compensation")
    .order("week_start", { ascending: false });

  const valid = (rows ?? []).filter(
    (
      r
    ): r is typeof r & {
      timesheet_id: string;
      placement_id: string;
      week_start: string;
      week_end: string;
      approved_hours: number;
      va_hourly_rate: number;
    } =>
      !!r.timesheet_id &&
      !!r.placement_id &&
      !!r.week_start &&
      !!r.week_end &&
      r.approved_hours != null &&
      r.va_hourly_rate != null
  );
  if (valid.length === 0) return [];

  const { data: placements } = await supabase
    .from("va_placements_view")
    .select("id, client_id, project_id")
    .eq("va_id", vaId)
    .in(
      "id",
      valid.map((r) => r.placement_id)
    );
  const placementById = new Map((placements ?? []).map((p) => [p.id, p]));

  const clientIds = [...new Set((placements ?? []).map((p) => p.client_id).filter((id): id is string => !!id))];
  const projectIds = [...new Set((placements ?? []).map((p) => p.project_id).filter((id): id is string => !!id))];
  const [{ data: clients }, { data: projects }] = await Promise.all([
    clientIds.length > 0
      ? supabase.from("clients").select("id, company_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const clientById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const projectById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return valid.map((r) => {
    const placement = placementById.get(r.placement_id);
    return {
      timesheetId: r.timesheet_id,
      placementId: r.placement_id,
      companyName: placement?.client_id ? (clientById.get(placement.client_id) ?? "Unknown company") : "Unknown company",
      projectName: placement?.project_id ? (projectById.get(placement.project_id) ?? null) : null,
      weekStart: r.week_start,
      weekEnd: r.week_end,
      approvedHours: r.approved_hours,
      vaHourlyRate: r.va_hourly_rate,
      expectedCompensation: r.expected_compensation ?? 0,
    };
  });
});
