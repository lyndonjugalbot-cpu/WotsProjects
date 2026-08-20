import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@vbph/types";

/**
 * Records an admin action to audit_logs. audit_logs_insert_self's WITH
 * CHECK only requires `actor_id = auth.uid()` — always true here since
 * every caller passes their own id — so this works through the normal
 * RLS-scoped client, no service role needed. Rate-override RPCs
 * (admin_update_job_rates/admin_update_placement_rates) log themselves
 * from inside the SECURITY DEFINER function instead of going through
 * this helper, since they already have the before/after values in hand.
 */
export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  actorId: string,
  action: string,
  targetTable: string,
  targetId: string,
  metadata: Record<string, Json> = {}
): Promise<void> {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_table: targetTable,
    target_id: targetId,
    metadata: metadata as Json,
  });
}
