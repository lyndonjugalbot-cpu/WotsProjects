import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "./require-auth";
import type { CurrentUser } from "./get-current-user";
import type { UserRole } from "@vbph/types";

export type { UserRole, CurrentUser };

/**
 * The authoritative role/portal gate. Called from every portal's
 * layout.tsx (Server Component) — this is what actually stops a VA from
 * rendering an admin page, regardless of what URL they typed.
 *
 * This is NOT sufficient on its own for mutations: every Server Action must
 * independently re-check auth/authorization too (a layout-level redirect
 * doesn't protect the Server Actions used within it — see Next.js's own
 * data-security guidance). This function covers reads/rendering.
 */
export async function requireRole(allowed: UserRole | UserRole[]): Promise<CurrentUser> {
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  const user = await requireAuth();

  if (user.status === "suspended") {
    redirect("/suspended");
  }

  if (!allowedRoles.includes(user.role)) {
    redirect("/");
  }

  return user;
}
