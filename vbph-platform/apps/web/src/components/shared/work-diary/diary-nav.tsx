"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button, cn } from "@vbph/ui";
import {
  getDiaryDateRange,
  shiftAnchorDate,
  todayIsoDate,
  type DiaryView,
} from "@/lib/work-diary-date-range";

export function DiaryNav({ view, anchor }: { view: DiaryView; anchor: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextView: DiaryView, nextAnchor: string) {
    const params = new URLSearchParams(searchParams);
    params.set("view", nextView);
    params.set("date", nextAnchor);
    router.push(`${pathname}?${params.toString()}`);
  }

  const { startDate, endDate } = getDiaryDateRange(view, anchor);
  const label =
    view === "day"
      ? new Date(`${startDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : `${new Date(`${startDate}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${endDate}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1 rounded-md border border-input p-0.5" role="group" aria-label="View">
        {(["day", "week"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => navigate(v, anchor)}
            aria-pressed={view === v}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(view, shiftAnchorDate(anchor, view, -1))}
          aria-label="Previous"
        >
          ←
        </Button>
        <span className="min-w-0 text-center text-sm font-medium text-foreground">{label}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(view, shiftAnchorDate(anchor, view, 1))}
          aria-label="Next"
        >
          →
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(view, todayIsoDate())}>
          Today
        </Button>
      </div>
    </div>
  );
}
