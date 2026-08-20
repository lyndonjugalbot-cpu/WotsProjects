import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  companyName: string;
  clientId: string;
  createdAt: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  clientId: string;
}

/** Lean list for admin placement-creation dropdowns. */
export const getProjectOptions = cache(async (): Promise<ProjectOption[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .order("name", { ascending: true });
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, clientId: p.client_id }));
});

export const getAllProjects = cache(async (): Promise<AdminProjectListItem[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, client_id, name, description, status, created_at")
    .order("created_at", { ascending: false });
  if (error || !projects || projects.length === 0) return [];

  const clientIds = [...new Set(projects.map((p) => p.client_id))];
  const { data: clients } = await supabase.from("clients").select("id, company_name").in("id", clientIds);
  const clientById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    companyName: clientById.get(p.client_id) ?? "Unknown company",
    clientId: p.client_id,
    createdAt: p.created_at,
  }));
});
