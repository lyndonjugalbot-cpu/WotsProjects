import { create } from "zustand";
import { timeApi } from "./apiClient";

// "Today"/"This Week" reflect only what's actually synced to the server
// (via GET /api/time/diary, RLS-scoped to this VA automatically — no
// placement filter, so it's every placement's time, matching how a
// personal time tracker's daily total should read). The still-running
// segment's not-yet-synced seconds are added on top at render time in
// TimerScreen (see currentSegmentStart there) rather than folded into
// this store, so this store never needs to know whether a timer is
// running.
//
// Day boundaries are UTC, matching the Work Diary web feature's own
// getDiaryDateRange — same underlying data, same definition of "a day,"
// so the two surfaces never disagree about which segment belongs to
// which day.

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekUtc(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diff);
  return monday;
}

interface TotalsState {
  todaySeconds: number;
  weekSeconds: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useTotalsStore = create<TotalsState>((set) => ({
  todaySeconds: 0,
  weekSeconds: 0,
  loading: false,

  async refresh() {
    set({ loading: true });
    try {
      const now = new Date();
      const todayStr = isoDate(now);
      const weekStartStr = isoDate(startOfWeekUtc(now));

      const { sessions } = await timeApi.diary(weekStartStr, todayStr);

      let today = 0;
      let week = 0;
      for (const session of sessions) {
        week += session.totalTimeSeconds;
        if (session.startTime.slice(0, 10) === todayStr) {
          today += session.totalTimeSeconds;
        }
      }
      set({ todaySeconds: today, weekSeconds: week, loading: false });
    } catch {
      // Best-effort — leave the last known totals on screen rather than
      // zeroing them out over a transient fetch failure.
      set({ loading: false });
    }
  },
}));
