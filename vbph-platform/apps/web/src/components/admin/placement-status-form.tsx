"use client";

import { useActionState } from "react";
import { Button, Select } from "@vbph/ui";
import { PLACEMENT_STATUSES } from "@vbph/schemas";
import { updatePlacementStatusAction, type AdminActionState } from "@/server/actions/admin-placements";

const initialState: AdminActionState = { error: null };

export function PlacementStatusForm({ placementId, status }: { placementId: string; status: string }) {
  const [state, formAction, pending] = useActionState(
    updatePlacementStatusAction.bind(null, placementId),
    initialState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="status" defaultValue={status} className="w-auto">
        {PLACEMENT_STATUSES.map((s) => (
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
