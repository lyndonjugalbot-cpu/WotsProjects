import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@vbph/ui";
import { getTimesheetDetail } from "@/server/queries/admin/timesheets";
import { TimesheetStatusBadge } from "@/components/shared/timesheets/status-badge";
import { TimesheetStatusForm } from "@/components/admin/timesheet-status-form";
import { TimeEntryStatusForm } from "@/components/admin/time-entry-status-form";
import { TimesheetCorrectionForm } from "@/components/admin/timesheet-correction-form";

export const metadata: Metadata = { title: "Timesheet — Virtual Bridge PH" };

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

function formatDateRange(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const end = new Date(`${weekEnd}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${start} – ${end}`;
}

export default async function AdminTimesheetDetailPage({
  params,
}: {
  params: Promise<{ timesheetId: string }>;
}) {
  const { timesheetId } = await params;
  const timesheet = await getTimesheetDetail(timesheetId);
  if (!timesheet) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/timesheets" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Timesheets
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{timesheet.vaFullName}</h1>
          <p className="text-sm text-muted-foreground">
            {timesheet.companyName}
            {timesheet.projectName ? ` — ${timesheet.projectName}` : ""} · {formatDateRange(timesheet.weekStart, timesheet.weekEnd)}
          </p>
        </div>
        <TimesheetStatusBadge status={timesheet.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Tracked Hours" value={timesheet.trackedHours} />
        <StatTile label="Approved Hours" value={timesheet.approvedHours} className="text-success" />
        <StatTile label="Rejected Hours" value={timesheet.rejectedHours} className="text-destructive" />
        <StatTile label="Pending Hours" value={timesheet.pendingHours} className="text-muted-foreground" />
      </div>
      {timesheet.status !== "LOCKED" ? (
        <p className="text-xs text-muted-foreground">
          These totals are live — they reflect tracked time and review status as of right now, and will keep changing
          until this timesheet is locked.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          This timesheet is locked — these totals are a frozen snapshot taken at lock time and will not change on
          their own, regardless of any later segment or approval activity.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <TimesheetStatusForm timesheetId={timesheet.id} status={timesheet.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions this week</CardTitle>
        </CardHeader>
        <CardContent>
          {timesheet.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions with tracked time this week.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {timesheet.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(entry.startedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.hours.toFixed(2)}h tracked · {entry.segmentCount} segment{entry.segmentCount === 1 ? "" : "s"} ·{" "}
                      <span className="capitalize">{entry.status}</span>
                    </p>
                  </div>
                  <TimeEntryStatusForm timesheetId={timesheet.id} timeEntryId={entry.id} status={entry.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {timesheet.status === "LOCKED" && (
        <Card>
          <CardHeader>
            <CardTitle>Correct locked timesheet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Changes the frozen hours directly. Every correction requires a reason and is permanently recorded in the
              audit log below.
            </p>
          </CardHeader>
          <CardContent>
            <TimesheetCorrectionForm
              timesheetId={timesheet.id}
              trackedHours={timesheet.trackedHours}
              approvedHours={timesheet.approvedHours}
              rejectedHours={timesheet.rejectedHours}
              pendingHours={timesheet.pendingHours}
            />
          </CardContent>
        </Card>
      )}

      {timesheet.corrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Correction history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {timesheet.corrections.map((c) => {
              const metadata = c.metadata as {
                reason?: string;
                previous?: Record<string, number>;
                new?: Record<string, number>;
              };
              return (
                <div key={c.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} —{" "}
                    {c.actorName ?? "Unknown admin"}
                  </p>
                  {metadata.reason ? <p className="mt-1 text-foreground">{metadata.reason}</p> : null}
                  {metadata.previous && metadata.new ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tracked {metadata.previous.tracked_hours}h → {metadata.new.tracked_hours}h · Approved{" "}
                      {metadata.previous.approved_hours}h → {metadata.new.approved_hours}h · Rejected{" "}
                      {metadata.previous.rejected_hours}h → {metadata.new.rejected_hours}h · Pending{" "}
                      {metadata.previous.pending_hours}h → {metadata.new.pending_hours}h
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums text-foreground ${className ?? ""}`}>
          {formatHours(value)}
        </p>
      </CardContent>
    </Card>
  );
}
