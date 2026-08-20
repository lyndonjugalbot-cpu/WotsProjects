import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarX2 } from "lucide-react";
import { Card, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@vbph/ui";
import { getTimesheetsForWeek } from "@/server/queries/admin/timesheets";
import { getWeekRange, todayIsoDate } from "@/lib/work-diary-date-range";
import { TimesheetWeekNav } from "@/components/shared/timesheets/week-nav";
import { TimesheetStatusBadge } from "@/components/shared/timesheets/status-badge";

export const metadata: Metadata = { title: "Timesheets — Virtual Bridge PH" };

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

export default async function AdminTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const query = await searchParams;
  const anchor = query.week ?? todayIsoDate();
  const { startDate } = getWeekRange(anchor);

  const timesheets = await getTimesheetsForWeek(startDate);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Timesheets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One row per active placement, aggregated by week. Generated automatically for every currently-active
          placement the first time a week is viewed here.
        </p>
      </div>

      <TimesheetWeekNav anchor={startDate} />

      {timesheets.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarX2}
            title="Nothing to review this week"
            description="No placements were active or tracked time during this week."
          />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>VA</TableHead>
              <TableHead>Client / Project</TableHead>
              <TableHead className="text-right">Tracked</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-foreground">{t.vaFullName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.companyName}
                  {t.projectName ? ` — ${t.projectName}` : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatHours(t.trackedHours)}</TableCell>
                <TableCell className="text-right tabular-nums text-success">{formatHours(t.approvedHours)}</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">{formatHours(t.rejectedHours)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatHours(t.pendingHours)}</TableCell>
                <TableCell>
                  <TimesheetStatusBadge status={t.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/timesheets/${t.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline"
                  >
                    Review
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
