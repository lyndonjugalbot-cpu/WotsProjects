import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@vbph/types";
import { ApiRequestError } from "@/lib/api/auth";
import type {
  CreateSegmentInput,
  RecordActivityInput,
  WorkDiaryQuery,
} from "@vbph/schemas";

// ─────────────────────────────────────────────────────────────────────────
// Clear, single-purpose backend functions for the time-tracking API. Each
// one does exactly one of the operations named in the task: Start Timer,
// Stop Timer, Create 10-Minute Segment, Record Activity, Upload
// Screenshot, Retrieve Work Diary, Delete Screenshot/Segment. Route
// handlers (app/api/time/**/route.ts) are thin wrappers: parse the
// request, call one of these, shape the response.
//
// Every function takes the CALLER's own RLS-scoped `supabase` client
// (from authenticateApiRequest) and does its real reads/writes through
// it — RLS is still the actual authorization boundary, exactly as
// everywhere else in this app. A couple of functions additionally take a
// service-role client, used ONLY for Storage operations (upload, signed
// URL, delete) on the private `screenshots` bucket, which has no
// Storage RLS policies of its own — see the time_tracking_api migration
// for why that's the correct, and only, place a service role belongs
// here: it never substitutes for an authorization check, only for
// reaching Storage after one has already passed.
// ─────────────────────────────────────────────────────────────────────────

export interface TimeSessionDto {
  id: string;
  vaId: string;
  placementId: string;
  projectId: string | null;
  projectName: string | null;
  startTime: string;
  endTime: string | null;
  totalTimeSeconds: number;
  status: string;
}

export interface TimeSegmentDto {
  id: string;
  timeEntryId: string;
  segmentStart: string;
  segmentEnd: string;
  durationSeconds: number;
  keyboardActivityCount: number | null;
  mouseActivityCount: number | null;
  activityPercentage: number | null;
  memo: string | null;
  screenshotUrl: string | null;
}

const SCREENSHOT_BUCKET = "screenshots";
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — "short-lived," generated fresh per read.

