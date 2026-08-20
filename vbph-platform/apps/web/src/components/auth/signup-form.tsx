"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Input, Label, cn } from "@vbph/ui";
import { signUpAction, type AuthActionState } from "@/server/actions/auth";

const initialState: AuthActionState = { error: null };

const ROLE_OPTIONS = [
  {
    value: "CLIENT",
    title: "I'm hiring",
    description: "Post jobs and manage your team of VAs",
  },
  {
    value: "VA",
    title: "I'm a VA",
    description: "Find work and get matched with clients",
  },
] as const;

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">I am signing up as…</legend>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map((option, index) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-md border border-input p-3 text-sm transition-colors hover:bg-muted",
                "has-checked:border-primary has-checked:bg-primary-soft has-checked:ring-1 has-checked:ring-primary",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2"
              )}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                defaultChecked={index === 0}
                className="sr-only"
                required
              />
              <span className="block font-medium">{option.title}</span>
              <span className="block text-muted-foreground">{option.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? <Alert variant="destructive">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <Button type="submit" loading={pending} className="mt-2">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-link hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
