"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label } from "@vbph/ui";

export type RateOverrideActionState = { error: string | null };

export interface RateOverrideFormProps {
  action: (prevState: RateOverrideActionState, formData: FormData) => Promise<RateOverrideActionState>;
  clientHourlyRate: number;
  vaHourlyRate: number;
}

const initialState: RateOverrideActionState = { error: null };

/**
 * Client Rate and VA Rate are the only two persisted inputs — Margin here
 * is always a live, read-only computation (clientRate - vaRate), never
 * itself submitted. The server independently recomputes the same
 * subtraction inside admin_update_*_rates() before writing anything, so
 * this display is a preview, not the source of truth.
 */
export function RateOverrideForm({ action, clientHourlyRate, vaHourlyRate }: RateOverrideFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clientRate, setClientRate] = useState(String(clientHourlyRate));
  const [vaRate, setVaRate] = useState(String(vaHourlyRate));

  const margin = (Number(clientRate) || 0) - (Number(vaRate) || 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientHourlyRate">Client Rate ($/hr)</Label>
          <Input
            id="clientHourlyRate"
            name="clientHourlyRate"
            type="number"
            min={0}
            step={0.01}
            value={clientRate}
            onChange={(e) => setClientRate(e.target.value)}
            required
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
            value={vaRate}
            onChange={(e) => setVaRate(e.target.value)}
            required
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
        {pending ? "Saving…" : "Update Rates"}
      </Button>
    </form>
  );
}