function segmentDurationSeconds(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

async function sumSegmentSeconds(
  supabase: SupabaseClient<Database>,
  timeEntryId: string
): Promise<number> {
  const { data } = await supabase
    .from("time_segments")
    .select("segment_start, segment_end")
    .eq("time_entry_id", timeEntryId);
  return (data ?? []).reduce(
    (sum, s) => sum + segmentDurationSeconds(s.segment_start, s.segment_end),
    0
  );
}

/**
 * va_id/project_id for a placement, read through whichever rate-privacy
 * view the caller actually has RLS access to. The base `placements`
 * table has no SELECT policy for VA or CLIENT at all (only
 * `placements_admin_all`, see docs/database.md) — a session can belong
 * to a VA, be viewed by that VA's client, or be viewed by an admin, and
 * each of those three needs a different view to read through. Neither
 * view's rate column is used here, only the two fields common to both.
 */
async function getPlacementSummary(
  supabase: SupabaseClient<Database>,
  placementId: string
): Promise<{ va_id: string; project_id: string | null } | null> {
  const { data: viaVa } = await supabase
    .from("va_placements_view")
    .select("va_id, project_id")
    .eq("id", placementId)
    .maybeSingle();
  if (viaVa?.va_id) return { va_id: viaVa.va_id, project_id: viaVa.project_id };

  const { data: viaClient } = await supabase
    .from("client_placements_view")
    .select("va_id, project_id")
    .eq("id", placementId)
    .maybeSingle();
  if (viaClient?.va_id) return { va_id: viaClient.va_id, project_id: viaClient.project_id };

  return null;
}

interface PlacementSummary {
  va_id: string;
  project_id: string | null;
  client_id: string | null;
}

/**
 * Batched version of getPlacementSummary — one round trip per view
 * instead of one per placement. Same fallback reasoning: try the view
 * the caller is most likely scoped through first, then the other; admin
 * passes through either. `client_id` is included here (both views carry
 * it) because the Work Diary UI needs it for admin's "which client"
 * context — never for a rate.
 */
async function getPlacementSummaries(
  supabase: SupabaseClient<Database>,
  placementIds: string[]
): Promise<Map<string, PlacementSummary>> {
  const summaries = new Map<string, PlacementSummary>();
  if (placementIds.length === 0) return summaries;

  const [{ data: viaVa }, { data: viaClient }] = await Promise.all([
    supabase.from("va_placements_view").select("id, va_id, project_id, client_id").in("id", placementIds),
    supabase.from("client_placements_view").select("id, va_id, project_id, client_id").in("id", placementIds),
  ]);

  for (const row of [...(viaVa ?? []), ...(viaClient ?? [])]) {
    if (row.id && row.va_id && !summaries.has(row.id)) {
      summaries.set(row.id, { va_id: row.va_id, project_id: row.project_id, client_id: row.client_id });
    }
  }
  return summaries;
}

async function toSessionDto(
  supabase: SupabaseClient<Database>,
  entry: { id: string; placement_id: string; started_at: string; ended_at: string | null; status: string }
): Promise<TimeSessionDto> {
  const [placement, totalTimeSeconds] = await Promise.all([
    getPlacementSummary(supabase, entry.placement_id),
    sumSegmentSeconds(supabase, entry.id),
  ]);

  let projectName: string | null = null;
  if (placement?.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", placement.project_id)
      .maybeSingle();
    projectName = project?.name ?? null;
  }

  return {
    id: entry.id,
    vaId: placement?.va_id ?? "",
    placementId: entry.placement_id,
    projectId: placement?.project_id ?? null,
    projectName,
    startTime: entry.started_at,
    endTime: entry.ended_at,
    totalTimeSeconds,
    status: entry.status,
  };
}

function toSegmentDto(
  segment: {
    id: string;
    time_entry_id: string;
    segment_start: string;
    segment_end: string;
    keyboard_activity_count: number | null;
    mouse_activity_count: number | null;
    activity_percentage: number | null;
    memo: string | null;
  },
  screenshotUrl: string | null
): TimeSegmentDto {
  return {
    id: segment.id,
    timeEntryId: segment.time_entry_id,
    segmentStart: segment.segment_start,
    segmentEnd: segment.segment_end,
    durationSeconds: segmentDurationSeconds(segment.segment_start, segment.segment_end),
    keyboardActivityCount: segment.keyboard_activity_count,
    mouseActivityCount: segment.mouse_activity_count,
    activityPercentage: segment.activity_percentage,
    memo: segment.memo,
    screenshotUrl,
  };
}

// ── My Profile ───────────────────────────────────────────────────────────

export interface MyProfileDto {
  id: string;
  fullName: string | null;
  role: string;
  status: string;
}

/**
 * Who am I — used by the desktop app right after login (and on every
 * cold start) to confirm the access token is still valid, confirm the
 * signed-in account is actually a VA, and get a display name for the
 * timer screen header. `authenticateApiRequest` already re-derives this
 * same row on every request for its own role/status gate; this just
 * hands the (cheap, already-fetched-shape) result back to the caller.
 */
export async function getMyProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MyProfileDto> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, status")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new ApiRequestError(404, "No profile found for this account.");
  }

  return { id: profile.id, fullName: profile.full_name, role: profile.role, status: profile.status };
}

// ── My Active Placements ────────────────────────────────────────────────

export interface VaPlacementSummaryDto {
  id: string;
  companyName: string;
  projectId: string | null;
  projectName: string | null;
  jobTitle: string | null;
  hoursPerWeekExpected: number | null;
  startDate: string;
}

/**
 * The desktop app's Project Selection screen: ONLY this VA's ACTIVE
 * placements (not PENDING — not started yet; not PAUSED/ENDED — can't
 * track time against those). Deliberately narrower than the web
 * dashboard's `getVaPlacements` (which also shows PAUSED, "still a real
 * assignment, just on hold") — a desktop timer has no use for a
 * placement it isn't allowed to clock into right now. No rate columns
 * anywhere in this DTO; the timer UI has no reason to show pay rate.
 */
