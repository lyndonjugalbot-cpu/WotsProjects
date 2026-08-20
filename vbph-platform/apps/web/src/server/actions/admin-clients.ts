"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { updateClientProfileSchema } from "@vbph/schemas";
import { logAdminAction } from "./audit";

export type AdminActionState = {
  error: string | null;
};

export async function updateClientProfileAction(
  clientId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = updateClientProfileSchema.safeParse({
    companyName: formData.get("companyName"),
    billingEmail: formData.get("billingEmail"),
    industry: formData.get("industry"),
    website: formData.get("website"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("clients")
    .update({
      company_name: parsed.data.companyName,
      billing_email: parsed.data.billingEmail,
      industry: parsed.data.industry,
      website: parsed.data.website,
    })
    .eq("id", clientId);

  if (error) {
    return { error: "Couldn't save changes. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "client_profile_updated", "clients", clientId, parsed.data);

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  return { error: null };
}

export async function setClientStatusAction(
  clientId: string,
  status: "active" | "suspended"
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("clients").update({ status }).eq("id", clientId);
  if (error) {
    return { error: "Couldn't update status. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "client_status_changed", "clients", clientId, { status });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  return { error: null };
}

/**
 * Activates/deactivates every member profile of a client company —
 * "deactivate a client" in the business sense usually means locking out
 * everyone at that company, not just flipping a flag no login path reads.
 * Each member's own profiles.status controls whether they can sign in
 * (see requireRole's suspended check).
 */
export async function setClientMembersStatusAction(
  clientId: string,
  status: "active" | "suspended"
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");
  const supabase = await createSupabaseServerClient();

  const { data: members } = await supabase
    .from("client_members")
    .select("profile_id")
    .eq("client_id", clientId);

  const profileIds = (members ?? []).map((m) => m.profile_id);
  if (profileIds.length > 0) {
    const { error } = await supabase.from("profiles").update({ status }).in("id", profileIds);
    if (error) {
      return { error: "Couldn't update member accounts. Please try again." };
    }
  }

  await logAdminAction(supabase, admin.id, "client_members_status_changed", "clients", clientId, {
    status,
    profileIds,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { error: null };
}
