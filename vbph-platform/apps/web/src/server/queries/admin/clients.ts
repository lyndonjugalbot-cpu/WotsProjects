import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountStatus } from "@vbph/types";

export interface AdminClientListItem {
  id: string;
  companyName: string;
  billingEmail: string | null;
  status: AccountStatus;
  createdAt: string;
}

export interface AdminClientMember {
  profileId: string;
  fullName: string | null;
  roleInCompany: string;
  status: AccountStatus;
}

export interface AdminClientDetail extends AdminClientListItem {
  industry: string | null;
  website: string | null;
  members: AdminClientMember[];
  jobCount: number;
  placementCount: number;
  projectCount: number;
}

export interface ClientOption {
  id: string;
  companyName: string;
}

/** Lean id+name list for admin select dropdowns (placement/project creation). */
export const getClientOptions = cache(async (): Promise<ClientOption[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("status", "active")
    .order("company_name", { ascending: true });
  return (data ?? []).map((c) => ({ id: c.id, companyName: c.company_name }));
});

export const getAllClients = cache(async (): Promise<AdminClientListItem[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, billing_email, status, created_at")
    .order("company_name", { ascending: true });

  if (error || !data) return [];
  return data.map((c) => ({
    id: c.id,
    companyName: c.company_name,
    billingEmail: c.billing_email,
    status: c.status,
    createdAt: c.created_at,
  }));
});

export const getAdminClientDetail = cache(
  async (clientId: string): Promise<AdminClientDetail | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, company_name, billing_email, industry, website, status, created_at")
      .eq("id", clientId)
      .maybeSingle();
    if (error || !client) return null;

    const [{ data: members }, { count: jobCount }, { count: placementCount }, { count: projectCount }] =
      await Promise.all([
        supabase.from("client_members").select("profile_id, role_in_company").eq("client_id", clientId),
        supabase.from("admin_jobs_view").select("id", { count: "exact", head: true }).eq("client_id", clientId),
        supabase
          .from("admin_placements_view")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", clientId),
      ]);

    const profileIds = (members ?? []).map((m) => m.profile_id);
    const { data: profiles } =
      profileIds.length > 0
        ? await supabase.from("profiles").select("id, full_name, status").in("id", profileIds)
        : { data: [] as { id: string; full_name: string | null; status: AccountStatus }[] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    return {
      id: client.id,
      companyName: client.company_name,
      billingEmail: client.billing_email,
      industry: client.industry,
      website: client.website,
      status: client.status,
      createdAt: client.created_at,
      members: (members ?? []).map((m) => ({
        profileId: m.profile_id,
        fullName: profileById.get(m.profile_id)?.full_name ?? "Unnamed",
        roleInCompany: m.role_in_company,
        status: profileById.get(m.profile_id)?.status ?? "active",
      })),
      jobCount: jobCount ?? 0,
      placementCount: placementCount ?? 0,
      projectCount: projectCount ?? 0,
    };
  }
);