export async function getVaActivePlacements(
  supabase: SupabaseClient<Database>
): Promise<VaPlacementSummaryDto[]> {
  const { data: placements, error } = await supabase
    .from("va_placements_view")
    .select("id, client_id, job_id, project_id, hours_per_week_expected, status, start_date")
    .eq("status", "ACTIVE")
    .order("start_date", { ascending: false });

  if (error || !placements || placements.length === 0) return [];

  const valid = placements.filter(
    (p): p is typeof p & { id: string; client_id: string; start_date: string } =>
      !!p.id && !!p.client_id && !!p.start_date
  );

  const clientIds = [...new Set(valid.map((p) => p.client_id))];
  const jobIds = [...new Set(valid.map((p) => p.job_id).filter((id): id is string => !!id))];
  const projectIds = [...new Set(valid.map((p) => p.project_id).filter((id): id is string => !!id))];

  const [{ data: clients }, { data: jobs }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, company_name").in("id", clientIds),
    jobIds.length > 0
      ? supabase.from("va_jobs_view").select("id, title").in("id", jobIds)
      : Promise.resolve({ data: [] as { id: string | null; title: string | null }[] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const clientById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));
  const jobById = new Map((jobs ?? []).filter((j) => !!j.id).map((j) => [j.id as string, j.title ?? "Untitled job"]));
  const projectById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return valid.map((p) => ({
    id: p.id,
    companyName: clientById.get(p.client_id) ?? "Unknown company",
    projectId: p.project_id,
    projectName: p.project_id ? (projectById.get(p.project_id) ?? null) : null,
    jobTitle: p.job_id ? (jobById.get(p.job_id) ?? null) : null,
    hoursPerWeekExpected: p.hours_per_week_expected,
    startDate: p.start_date,
  }));
}

// ── Start Timer ─────────────────────────────────────────────────────────

export async function startTimer(
  supabase: SupabaseClient<Database>,
  placementId: string
): Promise<TimeSessionDto> {
  // A VA with a timer already running shouldn't be able to start a
  // second one against the same placement — RLS scopes this read to the
  // caller's own placements already (time_entries_select_va), so "any
  // running entry at all" is the same check as "any running entry this
  // VA can see."
  const { data: alreadyRunning } = await supabase
    .from("time_entries")
    .select("id")
    .eq("placement_id", placementId)
    .is("ended_at", null)
    .maybeSingle();

  if (alreadyRunning) {
    throw new ApiRequestError(409, "A timer is already running for this placement.");
  }

  const { data: entry, error } = await supabase
    .from("time_entries")
    .insert({ placement_id: placementId })
    .select("id, placement_id, started_at, ended_at, status")
    .single();

  if (error || !entry) {
    // RLS (time_entries_insert_va: va_owns_placement) rejects a placement
    // that isn't this VA's own — surfaces here as a plain insert failure,
    // not a special case to detect: either way, the caller gets a clean
    // "can't do that," never another VA's placement id confirmed to exist.
    throw new ApiRequestError(403, "Couldn't start a timer for this placement.");
  }

  return toSessionDto(supabase, entry);
}

// ── Stop Timer ───────────────────────────────────────────────────────────

export async function stopTimer(
  supabase: SupabaseClient<Database>,
  timeEntryId: string,
  // Only ever sent by the desktop app's stale-session reconciliation —
  // see stopTimerSchema. A normal Stop-button call omits this and gets
  // the server's own "now", same as before this param existed.
  requestedEndedAt?: string
): Promise<TimeSessionDto> {
  // Read started_at first rather than blindly writing `new Date()` as
  // ended_at: the app server's clock and the database's clock are two
  // different machines (in local dev, a Docker container vs. the host)
  // and can measurably disagree. For any realistic session (seconds to
  // hours long) that's irrelevant — but a session stopped within
  // milliseconds of starting can have ended_at computed on the app
  // server land BEFORE started_at as computed by the database, tripping
  // the time_entries_end_after_start CHECK constraint and turning a
  // real Stop into a permanently-dropped, silently-orphaned running
  // entry. Clamping to started_at when that happens is the honest
  // answer anyway: from the database's own clock, no measurable time
  // passed.
  //
  // The clamp adds 1ms rather than using started_at verbatim: Postgres
  // stores timestamptz with microsecond precision, but round-tripping
  // through a JS `Date` truncates to milliseconds — so the parsed
  // `startedAt` here is always <= the true stored value (by at most
  // 999 microseconds), and re-submitting it as-is could STILL trip the
  // same >= check by a few microseconds. Adding a full millisecond is
  // comfortably more than that truncation can ever lose, so the
  // clamped value is always >= the real column value.
  const { data: existing } = await supabase
    .from("time_entries")
    .select("started_at")
    .eq("id", timeEntryId)
    .is("ended_at", null)
    .maybeSingle();

  if (!existing) {
    throw new ApiRequestError(404, "No running timer found with that id.");
  }

  const now = new Date();
  const startedAt = new Date(existing.started_at);
  // A caller-supplied endedAt (the reconciliation path) is trusted only
  // within [startedAt, now]: never past the server's own clock — a
  // future-dated end would count time that hasn't happened yet, the
  // exact "invented time" this whole mechanism exists to prevent — and
  // never at/before startedAt, same 1ms-forward clamp as the no-arg case
  // below (Postgres's microsecond precision vs JS Date's millisecond
  // truncation — see the original comment on that clamp).
  const candidate = requestedEndedAt ? new Date(requestedEndedAt) : now;
  const endedAt =
    candidate.getTime() > now.getTime()
      ? now
      : candidate.getTime() > startedAt.getTime()
        ? candidate
        : new Date(startedAt.getTime() + 1);

  const { data: entry, error } = await supabase
    .from("time_entries")
    .update({ ended_at: endedAt.toISOString() })
    .eq("id", timeEntryId)
    .is("ended_at", null)
    .select("id, placement_id, started_at, ended_at, status")
    .maybeSingle();

  if (error) {
    console.error("[stopTimer] update failed:", JSON.stringify(error));
    throw new ApiRequestError(403, "Couldn't stop this timer.");
  }
  if (!entry) {
    throw new ApiRequestError(404, "No running timer found with that id.");
  }

  return toSessionDto(supabase, entry);
}

// ── Active Session Recovery ──────────────────────────────────────────────

/**
 * Any currently-running (`ended_at is null`) time entries visible to the
 * caller — RLS-scoped, same as everywhere else, so a VA only ever gets
 * their own. This is the desktop app's source of truth on every cold
 * start and reconnect: local storage says what the app *thinks* is
 * happening, this says what the server has actually committed. Returns
 * an array, not a single session, because `startTimer` only guards
 * against a second timer on the *same* placement — a VA with more than
 * one active placement could in principle have more than one running
 * entry; the caller (desktop app) is responsible for deciding how to
 * present that rather than this function silently picking one.
 */
export async function getActiveSessions(
  supabase: SupabaseClient<Database>
): Promise<TimeSessionDto[]> {
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, placement_id, started_at, ended_at, status")
    .is("ended_at", null)
    .order("started_at", { ascending: false });

  if (!entries || entries.length === 0) return [];
  return Promise.all(entries.map((entry) => toSessionDto(supabase, entry)));
}

// ── Create 10-Minute Segment ────────────────────────────────────────────

const SEGMENT_SELECT_COLUMNS =
  "id, time_entry_id, segment_start, segment_end, keyboard_activity_count, mouse_activity_count, activity_percentage, memo";

/**
 * Idempotency key for `createSegment` — see the `segment_idempotency`
 * migration and docs/database.md ("Offline resilience in the desktop
 * app"). A caller (the desktop app, retrying an op it queued locally
 * because it never confirmed whether an earlier attempt actually
 * reached the server) always sends the SAME `client_segment_id` for the
 * same logical segment. Postgres's unique index on that column is what
 * actually enforces "never two segments for one client-generated id" —
 * this is Postgres's real error code for a unique-constraint violation.
 */
const UNIQUE_VIOLATION = "23505";

export async function createSegment(
  supabase: SupabaseClient<Database>,
  input: CreateSegmentInput
): Promise<TimeSegmentDto> {
  // Idempotent short-circuit: if this exact client-generated id already
  // has a segment, a previous attempt already fully succeeded — return
  // it as-is rather than re-validating or re-inserting. This is what
  // makes retrying a queued "create segment" op after a lost response
  // safe: the retry becomes a no-op read, not a second row.
  const { data: existingByClientId } = await supabase
    .from("time_segments")
    .select(SEGMENT_SELECT_COLUMNS)
    .eq("client_segment_id", input.clientSegmentId)
    .maybeSingle();
  if (existingByClientId) {
    return toSegmentDto(existingByClientId, null);
  }

  const { data: entry } = await supabase
    .from("time_entries")
    .select("id, started_at, ended_at")
    .eq("id", input.timeEntryId)
    .maybeSingle();

  if (!entry) {
    throw new ApiRequestError(404, "Time entry not found.");
  }

  // Segments must fall inside their parent session's own bounds — can't
  // log tracked time before the timer started, or after it was stopped.
  // (Max-10-minutes-per-segment is already a DB CHECK constraint;
  // start-before-end is already enforced by the schema's own refine.)
  if (new Date(input.segmentStart) < new Date(entry.started_at)) {
    throw new ApiRequestError(422, "segmentStart can't be before the time entry's start time.");
  }
  if (entry.ended_at && new Date(input.segmentEnd) > new Date(entry.ended_at)) {
    throw new ApiRequestError(422, "segmentEnd can't be after the time entry's end time.");
  }

  const { data: segment, error } = await supabase
    .from("time_segments")
    .insert({
      time_entry_id: input.timeEntryId,
      client_segment_id: input.clientSegmentId,
      segment_start: input.segmentStart,
      segment_end: input.segmentEnd,
      keyboard_activity_count: input.keyboardActivityCount ?? null,
      mouse_activity_count: input.mouseActivityCount ?? null,
      activity_percentage: input.activityPercentage ?? null,
      memo: input.memo ?? null,
    })
    .select(SEGMENT_SELECT_COLUMNS)
    .single();

  if (error || !segment) {
    // A unique-violation specifically means a CONCURRENT retry of the
    // same clientSegmentId won a narrow race against the check above
    // (both requests passed the "does it exist yet" read before either
    // had inserted) — not a real failure. Fetch and return the row the
    // other request just created instead of erroring on what is, from
    // the caller's perspective, the exact same segment they already
    // asked for.
    if (error?.code === UNIQUE_VIOLATION) {
      const { data: raceWinner } = await supabase
        .from("time_segments")
        .select(SEGMENT_SELECT_COLUMNS)
        .eq("client_segment_id", input.clientSegmentId)
        .maybeSingle();
      if (raceWinner) {
        return toSegmentDto(raceWinner, null);
      }
    }
    throw new ApiRequestError(403, "Couldn't create this segment.");
  }

  return toSegmentDto(segment, null);
}

// ── Record Activity ─────────────────────────────────────────────────────

export async function recordActivity(
  supabase: SupabaseClient<Database>,
  segmentId: string,
  input: RecordActivityInput
): Promise<TimeSegmentDto> {
  const update: Database["public"]["Tables"]["time_segments"]["Update"] = {};
  if (input.keyboardActivityCount !== undefined) update.keyboard_activity_count = input.keyboardActivityCount;
  if (input.mouseActivityCount !== undefined) update.mouse_activity_count = input.mouseActivityCount;
  if (input.activityPercentage !== undefined) update.activity_percentage = input.activityPercentage;

  const { data: segment, error } = await supabase
    .from("time_segments")
    .update(update)
    .eq("id", segmentId)
    .select(
      "id, time_entry_id, segment_start, segment_end, keyboard_activity_count, mouse_activity_count, activity_percentage, memo"
    )
    .maybeSingle();

  if (error) {
    throw new ApiRequestError(403, "Couldn't record activity for this segment.");
  }
  if (!segment) {
    throw new ApiRequestError(404, "Segment not found.");
  }

  return toSegmentDto(segment, null);
}

// ── Upload Screenshot ────────────────────────────────────────────────────

async function signedScreenshotUrl(
  serviceClient: SupabaseClient<Database>,
  storagePath: string
): Promise<string> {
  const { data: signed } = await serviceClient.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return signed?.signedUrl ?? "";
}

/**
 * Upload, then insert — two operations, one idempotency requirement: a
 * retried request (the desktop app's offline queue, resending a
 * screenshot op it never got a confirmed response for) must land on
 * exactly the same outcome as the original, whichever of the two steps
 * the original actually reached before whatever interrupted it. Both
 * steps below are written to detect "this already happened" and return
 * the existing result rather than erroring — see docs/database.md
 * ("Offline resilience in the desktop app") for the two partial-failure
 * shapes this closes.
 */
export async function uploadScreenshot(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  segmentId: string,
  file: { bytes: Uint8Array; contentType: string; extension: string }
): Promise<{ screenshotId: string; screenshotUrl: string }> {
  // Ownership check FIRST, through the caller's own RLS-scoped client —
  // this is the authorization gate. The service-role client below only
  // ever touches Storage, and only after this has already passed.
  const { data: segment } = await supabase
    .from("time_segments")
    .select("id, time_entry_id")
    .eq("id", segmentId)
    .maybeSingle();

  if (!segment) {
    throw new ApiRequestError(404, "Segment not found.");
  }

  // A screenshot already recorded for this segment means an earlier
  // attempt — this one, retried, or a concurrent one — already fully
  // succeeded. Returning it is the idempotent-correct response: the
  // caller asked "make sure this segment has this screenshot," and it
  // does. (The one-screenshot-per-segment RULE is still real and still
  // enforced by the unique index below — this is that same invariant
  // read back as a success instead of re-asserted as an error.)
  const { data: existing } = await supabase
    .from("screenshots")
    .select("id, storage_path")
    .eq("time_segment_id", segmentId)
    .maybeSingle();
  if (existing) {
    return {
      screenshotId: existing.id,
      screenshotUrl: await signedScreenshotUrl(serviceClient, existing.storage_path),
    };
  }

  // The storage path is fully deterministic (segment id + extension) —
  // not random — specifically so a retry targets the exact same object
  // a prior attempt would have, rather than accumulating orphaned files.
  const storagePath = `${segment.time_entry_id}/${segmentId}.${file.extension}`;

  const { error: uploadError } = await serviceClient.storage
    .from(SCREENSHOT_BUCKET)
    .upload(storagePath, file.bytes, { contentType: file.contentType, upsert: false });

  if (uploadError) {
    // "Already exists" here — checked BEFORE the no-DB-row check above,
    // so this specific case means: a PRIOR attempt uploaded the file
    // but never got as far as (or never confirmed) the DB insert below.
    // That's not a failure to report — it's exactly the state a retry
    // is supposed to resume from. Any OTHER storage error is real.
    const alreadyExists = uploadError.statusCode === "409" || uploadError.message?.includes("already exists");
    if (!alreadyExists) {
      throw new ApiRequestError(500, "Couldn't upload the screenshot.");
    }
  }

  const { data: screenshot, error: insertError } = await supabase
    .from("screenshots")
    .insert({ time_segment_id: segmentId, storage_path: storagePath })
    .select("id")
    .single();

  if (insertError || !screenshot) {
    // A unique-violation means a CONCURRENT request (or a retry that
    // interleaved with itself in a narrow race) already inserted the
    // row between the check above and this insert — return that row
    // rather than erroring, and do NOT delete the file: it's the same
    // file that successful insert is pointing at.
    if (insertError?.code === UNIQUE_VIOLATION) {
      const { data: raceWinner } = await supabase
        .from("screenshots")
        .select("id, storage_path")
        .eq("time_segment_id", segmentId)
        .maybeSingle();
      if (raceWinner) {
        return {
          screenshotId: raceWinner.id,
          screenshotUrl: await signedScreenshotUrl(serviceClient, raceWinner.storage_path),
        };
      }
    }
    // A genuine, non-idempotent failure — safe to clean up the file
    // here since we know no DB row is pointing at it.
    await serviceClient.storage.from(SCREENSHOT_BUCKET).remove([storagePath]);
    throw new ApiRequestError(403, "Couldn't save the screenshot record.");
  }

  return {
    screenshotId: screenshot.id,
    screenshotUrl: await signedScreenshotUrl(serviceClient, storagePath),
  };
}

// ── Retrieve Work Diary ─────────────────────────────────────────────────

export async function getWorkDiary(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  filters: WorkDiaryQuery
): Promise<TimeSessionDto[]> {
  // No role branching here at all: RLS (time_entries_select_va /
  // _select_client / _admin_all) already determines exactly which rows
  // this caller can see. Optional filters just narrow within that —
  // they can never widen it. A client passing an arbitrary vaId they
  // don't have a placement relationship with simply gets zero rows, not
  // an error that would confirm whether that VA exists.
  let query = supabase
    .from("time_entries")
    .select("id, placement_id, started_at, ended_at, status")
    .order("started_at", { ascending: false });

  if (filters.placementId) query = query.eq("placement_id", filters.placementId);
  if (filters.startDate) query = query.gte("started_at", filters.startDate);
  if (filters.endDate) query = query.lte("started_at", `${filters.endDate}T23:59:59.999Z`);

  const { data: entries } = await query;
  if (!entries || entries.length === 0) return [];

  let scoped = entries;
  if (filters.vaId) {
    // Same base-table access gap as getPlacementSummary above — `placements`
    // has no SELECT policy for VA/CLIENT, only the rate-privacy views do.
    // A client narrowing "which of the VAs I can already see" needs
    // client_placements_view; admin's own filtering works through either.
    const placementIds = [...new Set(entries.map((e) => e.placement_id))];
    const [{ data: viaVa }, { data: viaClient }] = await Promise.all([
      supabase.from("va_placements_view").select("id, va_id").in("id", placementIds).eq("va_id", filters.vaId),
      supabase.from("client_placements_view").select("id, va_id").in("id", placementIds).eq("va_id", filters.vaId),
    ]);
    const allowedPlacementIds = new Set(
      [...(viaVa ?? []), ...(viaClient ?? [])].map((p) => p.id).filter((id): id is string => !!id)
    );
    scoped = entries.filter((e) => allowedPlacementIds.has(e.placement_id));
  }

  return Promise.all(scoped.map((entry) => toSessionDto(supabase, entry)));
}

/** Segments (with signed screenshot URLs) for one session, for the diary drill-down view. */
export async function getSessionSegments(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  timeEntryId: string
): Promise<TimeSegmentDto[]> {
  const { data: segments } = await supabase
    .from("time_segments")
    .select(
      "id, time_entry_id, segment_start, segment_end, keyboard_activity_count, mouse_activity_count, activity_percentage, memo"
    )
    .eq("time_entry_id", timeEntryId)
    .order("segment_start", { ascending: true });

  if (!segments || segments.length === 0) return [];

  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("id, time_segment_id, storage_path")
    .in(
      "time_segment_id",
      segments.map((s) => s.id)
    );

  const screenshotBySegment = new Map((screenshots ?? []).map((s) => [s.time_segment_id, s]));

  return Promise.all(
    segments.map(async (segment) => {
      const shot = screenshotBySegment.get(segment.id);
      let screenshotUrl: string | null = null;
      if (shot) {
        // Only ever generated for a screenshot row this caller's own
        // RLS-scoped query just returned — the DB read above is the
        // authorization gate; this is purely "now deliver the bytes."
        const { data: signed } = await serviceClient.storage
          .from(SCREENSHOT_BUCKET)
          .createSignedUrl(shot.storage_path, SIGNED_URL_TTL_SECONDS);
        screenshotUrl = signed?.signedUrl ?? null;
      }
      return toSegmentDto(segment, screenshotUrl);
    })
  );
}

// ── Work Diary interface (chronological blocks + summary) ──────────────

export interface WorkDiaryBlockDto {
  segmentId: string;
  timeEntryId: string;
  entryStatus: string;
  vaId: string;
  vaName: string;
  placementId: string;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  segmentStart: string;
  segmentEnd: string;
  durationSeconds: number;
  keyboardActivityCount: number | null;
  mouseActivityCount: number | null;
  activityPercentage: number | null;
  memo: string | null;
  screenshotId: string | null;
  screenshotUrl: string | null;
}

export interface WorkDiarySummary {
  totalSeconds: number;
  approvedSeconds: number;
  rejectedSeconds: number;
}

export interface WorkDiaryResult {
  blocks: WorkDiaryBlockDto[];
  summary: WorkDiarySummary;
}

/**
 * The chronological, per-~10-minute-block view the Work Diary interface
 * is built on (as opposed to getWorkDiary/getSessionSegments above, which
 * are session-shaped for the desktop-app-facing API). One function,
 * three portals: `/va/work-diary`, `/client/projects/[id]/work-diary`,
 * `/admin/time` all call this with different filters — RLS
 * (time_entries_select_va/_select_client/_admin_all, and the same on
 * time_segments) decides what each caller can actually see; filters only
 * ever narrow within that.
 */
export async function getWorkDiaryBlocks(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  filters: WorkDiaryQuery
): Promise<WorkDiaryResult> {
  let placementIdFilter: string[] | null = null;

  if (filters.placementId) {
    placementIdFilter = [filters.placementId];
  } else if (filters.projectId) {
    // time_entries has no project column of its own — project is always
    // reached through the placement. Resolve which placements (that this
    // caller can already see) belong to the project first.
    const [{ data: viaVa }, { data: viaClient }] = await Promise.all([
      supabase.from("va_placements_view").select("id").eq("project_id", filters.projectId),
      supabase.from("client_placements_view").select("id").eq("project_id", filters.projectId),
    ]);
    placementIdFilter = [
      ...new Set(
        [...(viaVa ?? []), ...(viaClient ?? [])].map((p) => p.id).filter((id): id is string => !!id)
      ),
    ];
    if (placementIdFilter.length === 0) return { blocks: [], summary: { totalSeconds: 0, approvedSeconds: 0, rejectedSeconds: 0 } };
  }

  let entryQuery = supabase
    .from("time_entries")
    .select("id, placement_id, started_at, ended_at, status");

  if (placementIdFilter) entryQuery = entryQuery.in("placement_id", placementIdFilter);
  if (filters.startDate) entryQuery = entryQuery.gte("started_at", filters.startDate);
  if (filters.endDate) entryQuery = entryQuery.lte("started_at", `${filters.endDate}T23:59:59.999Z`);

  const { data: entries } = await entryQuery;
  if (!entries || entries.length === 0) {
    return { blocks: [], summary: { totalSeconds: 0, approvedSeconds: 0, rejectedSeconds: 0 } };
  }

  let scopedEntries = entries;
  if (filters.vaId) {
    const placementIds = [...new Set(entries.map((e) => e.placement_id))];
    const [{ data: viaVa }, { data: viaClient }] = await Promise.all([
      supabase.from("va_placements_view").select("id, va_id").in("id", placementIds).eq("va_id", filters.vaId),
      supabase.from("client_placements_view").select("id, va_id").in("id", placementIds).eq("va_id", filters.vaId),
    ]);
    const allowed = new Set(
      [...(viaVa ?? []), ...(viaClient ?? [])].map((p) => p.id).filter((id): id is string => !!id)
    );
    scopedEntries = entries.filter((e) => allowed.has(e.placement_id));
  }
  if (scopedEntries.length === 0) {
    return { blocks: [], summary: { totalSeconds: 0, approvedSeconds: 0, rejectedSeconds: 0 } };
  }

  const entryIds = scopedEntries.map((e) => e.id);
  const entryById = new Map(scopedEntries.map((e) => [e.id, e]));

  const { data: segments } = await supabase
    .from("time_segments")
    .select(
      "id, time_entry_id, segment_start, segment_end, keyboard_activity_count, mouse_activity_count, activity_percentage, memo"
    )
    .in("time_entry_id", entryIds)
    .order("segment_start", { ascending: true });

  if (!segments || segments.length === 0) {
    return { blocks: [], summary: { totalSeconds: 0, approvedSeconds: 0, rejectedSeconds: 0 } };
  }

  const [{ data: screenshots }, placementSummaries] = await Promise.all([
    supabase
      .from("screenshots")
      .select("id, time_segment_id, storage_path")
      .in(
        "time_segment_id",
        segments.map((s) => s.id)
      ),
    getPlacementSummaries(supabase, [...new Set(scopedEntries.map((e) => e.placement_id))]),
  ]);

  const screenshotBySegment = new Map((screenshots ?? []).map((s) => [s.time_segment_id, s]));

  const vaIds = [...new Set([...placementSummaries.values()].map((p) => p.va_id))];
  const projectIds = [
    ...new Set([...placementSummaries.values()].map((p) => p.project_id).filter((id): id is string => !!id)),
  ];
  const clientIds = [
    ...new Set([...placementSummaries.values()].map((p) => p.client_id).filter((id): id is string => !!id)),
  ];

  const [{ data: profiles }, { data: projects }, { data: clients }] = await Promise.all([
    vaIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", vaIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    clientIds.length > 0
      ? supabase.from("clients").select("id, company_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
  ]);

  const vaNameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unnamed VA"]));
  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.company_name]));

  const blocks = await Promise.all(
    segments.map(async (segment) => {
      const entry = entryById.get(segment.time_entry_id);
      const placement = entry ? placementSummaries.get(entry.placement_id) : undefined;
      const shot = screenshotBySegment.get(segment.id);

      let screenshotUrl: string | null = null;
      if (shot) {
        const { data: signed } = await serviceClient.storage
          .from(SCREENSHOT_BUCKET)
          .createSignedUrl(shot.storage_path, SIGNED_URL_TTL_SECONDS);
        screenshotUrl = signed?.signedUrl ?? null;
      }

      const block: WorkDiaryBlockDto = {
        segmentId: segment.id,
        timeEntryId: segment.time_entry_id,
        entryStatus: entry?.status ?? "pending",
        vaId: placement?.va_id ?? "",
        vaName: placement ? (vaNameById.get(placement.va_id) ?? "Unnamed VA") : "Unnamed VA",
        placementId: entry?.placement_id ?? "",
        projectId: placement?.project_id ?? null,
        projectName: placement?.project_id ? (projectNameById.get(placement.project_id) ?? null) : null,
        clientName: placement?.client_id ? (clientNameById.get(placement.client_id) ?? null) : null,
        segmentStart: segment.segment_start,
        segmentEnd: segment.segment_end,
        durationSeconds: segmentDurationSeconds(segment.segment_start, segment.segment_end),
        keyboardActivityCount: segment.keyboard_activity_count,
        mouseActivityCount: segment.mouse_activity_count,
        activityPercentage: segment.activity_percentage,
        memo: segment.memo,
        screenshotId: shot?.id ?? null,
        screenshotUrl,
      };
      return block;
    })
  );

  const summary = blocks.reduce(
    (acc, block) => {
      acc.totalSeconds += block.durationSeconds;
      if (block.entryStatus === "approved") acc.approvedSeconds += block.durationSeconds;
      if (block.entryStatus === "rejected") acc.rejectedSeconds += block.durationSeconds;
      return acc;
    },
    { totalSeconds: 0, approvedSeconds: 0, rejectedSeconds: 0 }
  );

  return { blocks, summary };
}

// ── Delete Screenshot (cascades to its segment) ─────────────────────────

export async function deleteScreenshot(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  screenshotId: string
): Promise<void> {
  // delete_screenshot() is SECURITY DEFINER and does its own
  // authorization check (VA-owner or admin) independent of RLS — see the
  // original time-tracking migration and docs/database.md. It deletes
  // the time_segments row (cascading to the screenshots row via FK) and
  // returns the storage_path so the file can be removed too, in the same
  // request, rather than leaving an orphaned object.
  const { data: storagePath, error } = await supabase.rpc("delete_screenshot", {
    target_screenshot_id: screenshotId,
  });

  if (error) {
    if (error.message.includes("not found")) {
      throw new ApiRequestError(404, "Screenshot not found.");
    }
    if (error.message.includes("Not authorized")) {
      throw new ApiRequestError(403, "Not authorized to delete this screenshot.");
    }
    throw new ApiRequestError(500, "Couldn't delete this screenshot.");
  }

  if (storagePath) {
    await serviceClient.storage.from(SCREENSHOT_BUCKET).remove([storagePath]);
  }
}
