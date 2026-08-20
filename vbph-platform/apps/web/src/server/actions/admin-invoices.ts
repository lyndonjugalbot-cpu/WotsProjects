"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { generateInvoiceSchema, advanceInvoiceStatusSchema } from "@vbph/schemas";

export type AdminActionState = {
  error: string | null;
};

/**
 * Approved Billable Hours x Placement Client Hourly Rate, per placement,
 * for every LOCKED timesheet the selected client has for the selected
 * week — see admin_generate_weekly_invoice() in the weekly_invoices
 * migration, which does the actual work (and the actual money math, in
 * Postgres `numeric`, never in this Server Action). This is just auth +
 * input shaping + redirecting to the result.
 */
export async function generateInvoiceAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = generateInvoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    weekStart: formData.get("weekStart"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: invoiceId, error } = await supabase.rpc("admin_generate_weekly_invoice", {
    target_client_id: parsed.data.clientId,
    target_week_start: parsed.data.weekStart,
  });

  if (error || !invoiceId) {
    return { error: error?.message || "Couldn't generate an invoice." };
  }

  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${invoiceId}`);
}

export async function advanceInvoiceStatusAction(
  invoiceId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = advanceInvoiceStatusSchema.safeParse({ newStatus: formData.get("newStatus") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid status" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_invoice_status", {
    target_invoice_id: invoiceId,
    new_status: parsed.data.newStatus,
  });

  if (error) {
    return { error: error.message || "Couldn't update this invoice's status." };
  }

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  return { error: null };
}
