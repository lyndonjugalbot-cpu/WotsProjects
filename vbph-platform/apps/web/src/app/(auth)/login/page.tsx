import type { Metadata } from "next";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in — Virtual Bridge PH" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back to Virtual Bridge PH.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {params.reset === "success" ? (
          <Alert variant="success">Password updated. Sign in with your new password.</Alert>
        ) : null}
        {params.error === "auth_callback_failed" ? (
          <Alert variant="destructive">That link is invalid or has expired. Please try again.</Alert>
        ) : null}
        <LoginForm />
      </CardContent>
    </Card>
  );
}
