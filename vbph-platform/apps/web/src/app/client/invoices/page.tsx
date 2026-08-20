import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { Card, CardContent, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getClientAmountDue, getClientInvoices } from "@/server/queries/client/invoices";
import { InvoiceStatusBadge } from "@/components/shared/invoices/status-badge";

export const metadata: Metadata = { title: "Invoices — Virtual Bridge PH" };

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const e = new Date(`${end}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${s} – ${e}`;
}

export default async function ClientInvoicesPage() {
  const { clientId } = await getClientContext();
  const [amountDue, invoices] = await Promise.all([getClientAmountDue(clientId), getClientInvoices(clientId)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">Weekly invoices for your team&apos;s approved tracked hours.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Current Amount Due</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{formatCurrency(amountDue)}</p>
        </CardContent>
      </Card>

      {invoices.length === 0 ? (
        <Card>
          <EmptyState icon={Receipt} title="No invoices yet" description="Invoices appear here once your team's tracked hours are locked and billed." />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium text-foreground">{inv.invoiceNumber}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateRange(inv.periodStart, inv.periodEnd)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.dueDate ? new Date(`${inv.dueDate}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(inv.total)}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={inv.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/client/invoices/${inv.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline"
                  >
                    View
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
