import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWorkDiaryBlocks, type WorkDiaryResult } from "@/server/time-tracking/service";

export interface DiaryEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  totalHours: number;
  segmentCount: number;
  screenshotCount: number;
}

export interface WorkDiary {
  vaId: string;
  fullName: string;
  headline: string | null;
  entries: DiaryEntry[];
}

/**
 * `clientId` comes from getClientContext() (the caller's own session), so
 * a client can never fetch another VA's diary just by editing the URL —
 * if no placement links this vaId to this clientId, the result is `null`,
 * the same "doesn't exist" response a genuinely bad id would get.
 */
export const getWorkDiary = cache(
  async (clientId: string, vaId: string): Promise<WorkDiary | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: placements } = await supabase
      .from("client_placements_view")
      .select("id")
      .eq("client_id", clientId)
      .eq("va_id", vaId);

    const placementIds = (placements ?? [])
      .map((p) => p.id)
      .filter((id): id is string => !!id);

    if (placementIds.length === 0) return null;

    const [{ data: profile }, { data: vaProfile }, { data: entries }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", vaId).maybeSingle(),
      supabase.from("va_profiles").select("headline").eq("id", vaId).maybeSingle(),
      supabase
        .from("time_entries")
        .select("id, started_at, ended_at, status")
        .in("placement_id", placementIds)
        .order("started_at", { ascending: false })
        .limit(30),
    ]);

    const entryIds = (entries ?? []).map((e) => e.id);

    const [{ data: segments }, { data: screenshots }] = await Promise.all([
      entryIds.length > 0
        ? supabase
            .from("time_segments")
            .select("id, time_entry_id, segment_start, segment_end")
            .in("time_entry_id", entryIds)
        : Promise.resolve({ data: [] as { id: string; time_entry_id: string; segment_start: string; segment_end: string }[] }),
      entryIds.length > 0
        ? supabase.from("screenshots").select("time_segment_id")
        : Promise.resolve({ data: [] as { time_segment_id: string }[] }),
    ]);

    const segmentIdsByEntry = new Map<string, string[]>();
    const hoursByEntry = new Map<string, number>();
    for (const seg of segments ?? []) {
      const hours =
        (new Date(seg.segment_end).getTime() - new Date(seg.segment_start).getTime()) / 3_600_000;
      hoursByEntry.set(seg.time_entry_id, (hoursByEntry.get(seg.time_entry_id) ?? 0) + hours);
      segmentIdsByEntry.set(seg.time_entry_id, [
        ...(segmentIdsByEntry.get(seg.time_entry_id) ?? []),
        seg.id,
      ]);
    }

    const screenshotCountBySegment = new Map<string, number>();
    for (const shot of screenshots ?? []) {
      screenshotCountBySegment.set(
        shot.time_segment_id,
        (screenshotCountBySegment.get(shot.time_segment_id) ?? 0) + 1
      );
    }

    const diaryEntries: DiaryEntry[] = (entries ?? []).map((entry) => {
      const segIds = segmentIdsByEntry.get(entry.id) ?? [];
      const screenshotCount = segIds.reduce(
        (sum, segId) => sum + (screenshotCountBySegment.get(segId) ?? 0),
        0
      );
      return {
        id: entry.id,
        startedAt: entry.started_at,
        endedAt: entry.ended_at,
        status: entry.status,
        totalHours: hoursByEntry.get(entry.id) ?? 0,
        segmentCount: segIds.length,
        screenshotCount,
      };
    });

    return {
      vaId,
      fullName: profile?.full_name ?? "Unnamed VA",
      headline: vaProfile?.headline ?? null,
      entries: diaryEntries,
    };
  }
);

export interface ProjectWorkDiary {
  projectName: string;
  result: WorkDiaryResult;
}

/**
 * The rich, per-block Work Diary for one project — `/client/projects/[id]/work-diary`.
 * `clientId` comes from getClientContext() (never the URL); the project
 * ownership check below means a projectId belonging to another client
 * reads as "not found," not "forbidden" — same pattern as
 * getClientJob/getJobApplicants elsewhere in this app.
 */
export const getProjectWorkDiary = cache(
  async (clientId: string, projectId: string, startDate: string, endDate: string): Promise<ProjectWorkDiary | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id, name, client_id")
      .eq("id", projectId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!project) return null;

    const result = await getWorkDiaryBlocks(supabase, createSupabaseAdminClient(), {
      projectId,
      startDate,
      endDate,
    });

    return { projectName: project.name, result };
  }
);
