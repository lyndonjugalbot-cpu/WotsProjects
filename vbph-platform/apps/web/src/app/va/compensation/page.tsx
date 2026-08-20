import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Card, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@vbph/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getVaCompensationHistory } from "@/server/queries/va/compensation";

export const metadata: Metadata = { title: "Compensation — Virtual Bridge PH" };

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const e = new Date(`${end}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${s} – ${e}`;
}

export default async function VaCompensationPage() {
  const user = await requireRole("VA");
  const rows = await getVaCompensationHistory(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Compensation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your approved hours and rate, by week, once a week is locked. This is an internal calculation, not a
          payment record.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Nothing here yet"
            description="This fills in once one of your weeks is locked."
          />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead>Placement</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Your Rate</TableHead>
              <TableHead className="text-right">Expected Compensation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.timesheetId}>
                <TableCell className="text-muted-foreground">{formatDateRange(r.weekStart, r.weekEnd)}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {r.companyName}
                  {r.projectName ? ` — ${r.projectName}` : ""}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{r.approvedHours.toFixed(4)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(r.vaHourlyRate)}/hr</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">
                  {formatCurrency(r.expectedCompensation)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
