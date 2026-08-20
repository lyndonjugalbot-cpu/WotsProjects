import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountStatus, VaApprovalStatus } from "@vbph/types";

export interface AdminVaListItem {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string | null;
  approvalStatus: VaApprovalStatus;
  accountStatus: AccountStatus;
  createdAt: string;
}

export interface AdminVaDetail extends AdminVaListItem {
  bio: string | null;
  skills: string[];
  experienceYears: number | null;
  timezone: string | null;
  resumeUrl: string | null;
  portfolioUrl: string | null;
  rejectionReason: string | null;
  activePlacementCount: number;
}

export interface VaOption {
  id: string;
  fullName: string;
}

/** Lean id+name list of approved VAs, for admin placement-creation dropdowns. */
export const getApprovedVaOptions = cache(async (): Promise<VaOption[]> => {
  const supabase = await createSupabaseServerClient();
  const { data: vaProfiles } = await supabase
    .from("va_profiles")
    .select("id")
    .eq("approval_status", "approved");
  const ids = (vaProfiles ?? []).map((v) => v.id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return (profiles ?? [])
    .map((p) => ({ id: p.id, fullName: p.full_name ?? "Unnamed VA" }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
});

export const getAllVAs = cache(async (): Promise<AdminVaListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: vaProfiles, error } = await supabase
    .from("va_profiles")
    .select("id, headline, approval_status, created_at")
    .order("created_at", { ascending: false });
  if (error || !vaProfiles || vaProfiles.length === 0) return [];

  const ids = vaProfiles.map((v) => v.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, status")
    .in("id", ids);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return vaProfiles.map((v) => ({
    id: v.id,
    fullName: profileById.get(v.id)?.full_name ?? "Unnamed VA",
    avatarUrl: profileById.get(v.id)?.avatar_url ?? null,
    headline: v.headline,
    approvalStatus: v.approval_status,
    accountStatus: profileById.get(v.id)?.status ?? "active",
    createdAt: v.created_at,
  }));
});

export const getAdminVaDetail = cache(async (vaId: string): Promise<AdminVaDetail | null> => {
  const supabase = await createSupabaseServerClient();

  const [{ data: vaProfile, error }, { data: profile }, { count: activePlacementCount }] =
    await Promise.all([
      supabase
        .from("va_profiles")
        .select(
          "id, headline, bio, skills, experience_years, timezone, resume_url, portfolio_url, approval_status, rejection_reason, created_at"
        )
        .eq("id", vaId)
        .maybeSingle(),
      supabase.from("profiles").select("full_name, avatar_url, status").eq("id", vaId).maybeSingle(),
      supabase
        .from("admin_placements_view")
        .select("id", { count: "exact", head: true })
        .eq("va_id", vaId)
        .eq("status", "active"),
    ]);

  if (error || !vaProfile) return null;

  return {
    id: vaProfile.id,
    fullName: profile?.full_name ?? "Unnamed VA",
    avatarUrl: profile?.avatar_url ?? null,
    headline: vaProfile.headline,
    bio: vaProfile.bio,
    skills: vaProfile.skills ?? [],
    experienceYears: vaProfile.experience_years,
    timezone: vaProfile.timezone,
    resumeUrl: vaProfile.resume_url,
    portfolioUrl: vaProfile.portfolio_url,
    approvalStatus: vaProfile.approval_status,
    accountStatus: profile?.status ?? "active",
    rejectionReason: vaProfile.rejection_reason,
    createdAt: vaProfile.created_at,
    activePlacementCount: activePlacementCount ?? 0,
  };
});
