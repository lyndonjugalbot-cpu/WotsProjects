import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@vbph/schemas";

export interface ClientInvoiceListItem {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  total: number;
  dueDate: string | null;
}

export interface ClientInvoiceLineItem {
  id: string;
  description: string | null;
  hours: number;
  rateHour: number;
  amount: number;
}

export interface ClientInvoiceDetail extends ClientInvoiceListItem {
  subtotal: number;
  issuedAt: string | null;
  paidAt: string | null;
  lineItems: ClientInvoiceLineItem[];
}

/**
 * "Current Amount Due" — ISSUED or OVERDUE invoices only (PAID is
 * settled, VOID never counted, DRAFT is invisible to clients at all —
 * see invoices_select_member in the weekly_invoices migration).
 */
export const getClientAmountDue = cache(async (clientId: string): Promise<number> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("total")
    .eq("client_id", clientId)
    .in("status", ["ISSUED", "OVERDUE"]);
  return (data ?? []).reduce((sum, i) => sum + i.total, 0);
});

export const getClientInvoices = cache(async (clientId: string): Promise<ClientInvoiceListItem[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, period_start, period_end, status, total, due_date")
    .eq("client_id", clientId)
    .order("period_start", { ascending: false });

  return (data ?? []).map((i) => ({
    id: i.id,
    invoiceNumber: i.invoice_number,
    periodStart: i.period_start,
    periodEnd: i.period_end,
    status: i.status as InvoiceStatus,
    total: i.total,
    dueDate: i.due_date,
  }));
});

/**
 * Reads the base `invoice_items` table directly — unlike
 * jobs/placements, it doesn't need a client-facing VIEW to hide the
 * rate-sensitive columns, because the column-level GRANT on the base
 * table already excludes va_hourly_rate/va_payout_amount/margin_amount
 * for `authenticated` entirely (see the weekly_invoices migration): a
 * `select *` here would still only ever return the safe columns,
 * structurally, not because this function is careful to ask for a
 * narrow list. (admin_invoice_items_view exists for the OPPOSITE
 * problem — admin needs a way *around* that same grant.) clientId
 * ownership is double-checked explicitly here too, not just left to RLS,
 * matching getProjectWorkDiary's own convention elsewhere.
 */
export const getClientInvoiceDetail = cache(
  async (clientId: string, invoiceId: string): Promise<ClientInvoiceDetail | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, client_id, period_start, period_end, status, subtotal, total, due_date, issued_at, paid_at")
      .eq("id", invoiceId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!invoice) return null;

    const { data: items } = await supabase
      .from("invoice_items")
      .select("id, description, hours, rate_hour, amount")
      .eq("invoice_id", invoiceId);

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      status: invoice.status as InvoiceStatus,
      subtotal: invoice.subtotal,
      total: invoice.total,
      dueDate: invoice.due_date,
      issuedAt: invoice.issued_at,
      paidAt: invoice.paid_at,
      lineItems: (items ?? []).map((item) => ({
        id: item.id,
        description: item.description,
        hours: item.hours,
        rateHour: item.rate_hour,
        amount: item.amount ?? 0,
      })),
    };
  }
);
