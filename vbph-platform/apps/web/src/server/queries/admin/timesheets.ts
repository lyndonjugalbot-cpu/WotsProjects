import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TimesheetStatus } from "@vbph/schemas";
import { computeTimesheetHours, type TimesheetHours } from "../shared/timesheet-hours";

export interface AdminTimesheetListItem extends TimesheetHours {
  id: string;
  placementId: string;
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  companyName: string;
  vaFullName: string;
  projectName: string | null;
  /** The placement's CURRENT status — not necessarily "ACTIVE": a placement can end after weeks it was tracked in already have timesheets. */
  placementStatus: string;
}

export interface TimesheetDetailEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: "pending" | "approved" | "rejected";
  segmentCount: number;
  hours: number;
}

export interface AdminTimesheetDetail extends AdminTimesheetListItem {
  clientId: string;
  vaId: string;
  entries: TimesheetDetailEntry[];
  corrections: {
    id: string;
    createdAt: string;
    actorName: string | null;
    metadata: Record<string, unknown>;
  }[];
}

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function resolvePlacementNames(
  supabase: SupabaseServerClient,
  placements: { id: string; client_id: string; va_id: string; project_id: string | null }[]
) {
  const clientIds = [...new Set(placements.map((p) => p.client_id))];
  const vaIds = [...new Set(placements.map((p) => p.va_id))];
  const projectIds = [...new Set(placements.map((p) => p.project_id).filter((id): id is string => !!id))];

  const [{ data: clients }, { data: profiles }, { data: projects }] = await Promise.all([
    clientIds.length > 0
      ? supabase.from("clients").select("id, company_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
    vaIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", vaIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return {
    clientById: new Map((clients ?? []).map((c) => [c.id, c.company_name])),
    vaById: new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed VA"])),
    projectById: new Map((projects ?? []).map((p) => [p.id, p.name])),
  };
}

/**
 * Idempotent generation step — "for each active placement, create a
 * weekly timesheet." Called at the top of every admin timesheets-list
 * read (see getTimesheetsForWeek below), not from a separate button or a
 * scheduled job: this app has no cron/job-runner infrastructure yet, and
 * an upsert with `ignoreDuplicates` is cheap and safe to run on every
 * page view — it only ever inserts rows that don't exist yet, never
 * touches one that does (an existing row's status/hours are never
 * overwritten here, regardless of how many times this runs).
 *
 * A placement counts as needing a timesheet for this week if EITHER it's
 * currently ACTIVE (so a VA with zero tracked hours yet still gets a
 * visible OPEN row — "for each active placement," literally) OR it has
 * at least one real time_segment landing in this week regardless of the
 * placement's CURRENT status (so navigating to a past week still shows
 * timesheets for a placement that has since ended — the common real case
 * of reviewing history after an assignment wraps up).
 */
async function ensureTimesheetsForWeek(supabase: SupabaseServerClient, weekStartIso: string): Promise<void> {
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`);
  const weekEndExclusive = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [{ data: activePlacements }, { data: segmentsInWeek }] = await Promise.all([
    supabase.from("admin_placements_view").select("id").eq("status", "ACTIVE"),
    supabase
      .from("time_segments")
      .select("time_entry_id")
      .gte("segment_start", weekStart.toISOString())
      .lt("segment_start", weekEndExclusive.toISOString()),
  ]);

  const entryIds = [...new Set((segmentsInWeek ?? []).map((s) => s.time_entry_id))];
  const { data: entries } =
    entryIds.length > 0
      ? await supabase.from("time_entries").select("placement_id").in("id", entryIds)
      : { data: [] as { placement_id: string }[] };

  const placementIds = new Set<string>([
    ...(activePlacements ?? []).map((p) => p.id).filter((id): id is string => !!id),
    ...(entries ?? []).map((e) => e.placement_id),
  ]);
  if (placementIds.size === 0) return;

  await supabase.from("timesheets").upsert(
    [...placementIds].map((placementId) => ({ placement_id: placementId, week_start: weekStartIso })),
    { onConflict: "placement_id,week_start", ignoreDuplicates: true }
  );
}

/** LOCKED reads its frozen snapshot; anything else is computed live — see computeTimesheetHours. */
async function resolveHours(
  supabase: SupabaseServerClient,
  timesheet: {
    placement_id: string;
    week_start: string;
    status: string;
    tracked_hours: number | null;
    approved_hours: number | null;
    rejected_hours: number | null;
    pending_hours: number | null;
  }
): Promise<TimesheetHours> {
  if (timesheet.status === "LOCKED") {
    return {
      trackedHours: timesheet.tracked_hours ?? 0,
      approvedHours: timesheet.approved_hours ?? 0,
      rejectedHours: timesheet.rejected_hours ?? 0,
      pendingHours: timesheet.pending_hours ?? 0,
    };
  }
  return computeTimesheetHours(supabase, timesheet.placement_id, timesheet.week_start);
}

export const getTimesheetsForWeek = cache(async (weekStartIso: string): Promise<AdminTimesheetListItem[]> => {
  const supabase = await createSupabaseServerClient();
  await ensureTimesheetsForWeek(supabase, weekStartIso);

  const { data: timesheets } = await supabase
    .from("timesheets")
    .select("id, placement_id, week_start, week_end, status, tracked_hours, approved_hours, rejected_hours, pending_hours, created_at")
    .eq("week_start", weekStartIso)
    .order("created_at", { ascending: true });

  if (!timesheets || timesheets.length === 0) return [];

  const placementIds = [...new Set(timesheets.map((t) => t.placement_id))];
  const { data: placements } = await supabase
    .from("admin_placements_view")
    .select("id, client_id, va_id, project_id, status")
    .in("id", placementIds);

  const validPlacements = (placements ?? []).filter(
    (p): p is typeof p & { id: string; client_id: string; va_id: string; status: string } =>
      !!p.id && !!p.client_id && !!p.va_id && !!p.status
  );
  const placementById = new Map(validPlacements.map((p) => [p.id, p]));
  const { clientById, vaById, projectById } = await resolvePlacementNames(supabase, validPlacements);

  return Promise.all(
    timesheets.map(async (t) => {
      const placement = placementById.get(t.placement_id);
      const hours = await resolveHours(supabase, t);
      return {
        id: t.id,
        placementId: t.placement_id,
        weekStart: t.week_start,
        weekEnd: t.week_end,
        status: t.status as TimesheetStatus,
        companyName: placement ? (clientById.get(placement.client_id) ?? "Unknown company") : "Unknown company",
        vaFullName: placement ? (vaById.get(placement.va_id) ?? "Unnamed VA") : "Unnamed VA",
        projectName: placement?.project_id ? (projectById.get(placement.project_id) ?? null) : null,
        placementStatus: placement?.status ?? "ENDED",
        ...hours,
      };
    })
  );
});

export const getTimesheetDetail = cache(async (timesheetId: string): Promise<AdminTimesheetDetail | null> => {
  const supabase = await createSupabaseServerClient();

  const { data: timesheet } = await supabase
    .from("timesheets")
    .select(
      "id, placement_id, week_start, week_end, status, tracked_hours, approved_hours, rejected_hours, pending_hours"
    )
    .eq("id", timesheetId)
    .maybeSingle();

  if (!timesheet) return null;

  const { data: placement } = await supabase
    .from("admin_placements_view")
    .select("id, client_id, va_id, project_id, status")
    .eq("id", timesheet.placement_id)
    .maybeSingle();

  if (!placement || !placement.id || !placement.client_id || !placement.va_id) return null;

  const { clientById, vaById, projectById } = await resolvePlacementNames(supabase, [
    { id: placement.id, client_id: placement.client_id, va_id: placement.va_id, project_id: placement.project_id },
  ]);

  const hours = await resolveHours(supabase, timesheet);

  // The individual sessions within this week, for the per-entry
  // Approve/Reject controls — "questionable time" is reviewed at the
  // time_entry grain, since that's what time_entries.status actually is.
  const weekStart = new Date(`${timesheet.week_start}T00:00:00.000Z`);
  const weekEndExclusive = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, started_at, ended_at, status")
    .eq("placement_id", timesheet.placement_id)
    .or(`ended_at.is.null,ended_at.gte.${weekStart.toISOString()}`);

  const entryDetails: TimesheetDetailEntry[] = [];
  if (entries && entries.length > 0) {
    const { data: segments } = await supabase
      .from("time_segments")
      .select("time_entry_id, segment_start, segment_end")
      .in(
        "time_entry_id",
        entries.map((e) => e.id)
      )
      .gte("segment_start", weekStart.toISOString())
      .lt("segment_start", weekEndExclusive.toISOString());

    for (const entry of entries) {
      const entrySegments = (segments ?? []).filter((s) => s.time_entry_id === entry.id);
      if (entrySegments.length === 0) continue; // no tracked time in THIS week for this entry
      const hoursForEntry = entrySegments.reduce(
        (sum, s) => sum + (new Date(s.segment_end).getTime() - new Date(s.segment_start).getTime()) / 3_600_000,
        0
      );
      entryDetails.push({
        id: entry.id,
        startedAt: entry.started_at,
        endedAt: entry.ended_at,
        status: entry.status as "pending" | "approved" | "rejected",
        segmentCount: entrySegments.length,
        hours: Math.round(hoursForEntry * 100) / 100,
      });
    }
    entryDetails.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  const { data: auditRows } = await supabase
    .from("audit_logs")
    .select("id, created_at, actor_id, metadata")
    .eq("target_table", "timesheets")
    .eq("target_id", timesheetId)
    .eq("action", "timesheet_locked_correction")
    .order("created_at", { ascending: false });

  const actorIds = [...new Set((auditRows ?? []).map((r) => r.actor_id).filter((id): id is string => !!id))];
  const { data: actors } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const actorNameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return {
    id: timesheet.id,
    placementId: timesheet.placement_id,
    clientId: placement.client_id,
    vaId: placement.va_id,
    weekStart: timesheet.week_start,
    weekEnd: timesheet.week_end,
    status: timesheet.status as TimesheetStatus,
    companyName: clientById.get(placement.client_id) ?? "Unknown company",
    vaFullName: vaById.get(placement.va_id) ?? "Unnamed VA",
    projectName: placement.project_id ? (projectById.get(placement.project_id) ?? null) : null,
    placementStatus: placement.status ?? "ENDED",
    ...hours,
    entries: entryDetails,
    corrections: (auditRows ?? []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      actorName: r.actor_id ? (actorNameById.get(r.actor_id) ?? null) : null,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
    })),
  };
});
