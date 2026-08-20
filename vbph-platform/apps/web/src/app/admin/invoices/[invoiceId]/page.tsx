import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from "@vbph/ui";
import { getAdminInvoiceDetail } from "@/server/queries/admin/invoices";
import { InvoiceStatusBadge } from "@/components/shared/invoices/status-badge";
import { InvoiceStatusForm } from "@/components/admin/invoice-status-form";

export const metadata: Metadata = { title: "Invoice — Virtual Bridge PH" };

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const invoice = await getAdminInvoiceDetail(invoiceId);
  if (!invoice) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to Invoices
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{invoice.companyName}</p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-5 p-6 sm:grid-cols-4">
          <Field label="Billing Period" value={`${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`} />
          <Field label="Invoice Date" value={formatDate(invoice.createdAt)} />
          <Field label="Due Date" value={formatDate(invoice.dueDate)} />
          <Field label="Total" value={formatCurrency(invoice.total)} emphasize />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceStatusForm invoiceId={invoice.id} status={invoice.status} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Line items</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>VA</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Line Amount</TableHead>
              <TableHead className="text-right">VA Payout</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lineItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">{item.vaFullName}</TableCell>
                <TableCell className="text-muted-foreground">{item.description ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{item.hours.toFixed(4)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(item.rateHour)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">{formatCurrency(item.amount)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {item.vaPayoutAmount != null ? formatCurrency(item.vaPayoutAmount) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-success">
                  {item.marginAmount != null ? formatCurrency(item.marginAmount) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4}>Total</TableCell>
              <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(invoice.total)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(invoice.totalVaPayout)}</TableCell>
              <TableCell className="text-right tabular-nums text-success">{formatCurrency(invoice.totalMargin)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        VA Payout and Margin are visible to admin only — never shown on the client-facing invoice.
      </p>
    </div>
  );
}

function Field({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={emphasize ? "mt-1 text-lg font-semibold text-foreground" : "mt-1 text-sm font-medium text-foreground"}>{value}</p>
    </div>
  );
}
