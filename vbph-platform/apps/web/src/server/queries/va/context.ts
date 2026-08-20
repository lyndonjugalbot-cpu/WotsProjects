import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { VaApprovalStatus } from "@vbph/types";

/**
 * Only an approved VA can see any OPEN job or submit an application —
 * enforced at the DB layer (va_is_approved() inside va_jobs_view's WHERE
 * clause and the job_applications INSERT policy), not just here. This is
 * purely for UX: showing a pending/rejected VA a clear explanation
 * instead of a marketplace that silently renders zero jobs.
 */
export const getVaApprovalStatus = cache(async (): Promise<VaApprovalStatus> => {
  const user = await requireRole("VA");
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("va_profiles")
    .select("approval_status")
    .eq("id", user.id)
    .maybeSingle();

  return data?.approval_status ?? "pending";
});
