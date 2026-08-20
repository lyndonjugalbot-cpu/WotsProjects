import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";
import { signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Account suspended — Virtual Bridge PH" };

export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Account suspended</CardTitle>
          <CardDescription>
            Your account has been suspended. Contact Virtual Bridge PH support if you believe
            this is a mistake.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-link hover:underline"
            >
              Sign out
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
