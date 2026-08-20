"use client";

import { useState, useTransition } from "react";
import { Button } from "@vbph/ui";
import { updateJobStatusAction } from "@/server/actions/jobs";
import type { JobStatus } from "@vbph/schemas";

const TRANSITIONS: Record<JobStatus, { label: string; next: JobStatus; variant?: "outline" | "destructive" }[]> = {
  DRAFT: [{ label: "Publish", next: "OPEN" }],
  OPEN: [
    { label: "Pause", next: "PAUSED", variant: "outline" },
    { label: "Mark as Filled", next: "FILLED", variant: "outline" },
    { label: "Close", next: "CLOSED", variant: "destructive" },
  ],
  PAUSED: [
    { label: "Reopen", next: "OPEN" },
    { label: "Close", next: "CLOSED", variant: "destructive" },
  ],
  FILLED: [],
  CLOSED: [],
};

export function JobStatusActions({ jobId, status }: { jobId: string; status: JobStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const transitions = TRANSITIONS[status];
  if (transitions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {transitions.map((t) => (
          <Button
            key={t.next}
            type="button"
            variant={t.variant ?? "primary"}
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await updateJobStatusAction(jobId, t.next);
                if (result.error) setError(result.error);
              });
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
