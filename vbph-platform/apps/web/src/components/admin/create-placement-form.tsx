"use client";

import { useActionState, useMemo, useState } from "react";
import { Button, Input, Label, Select } from "@vbph/ui";
import { PLACEMENT_STATUSES } from "@vbph/schemas";
import { createPlacementAction, type AdminActionState } from "@/server/actions/admin-placements";
import type { ClientOption } from "@/server/queries/admin/clients";
import type { VaOption } from "@/server/queries/admin/vas";
import type { JobOption } from "@/server/queries/admin/jobs";
import type { ProjectOption } from "@/server/queries/admin/projects";

const initialState: AdminActionState = { error: null };

export interface CreatePlacementFormProps {
  clients: ClientOption[];
  vas: VaOption[];
  jobs: JobOption[];
  projects: ProjectOption[];
  defaultClientId?: string;
  defaultVaId?: string;
  defaultJobId?: string;
}

export function CreatePlacementForm({
  clients,
  vas,
  jobs,
  projects,
  defaultClientId,
  defaultVaId,
  defaultJobId,
}: CreatePlacementFormProps) {
  const [state, formAction, pending] = useActionState(createPlacementAction, initialState);
  const [clientId, setClientId] = useState(defaultClientId ?? "");

  // Rates start copied from the pre-selected job (e.g. arriving via the
  // "Assign VA" link from a HIRED application), if any — a one-time
  // starting point the admin can still edit before submitting. Once
  // submitted, these are the placement's own historical rates; nothing
  // links back to the job afterward (see createPlacementAction).
  const defaultJob = jobs.find((j) => j.id === defaultJobId);
  const [clientRate, setClientRate] = useState(
    defaultJob ? String(defaultJob.clientHourlyRate) : ""
  );
  const [vaRate, setVaRate] = useState(defaultJob ? String(defaultJob.vaHourlyRate) : "");

  const jobOptions = useMemo(() => jobs.filter((j) => j.clientId === clientId), [jobs, clientId]);
  const projectOptions = useMemo(() => projects.filter((p) => p.clientId === clientId), [projects, clientId]);
  const margin = (Number(clientRate) || 0) - (Number(vaRate) || 0);

  function handleJobChange(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setClientRate(String(job.clientHourlyRate));
      setVaRate(String(job.vaHourlyRate));
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientId">Client</Label>
          <Select
            id="clientId"
            name="clientId"
            required
            defaultValue={defaultClientId ?? ""}
            onChange={(e) => setClientId(e.target.value)}
          >
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
          <Label htmlFor="vaId">VA</Label>
          <Select id="vaId" name="vaId" required defaultValue={defaultVaId ?? ""}>
            <option value="" disabled>
              Select a VA…
            </option>
            {vas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jobId">Job (optional)</Label>
          <Select
            id="jobId"
            name="jobId"
            defaultValue={defaultJobId ?? ""}
            disabled={!clientId}
            onChange={(e) => handleJobChange(e.target.value)}
          >
            <option value="">None</option>
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Selecting a job copies its current rates below.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="projectId">Project (optional)</Label>
          <Select id="projectId" name="projectId" defaultValue="" disabled={!clientId}>
            <option value="">None</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hoursPerWeekExpected">Weekly Hour Limit</Label>
          <Input id="hoursPerWeekExpected" name="hoursPerWeekExpected" type="number" min={1} max={168} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue="PENDING">
            {PLACEMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientHourlyRate">Client Rate ($/hr)</Label>
          <Input
            id="clientHourlyRate"
            name="clientHourlyRate"
            type="number"
            min={0}
            step={0.01}
            required
            value={clientRate}
            onChange={(e) => setClientRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vaHourlyRate">VA Rate ($/hr)</Label>
          <Input
            id="vaHourlyRate"
            name="vaHourlyRate"
            type="number"
            min={0}
            step={0.01}
            required
            value={vaRate}
            onChange={(e) => setVaRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>VBPH Margin ($/hr)</Label>
          <div
            className={`flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm tabular-nums ${
              margin < 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            ${margin.toFixed(2)}
          </div>
        </div>
      </div>
      {margin < 0 ? (
        <p className="text-sm text-destructive">VA rate can&apos;t exceed the client rate.</p>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || margin < 0} className="self-start">
        {pending ? "Creating…" : "Create Placement"}
      </Button>
    </form>
  );
}
