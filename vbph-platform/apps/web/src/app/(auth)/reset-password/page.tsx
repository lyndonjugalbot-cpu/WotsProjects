import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { requireAuth } from "@/lib/auth/require-auth";

export const metadata: Metadata = { title: "Set a new password — Virtual Bridge PH" };

// Reached only via the /auth/callback code-exchange from a reset-password
// email, which establishes a real session — requireAuth() enforces that;
// anyone landing here without a valid session is redirected to /login.
export default async function ResetPasswordPage() {
  await requireAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
