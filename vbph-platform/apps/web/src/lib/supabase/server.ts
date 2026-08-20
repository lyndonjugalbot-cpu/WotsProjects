import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@vbph/types";

/**
 * Per-request, RLS-bound Supabase client for Server Components, Server
 * Actions, and Route Handlers. Always create a new one per request — never
 * cache/share this across requests.
 *
 * Session refresh is handled by proxy.ts on every request; this client's
 * setAll is a best-effort mirror for the (rare) case a Server Action needs
 * to write auth cookies directly. Server Components can't set cookies at
 * all — Next.js throws if you try during render — hence the try/catch.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy apps/web/.env.local.example to apps/web/.env.local and fill in your Supabase project's values."
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component during render — cookies can't be
          // set here. Safe to ignore: proxy.ts refreshes the session on
          // every request, so this only matters for Server Actions/Route
          // Handlers, which CAN set cookies and will hit the try branch.
        }
      },
    },
  });
}
