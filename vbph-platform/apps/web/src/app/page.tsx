import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

const PORTAL_PATH: Record<string, string> = {
  CLIENT: "/client/dashboard",
  VA: "/va/dashboard",
  ADMIN: "/admin/dashboard",
};

// Root route has no UI of its own — it just routes an authenticated user to
// their portal (or an unauthenticated one to /login). Each portal's own
// layout re-verifies role/status independently; this redirect is a
// convenience, not a security boundary.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.status === "suspended") {
    redirect("/suspended");
  }

  redirect(PORTAL_PATH[user.role] ?? "/login");
}
