import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./get-current-user";

/**
 * Lowest-level server-side gate: any authenticated user, any role. Redirects
 * to /login if there's no session. (proxy.ts is what preserves `redirectTo`
 * for the common case — it runs before this and already redirects
 * unauthenticated requests to protected prefixes; this is the
 * defense-in-depth fallback for whenever a Server Component renders anyway.)
 *
 * requireRole() builds on this for the common "authenticated AND has role
 * X" case — reach for this directly only when a page is fine with any
 * signed-in user (e.g. a shared account-settings page).
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
