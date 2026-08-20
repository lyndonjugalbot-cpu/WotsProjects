"use client";

import type { AccountStatus } from "@vbph/types";
import { AccountStatusActions } from "./account-status-actions";
import { setVaAccountStatusAction } from "@/server/actions/admin-vas";

export function VaStatusToggle({ vaId, status }: { vaId: string; status: AccountStatus }) {
  return (
    <AccountStatusActions
      status={status}
      label="Account"
      onSetStatus={(next) => setVaAccountStatusAction(vaId, next)}
    />
  );
}
