"use client";

import { useActionState, useRef, useState } from "react";
import { Button, ConfirmDialog } from "@vbph/ui";
import type { TimesheetStatus } from "@vbph/schemas";
import { advanceTimesheetStatusAction, type AdminActionState } from "@/server/actions/admin-timesheets";

const initialState: AdminActionState = { error: null };

const NEXT_STATUS: Record<TimesheetStatus, TimesheetStatus | null> = {
  OPEN: "SUBMITTED",
  SUBMITTED: "APPROVED",
  APPROVED: "LOCKED",
  LOCKED: null,
};

const BUTTON_LABEL: Record<TimesheetStatus, string> = {
  OPEN: "Submit for review",
  SUBMITTED: "Approve",
  APPROVED: "Lock for invoicing",
  LOCKED: "Locked",
};

/**
 * One button, forward-only — mirrors admin_set_timesheet_status()'s own
 * one-step-at-a-time enforcement so the UI never even offers an invalid
 * transition. Locking is the one step that also freezes the hour
 * snapshot server-side, so it's the one gated behind a real confirm
 * dialog rather than submitting immediately — see ConfirmDialog for why
 * this isn't the browser's native `confirm()`.
 */
export function TimesheetStatusForm({ timesheetId, status }: { timesheetId: string; status: TimesheetStatus }) {
  const [state, formAction, pending] = useActionState(advanceTimesheetStatusAction.bind(null, timesheetId), initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextStatus = NEXT_STATUS[status];

  if (!nextStatus) {
    return (
      <p className="text-sm text-muted-foreground">
        This timesheet is locked. See &ldquo;Correct locked timesheet&rdquo; below to change its numbers.
      </p>
    );
  }

  const isLocking = nextStatus === "LOCKED";

  return (
    <>
      <form ref={formRef} action={formAction} className="flex flex-col items-start gap-2">
        <input type="hidden" name="newStatus" value={nextStatus} />
        <Button
          type={isLocking ? "button" : "submit"}
          onClick={isLocking ? () => setConfirmOpen(true) : undefined}
          loading={pending}
          variant={isLocking ? "destructive" : "primary"}
        >
          {BUTTON_LABEL[status]}
        </Button>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
        title="Lock this timesheet?"
        description="Its hours will be frozen for invoicing. Any later change will require an audited correction, not a simple edit."
        confirmLabel="Lock timesheet"
        danger
      />
    </>
  );
}
