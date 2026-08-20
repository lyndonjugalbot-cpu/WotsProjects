import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import { Card, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getClientTimesheetsForWeek } from "@/server/queries/client/timesheets";
import { getWeekRange, todayIsoDate } from "@/lib/work-diary-date-range";
import { TimesheetWeekNav } from "@/components/shared/timesheets/week-nav";
import { TimesheetStatusBadge } from "@/components/shared/timesheets/status-badge";

export const metadata: Metadata = { title: "Timesheets — Virtual Bridge PH" };

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

export default async function ClientTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { clientId } = await getClientContext();
  const query = await searchParams;
  const anchor = query.week ?? todayIsoDate();
  const { startDate } = getWeekRange(anchor);

  const timesheets = await getClientTimesheetsForWeek(clientId, startDate);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Timesheets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tracked hours for your team, by week. Read-only — reviewing and locking timesheets is handled by Virtual
          Bridge PH.
        </p>
      </div>

      <TimesheetWeekNav anchor={startDate} />

      {timesheets.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarX2} title="No timesheets for this week yet" description="Check back once your team's tracked hours have been reviewed." />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>VA</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Tracked</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-foreground">{t.vaFullName}</TableCell>
                <TableCell className="text-muted-foreground">{t.projectName ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatHours(t.trackedHours)}</TableCell>
                <TableCell className="text-right tabular-nums text-success">{formatHours(t.approvedHours)}</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">{formatHours(t.rejectedHours)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatHours(t.pendingHours)}</TableCell>
                <TableCell>
                  <TimesheetStatusBadge status={t.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
