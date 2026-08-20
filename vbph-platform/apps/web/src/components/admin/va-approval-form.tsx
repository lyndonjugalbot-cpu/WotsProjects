"use client";

import { useActionState } from "react";
import { Button, Label, Select, Textarea } from "@vbph/ui";
import { VA_APPROVAL_STATUSES } from "@vbph/schemas";
import { updateVaApprovalAction, type AdminActionState } from "@/server/actions/admin-vas";
import type { AdminVaDetail } from "@/server/queries/admin/vas";

const initialState: AdminActionState = { error: null };

const LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export function VaApprovalForm({ va }: { va: AdminVaDetail }) {
  const [state, formAction, pending] = useActionState(
    updateVaApprovalAction.bind(null, va.id),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="approvalStatus">Approval status</Label>
        <Select id="approvalStatus" name="approvalStatus" defaultValue={va.approvalStatus}>
          {VA_APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rejectionReason">Rejection reason (if rejecting)</Label>
        <Textarea id="rejectionReason" name="rejectionReason" defaultValue={va.rejectionReason ?? ""} />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Update Approval Status"}
      </Button>
    </form>
  );
}
