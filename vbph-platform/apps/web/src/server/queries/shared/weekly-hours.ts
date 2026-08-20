import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@vbph/types";

/** Start of the current ISO week (Monday 00:00 UTC). */
export function getStartOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Hours tracked this week, per placement — summed from time_segments (the
 * actual atomic billable unit), not time_entries' start/end, so a session
 * that happens to straddle a week boundary is split correctly.
 *
 * Two round-trips (entries, then their segments) rather than a single
 * embedded query — PostgREST embedded-resource filtering on a nested
 * table's column is awkward to express reliably; this is clearer and the
 * data volumes here (one client's active placements) are small.
 */
export async function getWeeklyHoursByPlacement(
  supabase: SupabaseClient<Database>,
  placementIds: string[]
): Promise<Map<string, number>> {
  const hoursByPlacement = new Map<string, number>();
  if (placementIds.length === 0) return hoursByPlacement;

  const weekStart = getStartOfIsoWeek(new Date());

  // Entries that could possibly have segments landing in this week: still
  // ongoing (ended_at null) or ended on/after the week started. Filtering
  // this loosely (not `started_at >= weekStart`) matters — a multi-day
  // session that started last week can still log segments this week.
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, placement_id")
    .in("placement_id", placementIds)
    .or(`ended_at.is.null,ended_at.gte.${weekStart.toISOString()}`);

  if (!entries || entries.length === 0) return hoursByPlacement;

  const entryToPlacement = new Map(entries.map((e) => [e.id, e.placement_id]));

  const { data: segments } = await supabase
    .from("time_segments")
    .select("time_entry_id, segment_start, segment_end")
    .in(
      "time_entry_id",
      entries.map((e) => e.id)
    )
    .gte("segment_start", weekStart.toISOString());

  if (!segments) return hoursByPlacement;

  for (const segment of segments) {
    const placementId = entryToPlacement.get(segment.time_entry_id);
    if (!placementId) continue;
    const hours =
      (new Date(segment.segment_end).getTime() - new Date(segment.segment_start).getTime()) /
      3_600_000;
    hoursByPlacement.set(placementId, (hoursByPlacement.get(placementId) ?? 0) + hours);
  }

  return hoursByPlacement;
}
