"use client";

import { useActionState } from "react";
import { Button, Input, Label, Select, Textarea } from "@vbph/ui";
import { createProjectAction, type AdminActionState } from "@/server/actions/admin-projects";
import type { ClientOption } from "@/server/queries/admin/clients";

const initialState: AdminActionState = { error: null };

export function CreateProjectForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientId">Client</Label>
        <Select id="clientId" name="clientId" required defaultValue="">
          <option value="" disabled>
            Select a client…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create Project"}
      </Button>
    </form>
  );
}
