"use client";

import { useActionState } from "react";
import { Button, Input, Label, Select } from "@vbph/ui";
import { generateInvoiceAction, type AdminActionState } from "@/server/actions/admin-invoices";
import type { ClientOption } from "@/server/queries/admin/invoices";

const initialState: AdminActionState = { error: null };

/**
 * Client + week -> admin_generate_weekly_invoice() finds every LOCKED
 * timesheet that client's placements have for that week and turns it
 * into a line item. The week input isn't restricted to Mondays
 * client-side (a plain date input can't express "Mondays only" well) —
 * the RPC itself validates and rejects a non-Monday with a clear error.
 */
export function GenerateInvoiceForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, pending] = useActionState(generateInvoiceAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientId">Client</Label>
        <Select id="clientId" name="clientId" required className="w-56">
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="weekStart">Week starting (Monday)</Label>
        <Input id="weekStart" name="weekStart" type="date" required className="w-44" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate Invoice"}
      </Button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
