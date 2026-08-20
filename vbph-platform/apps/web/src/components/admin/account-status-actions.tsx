"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@vbph/ui";
import type { AccountStatus } from "@vbph/types";

export interface AccountStatusActionsProps {
  status: AccountStatus;
  onSetStatus: (status: AccountStatus) => Promise<{ error: string | null }>;
  label?: string;
}

/** Shared activate/deactivate control — used for clients, client members, and VAs alike. */
export function AccountStatusActions({ status, onSetStatus, label }: AccountStatusActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const next: AccountStatus = status === "active" ? "suspended" : "active";

  return (
    <div className="flex items-center gap-3">
      <Badge variant={status === "active" ? "success" : "destructive"}>
        {status === "active" ? "Active" : "Suspended"}
      </Badge>
      <Button
        type="button"
        size="sm"
        variant={status === "active" ? "destructive" : "outline"}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await onSetStatus(next);
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? "Updating…" : status === "active" ? `Deactivate${label ? ` ${label}` : ""}` : `Activate${label ? ` ${label}` : ""}`}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
