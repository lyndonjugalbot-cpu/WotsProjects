"use client";

import { useActionState, useRef, useState } from "react";
import { Button, ConfirmDialog } from "@vbph/ui";
import { INVOICE_STATUS_TRANSITIONS, type InvoiceStatus } from "@vbph/schemas";
import { advanceInvoiceStatusAction, type AdminActionState } from "@/server/actions/admin-invoices";

const initialState: AdminActionState = { error: null };

const LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Revert to Draft",
  ISSUED: "Issue to client",
  PAID: "Mark Paid",
  OVERDUE: "Mark Overdue",
  VOID: "Void",
};

function StatusButton({ invoiceId, target }: { invoiceId: string; target: InvoiceStatus }) {
  const [state, formAction, pending] = useActionState(advanceInvoiceStatusAction.bind(null, invoiceId), initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isVoiding = target === "VOID";

  return (
    <>
      <form ref={formRef} action={formAction} className="inline-flex flex-col items-start gap-1">
        <input type="hidden" name="newStatus" value={target} />
        <Button
          type={isVoiding ? "button" : "submit"}
          onClick={isVoiding ? () => setConfirmOpen(true) : undefined}
          size="sm"
          variant={isVoiding ? "destructive" : "outline"}
          loading={pending}
        >
          {LABEL[target]}
        </Button>
        {state.error ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

      {isVoiding ? (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            formRef.current?.requestSubmit();
          }}
          title="Void this invoice?"
          description="This can't be undone — the invoice stays on record as VOID, permanently excluded from what the client owes."
          confirmLabel="Void invoice"
          danger
        />
      ) : null}
    </>
  );
}

/** One button per valid next status — mirrors admin_set_invoice_status()'s own allow-list, branching (not a single "next" like timesheets). */
export function InvoiceStatusForm({ invoiceId, status }: { invoiceId: string; status: InvoiceStatus }) {
  const nextOptions = INVOICE_STATUS_TRANSITIONS[status];

  if (nextOptions.length === 0) {
    return <p className="text-sm text-muted-foreground">This invoice is {status.toLowerCase()} — no further status changes.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      {nextOptions.map((target) => (
        <StatusButton key={target} invoiceId={invoiceId} target={target} />
      ))}
    </div>
  );
}
