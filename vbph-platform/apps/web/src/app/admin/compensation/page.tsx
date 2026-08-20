import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Card, CardContent, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@vbph/ui";
import { getCompensationForWeek } from "@/server/queries/admin/compensation";
import { getWeekRange, todayIsoDate } from "@/lib/work-diary-date-range";
import { TimesheetWeekNav } from "@/components/shared/timesheets/week-nav";

export const metadata: Metadata = { title: "Compensation — Virtual Bridge PH" };

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function AdminCompensationPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const query = await searchParams;
  const anchor = query.week ?? todayIsoDate();
  const { startDate } = getWeekRange(anchor);

  const rows = await getCompensationForWeek(startDate);
  const totals = rows.reduce(
    (acc, r) => ({
      clientRevenue: acc.clientRevenue + r.clientRevenue,
      vaCompensation: acc.vaCompensation + r.vaCompensation,
      grossMargin: acc.grossMargin + r.grossMargin,
    }),
    { clientRevenue: 0, vaCompensation: 0, grossMargin: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Compensation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal calculation only — this does not process or record any payment. Approved Hours × Placement VA
          Hourly Rate, per LOCKED timesheet.
        </p>
      </div>

      <TimesheetWeekNav anchor={startDate} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Client Revenue</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(totals.clientRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">VA Compensation</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(totals.vaCompensation)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">VBPH Gross Margin</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{formatCurrency(totals.grossMargin)}</p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="Nothing to calculate yet" description="No LOCKED timesheets for this week yet." />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>VA</TableHead>
              <TableHead>Client / Project</TableHead>
              <TableHead className="text-right">Approved Hours</TableHead>
              <TableHead className="text-right">Client Revenue</TableHead>
              <TableHead className="text-right">VA Compensation</TableHead>
              <TableHead className="text-right">Gross Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.timesheetId}>
                <TableCell className="font-medium text-foreground">{r.vaFullName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.companyName}
                  {r.projectName ? ` — ${r.projectName}` : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{r.approvedHours.toFixed(4)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(r.clientRevenue)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(r.vaCompensation)}</TableCell>
                <TableCell className="text-right tabular-nums text-success">{formatCurrency(r.grossMargin)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
