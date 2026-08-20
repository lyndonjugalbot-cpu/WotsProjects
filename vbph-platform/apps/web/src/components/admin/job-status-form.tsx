"use client";

import { useActionState } from "react";
import { Button, Select } from "@vbph/ui";
import { JOB_STATUSES } from "@vbph/schemas";
import { updateJobStatusAdminAction, type AdminActionState } from "@/server/actions/admin-jobs";

const initialState: AdminActionState = { error: null };

export function JobStatusForm({ jobId, status }: { jobId: string; status: string }) {
  const [state, formAction, pending] = useActionState(
    updateJobStatusAdminAction.bind(null, jobId),
    initialState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="status" defaultValue={status} className="w-auto">
        {JOB_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Update Status"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
