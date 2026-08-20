import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface ClientContext {
  clientId: string;
  companyName: string;
  roleInCompany: string;
}

/**
 * Resolves the current CLIENT user's company. Every client-portal data
 * query takes `clientId` from here, never from a URL param — that's what
 * makes cross-client access structurally impossible rather than just
 * policy-dependent (RLS is still the real enforcement; this just ensures
 * the app never even asks for another client's id).
 *
 * A CLIENT profile with no client_members row (signed up, not yet linked
 * to a company by an admin) is a real state, not an error — redirected to
 * a dedicated explanatory page rather than crashing.
 */
export const getClientContext = cache(async (): Promise<ClientContext> => {
  const user = await requireRole("CLIENT");
  const supabase = await createSupabaseServerClient();

  const { data: membership, error } = await supabase
    .from("client_members")
    .select("client_id, role_in_company, clients(company_name)")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !membership || !membership.clients) {
    redirect("/client/no-company");
  }

  return {
    clientId: membership.client_id,
    companyName: membership.clients.company_name,
    roleInCompany: membership.role_in_company,
  };
});
