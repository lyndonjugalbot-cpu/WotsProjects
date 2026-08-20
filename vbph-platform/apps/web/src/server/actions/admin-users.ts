"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { createUserSchema } from "@vbph/schemas";
import { logAdminAction } from "./audit";

export type AdminActionState = {
  error: string | null;
};

/**
 * Creates a user account directly — the Supabase Auth Admin API
 * (auth.admin.createUser) is the only way to do this outside self-signup,
 * and it requires the service-role client (see lib/supabase/admin.ts).
 * handle_new_user() still fires as normal and creates the profiles row
 * (and va_profiles, if role is VA) — but it only ever resolves self-signup
 * roles to CLIENT or VA, never ADMIN (by design, so a signup payload can't
 * request admin). For an ADMIN account we explicitly promote after
 * creation, using the same service-role client — which is also the one
 * context prevent_self_privilege_escalation() intentionally lets through
 * (auth.uid() is null for service-role requests, same as direct DB access
 * or migrations).
 */
export async function createUserAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    clientId: formData.get("clientId") || undefined,
    newCompanyName: formData.get("newCompanyName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      // Only ever resolves to CLIENT/VA inside the trigger — ADMIN is
      // promoted explicitly below, never trusted from this payload alone.
      role: parsed.data.role === "VA" ? "VA" : "CLIENT",
    },
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Couldn't create the user." };
  }

  const newUserId = created.user.id;

  if (parsed.data.role === "ADMIN") {
    const { error: promoteError } = await adminClient
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("id", newUserId);
    if (promoteError) {
      return { error: "User was created but couldn't be promoted to admin. Check Clients/VAs for cleanup." };
    }
  }

  if (parsed.data.role === "CLIENT") {
    let clientId = parsed.data.clientId ?? null;

    if (!clientId && parsed.data.newCompanyName) {
      const { data: newClient, error: clientError } = await adminClient
        .from("clients")
        .insert({ company_name: parsed.data.newCompanyName })
        .select("id")
        .single();
      if (clientError || !newClient) {
        return { error: "User was created but the company couldn't be created. Check Clients for cleanup." };
      }
      clientId = newClient.id;
    }

    if (clientId) {
      const { error: memberError } = await adminClient
        .from("client_members")
        .insert({ client_id: clientId, profile_id: newUserId, role_in_company: "owner" });
      if (memberError) {
        return { error: "User was created but couldn't be linked to the company. Check Clients for cleanup." };
      }
    }
  }

  const supabase = await createSupabaseServerClient();
  await logAdminAction(supabase, admin.id, "user_created", "profiles", newUserId, {
    email: parsed.data.email,
    role: parsed.data.role,
  });

  revalidatePath("/admin/clients");
  revalidatePath("/admin/vas");

  if (parsed.data.role === "CLIENT") {
    redirect("/admin/clients");
  } else if (parsed.data.role === "VA") {
    redirect("/admin/vas");
  }
  redirect("/admin/dashboard");
}
