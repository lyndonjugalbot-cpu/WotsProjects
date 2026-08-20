import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@vbph/schemas";

export interface AdminInvoiceListItem {
  id: string;
  invoiceNumber: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  total: number;
  dueDate: string | null;
}

export interface AdminInvoiceLineItem {
  id: string;
  placementId: string;
  vaFullName: string;
  description: string | null;
  hours: number;
  rateHour: number;
  amount: number;
  vaHourlyRate: number | null;
  vaPayoutAmount: number | null;
  marginAmount: number | null;
}

export interface AdminInvoiceDetail extends AdminInvoiceListItem {
  clientId: string;
  subtotal: number;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems: AdminInvoiceLineItem[];
  totalVaPayout: number;
  totalMargin: number;
}

export const getAllInvoices = cache(async (): Promise<AdminInvoiceListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_id, period_start, period_end, status, total, due_date")
    .order("period_start", { ascending: false });

  if (!invoices || invoices.length === 0) return [];

  const clientIds = [...new Set(invoices.map((i) => i.client_id))];
  const { data: clients } = await supabase.from("clients").select("id, company_name").in("id", clientIds);
  const clientById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));

  return invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoice_number,
    companyName: clientById.get(i.client_id) ?? "Unknown company",
    periodStart: i.period_start,
    periodEnd: i.period_end,
    status: i.status as InvoiceStatus,
    total: i.total,
    dueDate: i.due_date,
  }));
});

export const getAdminInvoiceDetail = cache(async (invoiceId: string): Promise<AdminInvoiceDetail | null> => {
  const supabase = await createSupabaseServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, client_id, period_start, period_end, status, subtotal, total, due_date, issued_at, paid_at, created_at"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return null;

  const { data: client } = await supabase.from("clients").select("company_name").eq("id", invoice.client_id).maybeSingle();

  // admin_invoice_items_view, not the base table — this is the ONE place
  // va_hourly_rate/va_payout_amount/margin_amount are readable at all; the
  // base table's column grant deliberately excludes them (see the
  // weekly_invoices migration).
  const { data: rawItems } = await supabase
    .from("admin_invoice_items_view")
    .select("id, placement_id, description, hours, rate_hour, amount, va_hourly_rate, va_payout_amount, margin_amount")
    .eq("invoice_id", invoiceId);

  // The view's generated types mark every column nullable (standard for
  // a Supabase VIEW, regardless of the underlying table's own NOT NULL
  // constraints) — same defensive filter as getAllPlacements/
  // getAdminPlacementDetail use for admin_placements_view.
  const items = (rawItems ?? []).filter(
    (i): i is typeof i & { id: string; placement_id: string; hours: number; rate_hour: number } =>
      !!i.id && !!i.placement_id && i.hours != null && i.rate_hour != null
  );

  const placementIds = [...new Set(items.map((i) => i.placement_id))];
  const { data: placements } = await supabase.from("admin_placements_view").select("id, va_id").in("id", placementIds);
  const vaIdByPlacement = new Map((placements ?? []).map((p) => [p.id, p.va_id]));
  const vaIds = [...new Set([...vaIdByPlacement.values()].filter((id): id is string => !!id))];
  const { data: profiles } = vaIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", vaIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const vaNameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed VA"]));

  const lineItems: AdminInvoiceLineItem[] = items.map((item) => ({
    id: item.id,
    placementId: item.placement_id,
    vaFullName: vaNameById.get(vaIdByPlacement.get(item.placement_id) ?? "") ?? "Unnamed VA",
    description: item.description,
    hours: item.hours,
    rateHour: item.rate_hour,
    amount: item.amount ?? 0,
    vaHourlyRate: item.va_hourly_rate,
    vaPayoutAmount: item.va_payout_amount,
    marginAmount: item.margin_amount,
  }));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientId: invoice.client_id,
    companyName: client?.company_name ?? "Unknown company",
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
    status: invoice.status as InvoiceStatus,
    subtotal: invoice.subtotal,
    total: invoice.total,
    dueDate: invoice.due_date,
    issuedAt: invoice.issued_at,
    paidAt: invoice.paid_at,
    createdAt: invoice.created_at,
    lineItems,
    totalVaPayout: lineItems.reduce((sum, i) => sum + (i.vaPayoutAmount ?? 0), 0),
    totalMargin: lineItems.reduce((sum, i) => sum + (i.marginAmount ?? 0), 0),
  };
});

export interface ClientOption {
  id: string;
  companyName: string;
}

export const getClientOptions = cache(async (): Promise<ClientOption[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("clients").select("id, company_name").order("company_name");
  return (data ?? []).map((c) => ({ id: c.id, companyName: c.company_name }));
});
