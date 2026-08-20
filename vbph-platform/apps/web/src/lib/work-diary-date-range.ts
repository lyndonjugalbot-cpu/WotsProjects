// Plain date math, no server/env dependency — used by both the (client)
// nav component, which only needs to shift an anchor date, and the
// (server) page components, which turn that anchor into an actual
// {startDate, endDate} query range. All in UTC, matching how the rest of
// this app treats stored timestamps (see getStartOfIsoWeek in
// server/queries/shared/weekly-hours.ts, which this mirrors for a
// caller-supplied anchor date rather than always "now").

export type DiaryView = "day" | "week";

export function isoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return isoDateString(new Date());
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Monday–Sunday range (inclusive) containing the given anchor date. */
export function getWeekRange(anchor: string): { startDate: string; endDate: string } {
  const d = parseIsoDate(anchor);
  const day = d.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { startDate: isoDateString(monday), endDate: isoDateString(sunday) };
}

export function getDiaryDateRange(view: DiaryView, anchor: string): { startDate: string; endDate: string } {
  if (view === "day") return { startDate: anchor, endDate: anchor };
  return getWeekRange(anchor);
}

export function shiftAnchorDate(anchor: string, view: DiaryView, direction: 1 | -1): string {
  const d = parseIsoDate(anchor);
  const deltaDays = view === "day" ? 1 : 7;
  d.setUTCDate(d.getUTCDate() + deltaDays * direction);
  return isoDateString(d);
}
