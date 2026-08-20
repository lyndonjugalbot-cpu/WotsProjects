import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@vbph/ui";
import { getAllInvoices, getClientOptions } from "@/server/queries/admin/invoices";
import { InvoiceStatusBadge } from "@/components/shared/invoices/status-badge";
import { GenerateInvoiceForm } from "@/components/admin/generate-invoice-form";

export const metadata: Metadata = { title: "Invoices — Virtual Bridge PH" };

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const e = new Date(`${end}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${s} – ${e}`;
}

export default async function AdminInvoicesPage() {
  const [invoices, clients] = await Promise.all([getAllInvoices(), getClientOptions()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generated from a client&apos;s LOCKED weekly timesheets — Approved Hours × Placement Client Rate, per placement.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate an invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateInvoiceForm clients={clients} />
        </CardContent>
      </Card>

      {invoices.length === 0 ? (
        <Card>
          <EmptyState icon={Receipt} title="No invoices yet" description="Generate one above once a client has locked timesheets for a week." />
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium text-foreground">{inv.invoiceNumber}</TableCell>
                <TableCell className="text-muted-foreground">{inv.companyName}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateRange(inv.periodStart, inv.periodEnd)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(inv.total)}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={inv.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/invoices/${inv.id}`}
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
