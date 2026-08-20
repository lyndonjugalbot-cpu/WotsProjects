"use client";

import { useActionState } from "react";
import { Button, Input, Label, Select, Textarea } from "@vbph/ui";
import {
  createJobAction,
  updateJobAction,
  type JobFormState,
} from "@/server/actions/jobs";
import { JOB_EXPERIENCE_LEVELS } from "@vbph/schemas";
import type { ClientJobDetail } from "@/server/queries/client/jobs";

const initialState: JobFormState = { error: null };

export interface JobFormProps {
  mode: "create" | "edit";
  job?: ClientJobDetail;
}

export function JobForm({ mode, job }: JobFormProps) {
  const action = mode === "edit" && job ? updateJobAction.bind(null, job.id) : createJobAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="title">Job title</Label>
          <Input id="title" name="title" required defaultValue={job?.title} placeholder="e.g. Customer Support VA" />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="description">Job description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={job?.description ?? ""}
            placeholder="What is this role, and what will they be working on?"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="responsibilities">Responsibilities</Label>
          <Textarea
            id="responsibilities"
            name="responsibilities"
            defaultValue={job?.responsibilities ?? ""}
            placeholder="Day-to-day tasks this VA will own"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="requiredSkills">Required skills</Label>
          <Input
            id="requiredSkills"
            name="requiredSkills"
            defaultValue={job?.requiredSkills.join(", ") ?? ""}
            placeholder="Comma-separated, e.g. Zendesk, Customer Service, English"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="experienceLevel">Experience level</Label>
          <Select id="experienceLevel" name="experienceLevel" defaultValue={job?.experienceLevel ?? ""}>
            <option value="">Not specified</option>
            {JOB_EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0) + level.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numVasRequired">Number of VAs required</Label>
          <Input
            id="numVasRequired"
            name="numVasRequired"
            type="number"
            min={1}
            step={1}
            defaultValue={job?.numVasRequired ?? 1}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hoursPerWeek">Hours per week</Label>
          <Input
            id="hoursPerWeek"
            name="hoursPerWeek"
            type="number"
            min={1}
            max={168}
            step={1}
            defaultValue={job?.hoursPerWeek ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule">Working schedule</Label>
          <Input
            id="schedule"
            name="schedule"
            defaultValue={job?.schedule ?? ""}
            placeholder="e.g. Mon–Fri 9am–6pm PHT"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue={job?.timezone ?? ""} placeholder="e.g. Asia/Manila" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="applicationDeadline">Application deadline</Label>
          <Input
            id="applicationDeadline"
            name="applicationDeadline"
            type="date"
            defaultValue={job?.applicationDeadline ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientHourlyRate">Hourly rate (USD)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="clientHourlyRate"
              name="clientHourlyRate"
              type="number"
              min={0.01}
              step={0.01}
              required
              defaultValue={job?.clientHourlyRate ?? ""}
              className="pl-6"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This is the rate you&apos;ll be billed. Virtual Bridge PH handles VA compensation separately.
          </p>
          {mode === "edit" && job && job.applicationCount > 0 ? (
            <p className="text-xs text-warning">
              {job.applicationCount} VA{job.applicationCount === 1 ? " has" : "s have"} already applied at
              the current rate — they won&apos;t be automatically notified of a change.
            </p>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        {mode === "create" ? (
          <>
            <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
              {pending ? "Saving…" : "Save as Draft"}
            </Button>
            <Button type="submit" name="intent" value="publish" disabled={pending}>
              {pending ? "Publishing…" : "Publish Job"}
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </div>
    </form>
  );
}
