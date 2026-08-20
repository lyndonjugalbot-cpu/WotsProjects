"use client";

import { useActionState } from "react";
import { Alert, Button, Input, Label } from "@vbph/ui";
import { updatePasswordAction, type AuthActionState } from "@/server/actions/auth";

const initialState: AuthActionState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

      <Button type="submit" loading={pending} className="mt-2">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
