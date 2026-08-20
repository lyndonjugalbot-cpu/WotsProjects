"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { createProjectSchema } from "@vbph/schemas";
import { logAdminAction } from "./audit";

export type AdminActionState = {
  error: string | null;
};

export async function createProjectAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN");

  const parsed = createProjectSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      client_id: parsed.data.clientId,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: "Couldn't create the project. Please try again." };
  }

  await logAdminAction(supabase, admin.id, "project_created", "projects", project.id, {
    clientId: parsed.data.clientId,
    name: parsed.data.name,
  });

  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}
