"use client";

import { useActionState } from "react";
import { Button, Select } from "@vbph/ui";
import { APPLICATION_STATUSES } from "@vbph/schemas";
import {
  updateApplicationStatusAction,
  type AdminActionState,
} from "@/server/actions/admin-applications";

const initialState: AdminActionState = { error: null };

export function ApplicationStatusForm({ applicationId, status }: { applicationId: string; status: string }) {
  const [state, formAction, pending] = useActionState(
    updateApplicationStatusAction.bind(null, applicationId),
    initialState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="status" defaultValue={status} className="w-auto">
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
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
