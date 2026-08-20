import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vbph/ui";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Sign up — Virtual Bridge PH" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Join Virtual Bridge PH as a client or a VA.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
