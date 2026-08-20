import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountStatus, UserRole } from "@vbph/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: UserRole;
  status: AccountStatus;
  fullName: string | null;
}

/**
 * The authenticated user, or null. `cache()` dedupes this within a single
 * request — call it as many times as convenient across Server Components
 * without worrying about redundant auth round-trips or duplicate queries.
 *
 * Uses getClaims() (verifies the JWT, refreshing the session first if it's
 * close to expiring) rather than getSession() (doesn't verify) or getUser()
 * (always round-trips) — see Supabase's current auth-js guidance. Role and
 * status come from `profiles`, never from the JWT — the JWT's role claim is
 * the Postgres role ("authenticated"), not our app role.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, status, full_name")
    .eq("id", userId)
    .single();

  if (error || !profile) return null;

  return {
    id: userId,
    email: (data?.claims.email as string | undefined) ?? null,
    role: profile.role,
    status: profile.status,
    fullName: profile.full_name,
  };
});
