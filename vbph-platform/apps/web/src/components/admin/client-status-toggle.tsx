"use client";

import type { AccountStatus } from "@vbph/types";
import { AccountStatusActions } from "./account-status-actions";
import { setClientStatusAction } from "@/server/actions/admin-clients";

export function ClientStatusToggle({ clientId, status }: { clientId: string; status: AccountStatus }) {
  return (
    <AccountStatusActions
      status={status}
      label="Client"
      onSetStatus={(next) => setClientStatusAction(clientId, next)}
    />
  );
}
