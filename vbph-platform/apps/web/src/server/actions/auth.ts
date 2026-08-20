"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@vbph/schemas";

export type AuthActionState = {
  error: string | null;
  success?: string | null;
};

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Deliberately generic — don't reveal whether the email exists.
    return { error: "Incorrect email or password." };
  }

  redirect("/");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read server-side by the handle_new_user() trigger. The trigger
      // itself only ever honors 'VA' or falls back to 'CLIENT' — 'ADMIN'
      // is not reachable through this path no matter what's sent here.
      data: { full_name: parsed.data.fullName, role: parsed.data.role },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      error: null,
      success: "Check your email to confirm your account before signing in.",
    };
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  // Same message whether or not the email is registered — resetPasswordForEmail
  // itself is designed not to leak that, and surfacing its error here would.
  return {
    error: null,
    success: "If an account exists for that email, we've sent a password reset link.",
  };
}

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  // Requires an active session, established by /auth/callback exchanging the
  // reset-link code — the /reset-password page is gated by requireAuth(),
  // which redirects to /login if that session isn't present.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.message };
  }

  redirect("/login?reset=success");
}
