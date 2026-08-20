"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Input, Label } from "@vbph/ui";
import { signInAction, type AuthActionState } from "@/server/actions/auth";

const initialState: AuthActionState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-sm font-medium text-link hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}

      <Button type="submit" loading={pending} className="mt-2">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-link hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
