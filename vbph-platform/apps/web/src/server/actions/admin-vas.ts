"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { updateVaProfileSchema, vaApprovalSchema } from "@vbph/schemas";
import type { AccountStatus } from "@vbph/types";
import { logAdminAction } from "./audit";

export type AdminActionState = {
  error: string | null;
};

export async function updateVaProfileAction(
  vaId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const skillsRaw = formData.get("skills");
  const parsed = updateVaProfileSchema.safeParse({
    headline: formData.get("headline"),
    bio: formData.get("bio"),
    skills:
      typeof skillsRaw === "string"
        ? skillsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    experienceYears: formData.get("experienceYears") || undefined,
    timezone: formData.get("timezone"),
    resumeUrl: formData.get("resumeUrl"),
    portfolioUrl: formData.get("portfolioUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("va_profiles")
    .update({
      headline: parsed.data.headline,
      bio: parsed.data.bio,
      skills: parsed.data.skills,
      experience_years: parsed.data.experienceYears,
      timezone: parsed.data.timezone,
      resume_url: parsed.data.resumeUrl,
      portfolio_url: parsed.data.portfolioUrl,
    })
    .eq("id", vaId);

  if (error) {
    return { error: "Couldn't save changes. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "va_profile_updated", "va_profiles", vaId, parsed.data);

  revalidatePath(`/admin/vas/${vaId}`);
  revalidatePath("/admin/vas");
  return { error: null };
}

export async function updateVaApprovalAction(
  vaId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = vaApprovalSchema.safeParse({
    approvalStatus: formData.get("approvalStatus"),
    rejectionReason: formData.get("rejectionReason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("va_profiles")
    .update({
      approval_status: parsed.data.approvalStatus,
      rejection_reason: parsed.data.rejectionReason,
      approved_by: parsed.data.approvalStatus === "approved" ? admin.id : null,
      approved_at: parsed.data.approvalStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", vaId);

  if (error) {
    return { error: "Couldn't update approval status. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "va_approval_changed", "va_profiles", vaId, parsed.data);

  revalidatePath(`/admin/vas/${vaId}`);
  revalidatePath("/admin/vas");
  return { error: null };
}

export async function setVaAccountStatusAction(
  vaId: string,
  status: AccountStatus
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("profiles").update({ status }).eq("id", vaId);
  if (error) {
    return { error: "Couldn't update status. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "va_account_status_changed", "profiles", vaId, { status });

  revalidatePath(`/admin/vas/${vaId}`);
  revalidatePath("/admin/vas");
  return { error: null };
}
