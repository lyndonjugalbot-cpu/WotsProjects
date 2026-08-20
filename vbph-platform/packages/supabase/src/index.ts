// ─────────────────────────────────────────────────────────────────────────
// ⚠️  SECURITY BOUNDARY — READ BEFORE ADDING ANYTHING TO THIS PACKAGE
//
// This package is a dependency of apps/desktop, which ships as a compiled
// binary to VAs' machines. Anything exported from here is effectively
// public. It may ONLY ever contain the anon-key client factory.
//
// The service-role (admin) Supabase client must live exclusively in
// apps/web/src/lib/supabase/admin.ts, guarded by the `server-only` package,
// and must NEVER be imported into this package, apps/desktop, or any
// Client Component.
// ─────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@vbph/types";

/**
 * Anon-key Supabase client for browser/Client Component use (apps/web) and
 * for apps/desktop once it authenticates a VA session. Safe to call anywhere
 * — Row Level Security, not key secrecy, is what authorizes access.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy apps/web/.env.local.example to apps/web/.env.local and fill in your Supabase project's values."
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
