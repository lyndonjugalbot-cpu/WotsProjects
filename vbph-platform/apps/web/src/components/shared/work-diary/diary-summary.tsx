import { Card, CardContent } from "@vbph/ui";
import type { WorkDiarySummary } from "@/server/time-tracking/service";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function DiarySummaryStats({ summary }: { summary: WorkDiarySummary }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Tracked Time</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatDuration(summary.totalSeconds)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Approved Time</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-success">
              {formatDuration(summary.approvedSeconds)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Rejected Time</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
              {formatDuration(summary.rejectedSeconds)}
            </p>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Each block&apos;s Activity percentage reflects the share of that ~10-minute block with detected keyboard/mouse
        input — it is not a measure of productivity, work quality, or effort.
      </p>
    </div>
  );
}
