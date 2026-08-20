"use client";

import { useActionState } from "react";
import { Button, Input, Label } from "@vbph/ui";
import {
  updateClientProfileAction,
  type AdminActionState,
} from "@/server/actions/admin-clients";
import type { AdminClientDetail } from "@/server/queries/admin/clients";

const initialState: AdminActionState = { error: null };

export function ClientProfileForm({ client }: { client: AdminClientDetail }) {
  const [state, formAction, pending] = useActionState(
    updateClientProfileAction.bind(null, client.id),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" name="companyName" defaultValue={client.companyName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="billingEmail">Billing email</Label>
          <Input id="billingEmail" name="billingEmail" type="email" defaultValue={client.billingEmail ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" name="industry" defaultValue={client.industry ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" defaultValue={client.website ?? ""} />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}
