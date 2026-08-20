import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TimesheetStatus } from "@vbph/schemas";
import { computeTimesheetHours, type TimesheetHours } from "../shared/timesheet-hours";

export interface ClientTimesheetListItem extends TimesheetHours {
  id: string;
  placementId: string;
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  vaFullName: string;
  projectName: string | null;
}

/**
 * Read-only. Deliberately does NOT generate missing rows the way the
 * admin equivalent (getTimesheetsForWeek) does — that's an admin-only
 * write (timesheets has no INSERT policy for CLIENT at all, by design;
 * see the weekly_timesheets migration), so a week an admin hasn't
 * reviewed yet simply shows nothing here rather than being created on a
 * client's behalf.
 *
 * Queries through client_placements_view, never the base `placements`
 * table or admin_placements_view — the former has no client_hourly_rate
 * column at all, so there is nothing rate-related this function could
 * even accidentally select. Same reasoning as everywhere else this view
 * is used: "clients can't manipulate financial rate calculations" here
 * is structural (the column doesn't exist in this read path), not a
 * convention this function has to remember to honor.
 */
export const getClientTimesheetsForWeek = cache(
  async (clientId: string, weekStartIso: string): Promise<ClientTimesheetListItem[]> => {
    const supabase = await createSupabaseServerClient();

    const { data: placements } = await supabase
      .from("client_placements_view")
      .select("id, va_id, project_id")
      .eq("client_id", clientId);

    const validPlacements = (placements ?? []).filter(
      (p): p is typeof p & { id: string; va_id: string } => !!p.id && !!p.va_id
    );
    if (validPlacements.length === 0) return [];

    const placementById = new Map(validPlacements.map((p) => [p.id, p]));

    const { data: timesheets } = await supabase
      .from("timesheets")
      .select(
        "id, placement_id, week_start, week_end, status, tracked_hours, approved_hours, rejected_hours, pending_hours"
      )
      .in(
        "placement_id",
        validPlacements.map((p) => p.id)
      )
      .eq("week_start", weekStartIso);

    if (!timesheets || timesheets.length === 0) return [];

    const vaIds = [...new Set(validPlacements.map((p) => p.va_id))];
    const projectIds = [...new Set(validPlacements.map((p) => p.project_id).filter((id): id is string => !!id))];
    const [{ data: profiles }, { data: projects }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", vaIds),
      projectIds.length > 0
        ? supabase.from("projects").select("id, name").in("id", projectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const vaById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed VA"]));
    const projectById = new Map((projects ?? []).map((p) => [p.id, p.name]));

    return Promise.all(
      timesheets.map(async (t) => {
        const placement = placementById.get(t.placement_id);
        const hours: TimesheetHours =
          t.status === "LOCKED"
            ? {
                trackedHours: t.tracked_hours ?? 0,
                approvedHours: t.approved_hours ?? 0,
                rejectedHours: t.rejected_hours ?? 0,
                pendingHours: t.pending_hours ?? 0,
              }
            : await computeTimesheetHours(supabase, t.placement_id, weekStartIso);
        return {
          id: t.id,
          placementId: t.placement_id,
          weekStart: t.week_start,
          weekEnd: t.week_end,
          status: t.status as TimesheetStatus,
          vaFullName: placement ? (vaById.get(placement.va_id) ?? "Unnamed VA") : "Unnamed VA",
          projectName: placement?.project_id ? (projectById.get(placement.project_id) ?? null) : null,
          ...hours,
        };
      })
    );
  }
);
