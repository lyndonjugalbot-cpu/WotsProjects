import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@vbph/types";

// ─────────────────────────────────────────────────────────────────────────
// ⚠️  This client bypasses Row Level Security entirely. It exists for a
// small set of trusted server-side operations (invoice generation, payroll
// runs, admin actions that legitimately need cross-user access) — never as
// a shortcut around writing a proper RLS policy.
//
// `import "server-only"` makes any accidental import from a Client
// Component a BUILD ERROR, not a runtime leak. Do not remove it. Do not
// re-export this client, or the service-role key, from anywhere else.
// ─────────────────────────────────────────────────────────────────────────

let cachedClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local (server-only, never NEXT_PUBLIC_)."
    );
  }

  cachedClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}
