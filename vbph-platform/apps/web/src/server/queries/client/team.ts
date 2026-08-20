import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeeklyHoursByPlacement } from "../shared/weekly-hours";

export interface TeamMemberCard {
  placementId: string;
  vaId: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string | null;
  projectId: string | null;
  projectName: string | null;
  /** The client's own rate — never the VA payout rate or agency margin. */
  clientHourlyRate: number;
  weeklyHoursExpected: number | null;
  status: string;
  hoursTrackedThisWeek: number;
}

/**
 * "My Team" — every VA currently (active or paused) placed with this
 * client. Reads exclusively through client_placements_view, which never
 * has a va_hourly_rate or agency_margin column to begin with — there's no
 * "select the wrong column" mistake possible here, the data isn't in the
 * result set (see the rate-privacy design in docs/database.md).
 */
export const getTeamMembers = cache(async (clientId: string): Promise<TeamMemberCard[]> => {
  const supabase = await createSupabaseServerClient();

  const { data: placements, error } = await supabase
    .from("client_placements_view")
    .select("id, va_id, project_id, client_hourly_rate, hours_per_week_expected, status")
    .eq("client_id", clientId)
    .in("status", ["ACTIVE", "PAUSED"]);

  if (error || !placements || placements.length === 0) return [];

  const vaIds = [...new Set(placements.map((p) => p.va_id).filter((id): id is string => !!id))];
  const projectIds = [
    ...new Set(placements.map((p) => p.project_id).filter((id): id is string => !!id)),
  ];
  const placementIds = placements
    .map((p) => p.id)
    .filter((id): id is string => !!id);

  const [{ data: profiles }, { data: vaProfiles }, { data: projects }, hoursByPlacement] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", vaIds),
      supabase.from("va_profiles").select("id, headline").in("id", vaIds),
      projectIds.length > 0
        ? supabase.from("projects").select("id, name").in("id", projectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      getWeeklyHoursByPlacement(supabase, placementIds),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const vaProfileById = new Map((vaProfiles ?? []).map((p) => [p.id, p]));
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  return placements
    .filter((p): p is typeof p & { id: string; va_id: string } => !!p.id && !!p.va_id)
    .map((p) => {
      const profile = profileById.get(p.va_id);
      const vaProfile = vaProfileById.get(p.va_id);
      const project = p.project_id ? projectById.get(p.project_id) : undefined;

      return {
        placementId: p.id,
        vaId: p.va_id,
        fullName: profile?.full_name ?? "Unnamed VA",
        avatarUrl: profile?.avatar_url ?? null,
        headline: vaProfile?.headline ?? null,
        projectId: p.project_id,
        projectName: project?.name ?? null,
        clientHourlyRate: p.client_hourly_rate ?? 0,
        weeklyHoursExpected: p.hours_per_week_expected,
        status: p.status ?? "ACTIVE",
        hoursTrackedThisWeek: hoursByPlacement.get(p.id) ?? 0,
      };
    });
});
