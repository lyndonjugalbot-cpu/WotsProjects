import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from "@vbph/ui";
import { getClientContext } from "@/server/queries/client/context";
import { getClientInvoiceDetail } from "@/server/queries/client/invoices";
import { InvoiceStatusBadge } from "@/components/shared/invoices/status-badge";

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

export default async function ClientInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { clientId, companyName } = await getClientContext();
  const { invoiceId } = await params;
  const invoice = await getClientInvoiceDetail(clientId, invoiceId);
  if (!invoice) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/client/invoices"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to Invoices
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{companyName}</p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-5 p-6 sm:grid-cols-4">
          <Field label="Billing Period" value={`${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`} />
          <Field label="Due Date" value={formatDate(invoice.dueDate)} />
          <Field label="Issued" value={formatDate(invoice.issuedAt)} />
          <Field label="Total" value={formatCurrency(invoice.total)} emphasize />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Line items</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Line Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lineItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-foreground">{item.description ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{item.hours.toFixed(4)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(item.rateHour)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right tabular-nums text-foreground">{formatCurrency(invoice.total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
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
