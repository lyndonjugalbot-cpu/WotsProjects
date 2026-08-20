"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label, Select } from "@vbph/ui";
import { CREATABLE_ROLES } from "@vbph/schemas";
import { createUserAction, type AdminActionState } from "@/server/actions/admin-users";
import type { ClientOption } from "@/server/queries/admin/clients";

const initialState: AdminActionState = { error: null };

export function CreateUserForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const [role, setRole] = useState<(typeof CREATABLE_ROLES)[number]>("CLIENT");
  const [useExistingCompany, setUseExistingCompany] = useState(true);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Temporary password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Role</Label>
          <Select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof CREATABLE_ROLES)[number])}
          >
            {CREATABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {role === "CLIENT" ? (
        <div className="flex flex-col gap-3 rounded-md border border-input p-4">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={useExistingCompany}
                onChange={() => setUseExistingCompany(true)}
              />
              Existing company
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={!useExistingCompany}
                onChange={() => setUseExistingCompany(false)}
              />
              New company
            </label>
          </div>
          {useExistingCompany ? (
            <Select name="clientId" defaultValue="">
              <option value="" disabled>
                Select a company…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          ) : (
            <Input name="newCompanyName" placeholder="New company name" />
          )}
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create User"}
      </Button>
    </form>
  );
}
