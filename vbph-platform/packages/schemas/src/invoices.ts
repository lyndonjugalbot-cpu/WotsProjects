import { z } from "zod";

// See packages/schemas/src/admin.ts for why `.guid()`, not `.uuid()`, is
// used everywhere an id from this project's dataset might arrive.

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "OVERDUE", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// The valid transition graph — mirrors admin_set_invoice_status()'s own
// (from, to) allow-list exactly (that RPC is the real enforcement; this
// is only used client-side to decide which action buttons to render).
export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["ISSUED", "VOID"],
  ISSUED: ["PAID", "OVERDUE", "VOID"],
  OVERDUE: ["PAID", "VOID"],
  PAID: [],
  VOID: [],
};

export const generateInvoiceSchema = z.object({
  clientId: z.string().guid("Select a client"),
  weekStart: z.string().date("Choose a week"),
});
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

export const advanceInvoiceStatusSchema = z.object({
  newStatus: z.enum(INVOICE_STATUSES),
});
export type AdvanceInvoiceStatusInput = z.infer<typeof advanceInvoiceStatusSchema>;
