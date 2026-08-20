"use client";

import { useActionState } from "react";
import { Button } from "@vbph/ui";
import { setTimeEntryStatusAction, type AdminActionState } from "@/server/actions/admin-timesheets";

const initialState: AdminActionState = { error: null };

function StatusButton({
  timesheetId,
  timeEntryId,
  value,
  variant,
  label,
}: {
  timesheetId: string;
  timeEntryId: string;
  value: "pending" | "approved" | "rejected";
  variant: "outline" | "ghost";
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    setTimeEntryStatusAction.bind(null, timesheetId, timeEntryId),
    initialState
  );

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="status" value={value} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? "…" : label}
      </Button>
      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Approve/Reject/Reset-to-pending for one session ("questionable time")
 * within a timesheet's week — three small independent forms rather than
 * one dropdown, each acting immediately, matching how the rest of the
 * Admin Portal handles single-field status flips.
 */
export function TimeEntryStatusForm({
  timesheetId,
  timeEntryId,
  status,
}: {
  timesheetId: string;
  timeEntryId: string;
  status: "pending" | "approved" | "rejected";
}) {
  return (
    <div className="flex items-center gap-1.5">
      {status !== "approved" && (
        <StatusButton timesheetId={timesheetId} timeEntryId={timeEntryId} value="approved" variant="outline" label="Approve" />
      )}
      {status !== "rejected" && (
        <StatusButton timesheetId={timesheetId} timeEntryId={timeEntryId} value="rejected" variant="outline" label="Reject" />
      )}
      {status !== "pending" && (
        <StatusButton timesheetId={timesheetId} timeEntryId={timeEntryId} value="pending" variant="ghost" label="Reset" />
      )}
    </div>
  );
}
