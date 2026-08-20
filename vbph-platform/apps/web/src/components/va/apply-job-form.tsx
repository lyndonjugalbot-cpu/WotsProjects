"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Input, Label, Textarea } from "@vbph/ui";
import {
  applyToJobAction,
  withdrawApplicationAction,
  type ApplicationActionState,
} from "@/server/actions/applications";

const initialState: ApplicationActionState = { error: null };

// No local "success" render here: applyToJobAction's revalidatePath calls
// trigger the parent Server Component (the job detail page) to re-render
// with job.hasApplied = true immediately on success, which swaps this
// form out for the "You applied…" state authoritatively — a client-only
// success message here would be unmounted before it could ever paint.
// Only the error path needs local state, since an error leaves this form
// mounted.
export function ApplyJobForm({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState(
    applyToJobAction.bind(null, jobId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coverNote">Cover message</Label>
        <Textarea
          id="coverNote"
          name="coverNote"
          placeholder="Introduce yourself and say why you're a good fit…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="relevantExperience">Relevant experience</Label>
        <Textarea
          id="relevantExperience"
          name="relevantExperience"
          placeholder="Experience that's directly relevant to this role…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expectedAvailability">Expected availability</Label>
        <Input
          id="expectedAvailability"
          name="expectedAvailability"
          placeholder="e.g. Immediately, or 2 weeks notice"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Additional notes (optional)</Label>
        <Textarea id="notes" name="notes" placeholder="Anything else the client should know…" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Apply"}
      </Button>
    </form>
  );
}

// Same reasoning as ApplyJobForm: on success, withdrawApplicationAction's
// revalidatePath causes the parent page to re-render with an
// applicationStatus this component no longer qualifies to render under
// (see WITHDRAWABLE_STATUSES in the job detail page), unmounting it. Only
// the error path needs local state.
export function WithdrawApplicationForm({ jobId }: { jobId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await withdrawApplicationAction(jobId);
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? "Withdrawing…" : "Withdraw Application"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
