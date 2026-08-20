import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@vbph/types";

export interface TimesheetHours {
  trackedHours: number;
  approvedHours: number;
  rejectedHours: number;
  pendingHours: number;
}

const ZERO_HOURS: TimesheetHours = { trackedHours: 0, approvedHours: 0, rejectedHours: 0, pendingHours: 0 };

function segmentHours(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

/**
 * Live Tracked/Approved/Rejected/Pending hours for one placement's ISO
 * week — computed fresh from time_segments/time_entries on every call,
 * never stored, the same "derived, not stored" convention the Work Diary
 * feature already established (see getWeeklyHoursByPlacement in
 * shared/weekly-hours.ts, which this generalizes: that one only sums a
 * single "this week" total; this one buckets by review status too, and
 * accepts an arbitrary past week rather than always "now").
 *
 * This is what a NON-locked timesheet always shows. A LOCKED timesheet
 * never calls this — it reads its own frozen snapshot columns instead
 * (see server/queries/admin/timesheets.ts) — which is the whole point of
 * locking: once frozen, a later segment/status change here must NOT
 * silently change what a locked week reports.
 *
 * Bucketed by the PARENT time_entry's status, matching
 * getWorkDiaryBlocks()'s existing summary logic exactly — a segment has
 * no review status of its own, only its entry does.
 */
export async function computeTimesheetHours(
  supabase: SupabaseClient<Database>,
  placementId: string,
  weekStartIso: string
): Promise<TimesheetHours> {
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`);
  const weekEndExclusive = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Loosely bounded (not `started_at >= weekStart`), same reasoning as
  // getWeeklyHoursByPlacement: a session that started before this week can
  // still have segments landing inside it.
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, status")
    .eq("placement_id", placementId)
    .or(`ended_at.is.null,ended_at.gte.${weekStart.toISOString()}`);

  if (!entries || entries.length === 0) return { ...ZERO_HOURS };

  const statusByEntry = new Map(entries.map((e) => [e.id, e.status]));

  const { data: segments } = await supabase
    .from("time_segments")
    .select("time_entry_id, segment_start, segment_end")
    .in(
      "time_entry_id",
      entries.map((e) => e.id)
    )
    .gte("segment_start", weekStart.toISOString())
    .lt("segment_start", weekEndExclusive.toISOString());

  if (!segments || segments.length === 0) return { ...ZERO_HOURS };

  const hours = { ...ZERO_HOURS };
  for (const segment of segments) {
    const status = statusByEntry.get(segment.time_entry_id);
    const duration = segmentHours(segment.segment_start, segment.segment_end);
    hours.trackedHours += duration;
    if (status === "approved") hours.approvedHours += duration;
    else if (status === "rejected") hours.rejectedHours += duration;
    else hours.pendingHours += duration;
  }

  return {
    trackedHours: Math.round(hours.trackedHours * 100) / 100,
    approvedHours: Math.round(hours.approvedHours * 100) / 100,
    rejectedHours: Math.round(hours.rejectedHours * 100) / 100,
    pendingHours: Math.round(hours.pendingHours * 100) / 100,
  };
}
