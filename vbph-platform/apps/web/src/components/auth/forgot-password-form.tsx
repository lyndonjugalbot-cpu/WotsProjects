"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Input, Label } from "@vbph/ui";
import { requestPasswordResetAction, type AuthActionState } from "@/server/actions/auth";

const initialState: AuthActionState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">{state.success}</Alert>
        <Link href="/login" className="text-sm font-medium text-link hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

      <Button type="submit" loading={pending} className="mt-2">
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-link hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
