"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@vbph/ui";
import { getWeekRange, shiftAnchorDate, todayIsoDate } from "@/lib/work-diary-date-range";

/**
 * Week-only navigation for the Timesheets pages — same prev/next/today
 * shape as DiaryNav, minus the day/week toggle (a timesheet only ever
 * exists per-week, there's no daily granularity to switch to).
 */
export function TimesheetWeekNav({ anchor }: { anchor: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextAnchor: string) {
    const params = new URLSearchParams(searchParams);
    params.set("week", nextAnchor);
    router.push(`${pathname}?${params.toString()}`);
  }

  const { startDate, endDate } = getWeekRange(anchor);
  const label = `${new Date(`${startDate}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${endDate}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigate(shiftAnchorDate(anchor, "week", -1))}
        aria-label="Previous week"
      >
        ←
      </Button>
      <span className="min-w-0 text-center text-sm font-medium text-foreground">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigate(shiftAnchorDate(anchor, "week", 1))}
        aria-label="Next week"
      >
        →
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => navigate(todayIsoDate())}>
        This week
      </Button>
    </div>
  );
}
