import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProjectMember {
  vaId: string;
  fullName: string;
  headline: string | null;
  status: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  members: ProjectMember[];
}

/**
 * `clientId` always comes from getClientContext() (the caller's own
 * session), never from the URL — combined with RLS on `projects`
 * (is_client_member), a client editing the URL to another client's
 * project id gets `null` here, not someone else's data.
 */
export const getProjectDetail = cache(
  async (clientId: string, projectId: string): Promise<ProjectDetail | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: project, error } = await supabase
      .from("projects")
      .select("id, name, description, status, created_at")
      .eq("id", projectId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error || !project) return null;

    const { data: placements } = await supabase
      .from("client_placements_view")
      .select("va_id, status")
      .eq("project_id", projectId)
      .eq("client_id", clientId);

    const vaIds = [
      ...new Set((placements ?? []).map((p) => p.va_id).filter((id): id is string => !!id)),
    ];

    const [{ data: profiles }, { data: vaProfiles }] = await Promise.all([
      vaIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", vaIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      vaIds.length > 0
        ? supabase.from("va_profiles").select("id, headline").in("id", vaIds)
        : Promise.resolve({ data: [] as { id: string; headline: string | null }[] }),
    ]);

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed VA"]));
    const headlineById = new Map((vaProfiles ?? []).map((p) => [p.id, p.headline]));

    const members: ProjectMember[] = (placements ?? [])
      .filter((p): p is typeof p & { va_id: string; status: string } => !!p.va_id && !!p.status)
      .map((p) => ({
        vaId: p.va_id,
        fullName: nameById.get(p.va_id) ?? "Unnamed VA",
        headline: headlineById.get(p.va_id) ?? null,
        status: p.status,
      }));

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.created_at,
      members,
    };
  }
);
