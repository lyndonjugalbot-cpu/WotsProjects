"use client";

import { useActionState } from "react";
import { Button, Input, Label, Textarea } from "@vbph/ui";
import { correctLockedTimesheetAction, type AdminActionState } from "@/server/actions/admin-timesheets";

const initialState: AdminActionState = { error: null };

/**
 * The only UI path to admin_correct_locked_timesheet() — only ever
 * rendered for a LOCKED timesheet (see the detail page). A reason is
 * required client-side too (matches the RPC's own check), since this
 * becomes part of the permanent audit record, not just a form validation
 * nicety.
 */
export function TimesheetCorrectionForm({
  timesheetId,
  trackedHours,
  approvedHours,
  rejectedHours,
  pendingHours,
}: {
  timesheetId: string;
  trackedHours: number;
  approvedHours: number;
  rejectedHours: number;
  pendingHours: number;
}) {
  const [state, formAction, pending] = useActionState(correctLockedTimesheetAction.bind(null, timesheetId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <HourField name="trackedHours" label="Tracked" defaultValue={trackedHours} />
        <HourField name="approvedHours" label="Approved" defaultValue={approvedHours} />
        <HourField name="rejectedHours" label="Rejected" defaultValue={rejectedHours} />
        <HourField name="pendingHours" label="Pending" defaultValue={pendingHours} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Reason for this correction</Label>
        <Textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          placeholder="Explain why this locked timesheet's hours are being changed — this is recorded in the audit log."
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="destructive" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Apply correction"}
      </Button>
    </form>
  );
}

function HourField({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label} (hrs)</Label>
      <Input id={name} name={name} type="number" min={0} max={168} step={0.01} defaultValue={defaultValue} required />
    </div>
  );
}
