import { create } from "zustand";
import { timeApi, ApiError } from "./apiClient";
import { enqueue, flush as flushQueue } from "./offlineQueue";
import { useTotalsStore } from "./totals";
import { useAuthStore } from "./authStore";
import { captureScreenshot, ScreenCapturePermissionError } from "./screenshotCapture";
import {
  startActivityMonitoring,
  stopActivityMonitoring,
  getAndResetActivity,
  ActivityMonitorPermissionError,
} from "./activityMonitor";
import {
  getActiveSessionMarker,
  setActiveSessionMarker,
  getPendingOps,
  getPendingScreenshot,
  setPendingScreenshot,
  type ActiveSessionMarker,
} from "./localStore";

// The segment boundary is kept comfortably under the backend's hard
// 10-minute-per-segment CHECK constraint (createSegmentSchema / the
// time_segments table) so that a tick firing a little late (a busy
// event loop, a slow disk write) never produces a segment the server
// would reject.
const SEGMENT_ROLLOVER_MS = 9 * 60 * 1000;
const TICK_MS = 1000;

// How often the local marker's lastSeenAt is rewritten purely as a
// heartbeat (independent of segment rollovers, which already refresh it
// as a side effect of closing their window) — see the heartbeat branch
// in onTick(). Kept well under STALE_SESSION_THRESHOLD_MS so a genuine
// crash is always caught with a comfortable margin, not by coincidence.
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// How much older than lastSeenAt "now" can be, on relaunch, before a
// still-server-running session that matches the local marker is treated
// as unverifiable rather than resumable. Comfortably more than one
// heartbeat interval (network jitter, a slow disk write, a brief
// suspend) but small enough that anything past it really does mean the
// app was gone for a meaningful, unaccounted-for stretch — see
// closeStaleSession() and reconcile().
const STALE_SESSION_THRESHOLD_MS = 90 * 1000;

function randomScreenshotOffsetMs(): number {
  return Math.floor(Math.random() * SEGMENT_ROLLOVER_MS);
}

export type TimerStatus = "idle" | "starting" | "running" | "stopping";

interface TimerState {
  status: TimerStatus;
  placementId: string | null;
  timeEntryId: string | null;
  serverStartTime: string | null;
  currentSegmentStart: string | null;
  task: string;
  elapsedSeconds: number;
  /** Seconds accumulated in the not-yet-synced current segment — ticked here, not computed in a component render (Date.now() has no place in render). */
  liveUnsyncedSeconds: number;
  error: string | null;
  /** Set once, by reconcile(), when a previous session couldn't be resumed cleanly — shown once, then cleared. */
  recoveryNotice: string | null;
  clearRecoveryNotice: () => void;

  /** Random target offset (ms) within the CURRENT segment window for its one screenshot. Null only when idle. */
  screenshotOffsetMs: number | null;
  /** Whether the current window's screenshot has already been attempted (captured or failed) — prevents a second attempt in the same window. */
  screenshotCaptured: boolean;
  /** Sticky until the next successful capture — surfaced as an actionable banner, not just logged. */
  screenshotPermissionIssue: boolean;

  /** Whether the Rust-side poller is actually running for this session — governs whether segments get real activity numbers or `null` ("not measured," never a misleading 0%). */
  activityMonitoringAvailable: boolean;
  /** Sticky until the next successful start — surfaced as an actionable banner, not just logged. */
  activityPermissionIssue: boolean;

  reconcile: () => Promise<void>;
  start: (placementId: string) => Promise<void>;
  stop: () => Promise<void>;
  /** Returns once the task memo has actually been persisted to the local marker — callers that need that guarantee (vs. fire-and-forget UI usage) can await it. */
  setTask: (task: string) => Promise<void>;
}

let tickHandle: ReturnType<typeof setInterval> | null = null;

function stopTicking() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

// Tracks a capture that's still in flight (an OS call + IPC round trip —
// not instant) against the window it was scheduled for. Rollover (and
// stop()) check this before deciding whether a window has a screenshot
// to attach: without it, a capture scheduled in the same 1-second tick
// as that same window's rollover could still be mid-flight when
// attachPendingScreenshot() runs, find nothing yet stashed, and miss the
// window entirely even though the capture was about to succeed a moment
// later. Kept as a plain module variable, not store state — it's
// scheduling plumbing, not anything a component ever needs to render.
let inFlightCapture: { windowStart: string; promise: Promise<void> } | null = null;

async function waitForInFlightCapture(windowStartIso: string): Promise<void> {
  if (inFlightCapture && inFlightCapture.windowStart === windowStartIso) {
    await inFlightCapture.promise;
  }
}

// Last time this process actually wrote the marker (rollover or
// heartbeat) — throttles the heartbeat branch in onTick() so it writes
// on its own cadence rather than on every 1s tick. Reset whenever a
// session starts/resumes so the first heartbeat lands a full interval
// later, not immediately.
let lastHeartbeatWriteMs = 0;

async function persistMarker(state: {
  timeEntryId: string;
  placementId: string;
  serverStartTime: string;
  currentSegmentStart: string;
  task: string;
  screenshotOffsetMs: number;
  screenshotCaptured: boolean;
}) {
  // lastSeenAt is always stamped "now," never passed in — every call to
  // this function IS the moment being vouched for. On relaunch, this is
  // the one thing stale-session recovery trusts: not what the marker
  // says about when tracking was SUPPOSED to still be running, but the
  // last instant this process can actually prove it was alive and this
  // state was current.
  const marker: ActiveSessionMarker = { ...state, lastSeenAt: new Date().toISOString() };
  await setActiveSessionMarker(marker);
}

/**
 * A local marker whose session is still running server-side, found on
 * relaunch more than STALE_SESSION_THRESHOLD_MS after its own
 * lastSeenAt, means the app was gone (crash, force quit, power loss,
 * OS-suspended long enough to matter) for a stretch nothing observed.
 * Resuming as if that gap were ordinary tracked time would let onTick's
 * rollover loop replay however many 9-minute windows the gap spans as
 * fabricated segments — exactly the "invented time" this exists to
 * prevent. Instead: close the session at the last verified checkpoint.
 * Only the part of the open window up to lastSeenAt (which WAS
 * observed) becomes a real segment; nothing past it ever does — not
 * created-then-discarded, simply never created.
 */
async function closeStaleSession(marker: ActiveSessionMarker): Promise<string> {
  const windowStartMs = new Date(marker.currentSegmentStart).getTime();
  const lastSeenMs = new Date(marker.lastSeenAt).getTime();

  if (lastSeenMs > windowStartMs) {
    const clientSegmentId = crypto.randomUUID();
    await enqueue({
      kind: "segment",
      clientSegmentId,
      payload: {
        timeEntryId: marker.timeEntryId,
        segmentStart: marker.currentSegmentStart,
        segmentEnd: marker.lastSeenAt,
        memo: marker.task.trim() || null,
        // The Rust-side activity counters are in-memory only and never
        // survive a crash — "not measured," never a fabricated number.
        keyboardActivityCount: null,
        mouseActivityCount: null,
        activityPercentage: null,
      },
    });
    await attachPendingScreenshot(marker.currentSegmentStart, clientSegmentId);
  } else {
    // No verified time in the open window at all — a screenshot
    // captured for it (if any) has nowhere left to attach to.
    await setPendingScreenshot(null);
  }

  // endedAt = lastSeenAt, not "now" — see stopTimer()'s clamp in
  // service.ts. Closing at the last verified moment, not the moment
  // this was noticed, is the entire point.
  await enqueue({
    kind: "stop",
    payload: { timeEntryId: marker.timeEntryId, endedAt: marker.lastSeenAt },
  });
  await flushQueue();
  await setActiveSessionMarker(null);

  return marker.lastSeenAt;
}

/**
 * Attaches a same-window pending screenshot (if one was captured) to a
 * segment that's about to be enqueued, tagging both ops with the same
 * clientSegmentId so the offline queue can wire the upload to the real
 * segment id once it exists — see offlineQueue.ts. Always call this
 * immediately after enqueueing the segment op it pairs with.
 */
async function attachPendingScreenshot(windowStartIso: string, clientSegmentId: string): Promise<void> {
  const pending = await getPendingScreenshot();
  if (!pending || pending.windowStart !== windowStartIso) return;
  await enqueue({
    kind: "screenshot",
    clientSegmentId,
    payload: { base64: pending.base64, mimeType: pending.mimeType },
  });
  await setPendingScreenshot(null);
}

export const useTimerStore = create<TimerState>((set, get) => {
  function startTicking() {
    stopTicking();
    tickHandle = setInterval(() => void onTick(), TICK_MS);
  }

  /**
   * Captures ONE screenshot for the given window and stashes it locally
   * (not yet uploaded — it has no segment id to attach to until that
   * window rolls over). Re-validates that tracking is still genuinely
   * active both before AND after the capture, since it's the one place
   * in this app that reaches an OS API asynchronously: the world can
   * change (Stop clicked, signed out) while waiting on it. A screenshot
   * whose window is no longer current is discarded, never stashed or
   * uploaded — "never capture outside active tracking" is enforced at
   * the point of USE, not just at the point of scheduling.
   *
   * "running" OR "stopping" both count as active: a capture legitimately
   * triggered while running that resolves a moment after stop() has
   * already flipped status to "stopping" (stop() awaits exactly this
   * capture before deciding what to attach — see waitForInFlightCapture)
   * is still for a window that was genuinely being tracked, not a stray
   * capture happening after tracking ended. Only "idle" (fully stopped)
   * or a different/no-longer-current window means abandon it.
   */
  async function captureForWindow(windowStartIso: string): Promise<void> {
    const stillActive = () =>
      (get().status === "running" || get().status === "stopping") &&
      get().currentSegmentStart === windowStartIso &&
      !!useAuthStore.getState().accessToken;

    if (!stillActive()) return;

    try {
      const shot = await captureScreenshot();
      if (!stillActive()) return;
      await setPendingScreenshot({
        windowStart: windowStartIso,
        capturedAt: new Date().toISOString(),
        base64: shot.base64,
        mimeType: shot.mimeType,
      });
      if (get().screenshotPermissionIssue) set({ screenshotPermissionIssue: false });
    } catch (err) {
      if (err instanceof ScreenCapturePermissionError) {
        set({ screenshotPermissionIssue: true });
      } else {
        console.error("[timer] screenshot capture failed:", err);
      }
    }
  }

  /**
   * Starts the Rust-side poller for this session — called from both
   * start() and reconcile()'s resume path, since the poller is entirely
   * in-memory on the Rust side and never survives a process restart, so
   * every fresh process needs its own start call regardless of what a
   * locally-persisted marker remembers. Best-effort: a missing
   * Accessibility permission surfaces as a sticky, actionable flag but
   * never blocks time tracking itself, exactly like the equivalent
   * screenshot-permission handling above.
   */
  async function beginActivityMonitoring(): Promise<void> {
    try {
      await startActivityMonitoring();
      set({ activityMonitoringAvailable: true, activityPermissionIssue: false });
    } catch (err) {
      if (err instanceof ActivityMonitorPermissionError) {
        set({ activityMonitoringAvailable: false, activityPermissionIssue: true });
      } else {
        console.error("[timer] couldn't start activity monitoring:", err);
        set({ activityMonitoringAvailable: false });
      }
    }
  }

  /**
   * Fetches and resets the Rust-side counters for the window that just
   * ended, and turns them into the three fields createSegment sends —
   * see docs/database.md for the exact activity-percentage formula. If
   * monitoring was never available for this session (permission denied,
   * or genuinely never started), all three come back `null` — "not
   * measured," a materially different and fairer signal than a
   * misleading `0%` implying "measured and found completely inactive."
   */
  async function activityFieldsForWindow(durationMs: number): Promise<{
    keyboardActivityCount: number | null;
    mouseActivityCount: number | null;
    activityPercentage: number | null;
  }> {
    if (!get().activityMonitoringAvailable) {
      return { keyboardActivityCount: null, mouseActivityCount: null, activityPercentage: null };
    }
    try {
      const snapshot = await getAndResetActivity();
      const durationSeconds = Math.max(1, Math.round(durationMs / 1000));
      const activityPercentage = Math.min(
        100,
        Math.max(0, Math.round((snapshot.activeSecondsCount / durationSeconds) * 100))
      );
      return {
        keyboardActivityCount: snapshot.keyboardCount,
        // Clicks and movement are combined into the one "mouse activity"
        // number the existing schema has room for — see docs/database.md
        // for why, and for how the two are broken out in the raw
        // snapshot if that ever changes.
        mouseActivityCount: snapshot.mouseClickCount + snapshot.mouseMovementCount,
        activityPercentage,
      };
    } catch (err) {
      console.error("[timer] couldn't read activity counters:", err);
      return { keyboardActivityCount: null, mouseActivityCount: null, activityPercentage: null };
    }
  }

  async function onTick() {
    const state = get();
    if (state.status !== "running" || !state.serverStartTime || !state.currentSegmentStart) return;

    const now = Date.now();
    set({ elapsedSeconds: Math.floor((now - new Date(state.serverStartTime).getTime()) / 1000) });

    // Checked BEFORE rollover, against the window that's still current
    // right now — a target reached in the last instant of a window
    // still fires against THAT window rather than being silently
    // skipped when the window rolls over later in this same tick.
    if (state.screenshotOffsetMs !== null && !state.screenshotCaptured) {
      const windowStartMs = new Date(state.currentSegmentStart).getTime();
      if (now - windowStartMs >= state.screenshotOffsetMs) {
        const windowStartIso = state.currentSegmentStart;
        set({ screenshotCaptured: true });
        const promise = captureForWindow(windowStartIso).finally(() => {
          if (inFlightCapture?.promise === promise) inFlightCapture = null;
        });
        inFlightCapture = { windowStart: windowStartIso, promise };
      }
    }

    let segmentStart = new Date(state.currentSegmentStart).getTime();
    let rolledOver = false;
    while (now - segmentStart >= SEGMENT_ROLLOVER_MS) {
      const segmentEnd = segmentStart + SEGMENT_ROLLOVER_MS;
      const timeEntryId = get().timeEntryId;
      if (!timeEntryId) break;

      const windowStartIso = new Date(segmentStart).toISOString();
      const clientSegmentId = crypto.randomUUID();
      // Read BEFORE enqueueing — fetching resets the Rust-side counters
      // for the NEXT window, so this must happen exactly once per
      // rollover, right as this window closes.
      const activityFields = await activityFieldsForWindow(SEGMENT_ROLLOVER_MS);
      await enqueue({
        kind: "segment",
        clientSegmentId,
        payload: {
          timeEntryId,
          segmentStart: windowStartIso,
          segmentEnd: new Date(segmentEnd).toISOString(),
          memo: get().task.trim() || null,
          ...activityFields,
        },
      });
      await waitForInFlightCapture(windowStartIso);
      await attachPendingScreenshot(windowStartIso, clientSegmentId);

      segmentStart = segmentEnd;
      set({
        currentSegmentStart: new Date(segmentStart).toISOString(),
        screenshotOffsetMs: randomScreenshotOffsetMs(),
        screenshotCaptured: false,
      });

      const current = get();
      if (current.timeEntryId && current.placementId && current.serverStartTime) {
        await persistMarker({
          timeEntryId: current.timeEntryId,
          placementId: current.placementId,
          serverStartTime: current.serverStartTime,
          currentSegmentStart: current.currentSegmentStart!,
          task: current.task,
          screenshotOffsetMs: current.screenshotOffsetMs!,
          screenshotCaptured: current.screenshotCaptured,
        });
      }

      rolledOver = true;
    }

    set({ liveUnsyncedSeconds: Math.floor((now - segmentStart) / 1000) });

    if (rolledOver) {
      // A rollover just persisted a fresh marker (with a fresh
      // lastSeenAt) as a side effect of closing its window.
      lastHeartbeatWriteMs = now;
      await flushQueue();
      void useTotalsStore.getState().refresh();
    } else if (now - lastHeartbeatWriteMs >= HEARTBEAT_INTERVAL_MS) {
      // No rollover this tick — without this, lastSeenAt could go stale
      // for up to a full 9-minute window (the longest a segment can run
      // between rollovers), understating how recently tracking was
      // actually verified active if the app were to crash right now.
      const current = get();
      if (
        current.timeEntryId &&
        current.placementId &&
        current.serverStartTime &&
        current.currentSegmentStart &&
        current.screenshotOffsetMs !== null
      ) {
        await persistMarker({
          timeEntryId: current.timeEntryId,
          placementId: current.placementId,
          serverStartTime: current.serverStartTime,
          currentSegmentStart: current.currentSegmentStart,
          task: current.task,
          screenshotOffsetMs: current.screenshotOffsetMs,
          screenshotCaptured: current.screenshotCaptured,
        });
      }
      lastHeartbeatWriteMs = now;
    }
  }

  return {
    status: "idle",
    placementId: null,
    timeEntryId: null,
    serverStartTime: null,
    currentSegmentStart: null,
    task: "",
    elapsedSeconds: 0,
    liveUnsyncedSeconds: 0,
    error: null,
    recoveryNotice: null,
    clearRecoveryNotice: () => set({ recoveryNotice: null }),
    screenshotOffsetMs: null,
    screenshotCaptured: false,
    screenshotPermissionIssue: false,
    activityMonitoringAvailable: false,
    activityPermissionIssue: false,

    async setTask(task) {
      set({ task });
      const state = get();
      if (
        state.timeEntryId &&
        state.placementId &&
        state.serverStartTime &&
        state.currentSegmentStart &&
        state.screenshotOffsetMs !== null
      ) {
        await persistMarker({
          timeEntryId: state.timeEntryId,
          placementId: state.placementId,
          serverStartTime: state.serverStartTime,
          currentSegmentStart: state.currentSegmentStart,
          task,
          screenshotOffsetMs: state.screenshotOffsetMs,
          screenshotCaptured: state.screenshotCaptured,
        });
      }
    },

    async reconcile() {
      // Sync first: if a previous run queued a Stop (or a final segment)
      // that never made it to the server before the app closed, get it
      // there now — BEFORE deciding what "currently running" even means.
      // Deciding that from a stale server view would otherwise "resume"
      // a session the VA already stopped, with no way to notice once the
      // queue quietly finishes syncing the real stop underneath it.
      await flushQueue();

      const [marker, pendingOps, serverSessions] = await Promise.all([
        getActiveSessionMarker(),
        getPendingOps(),
        timeApi.activeSessions(),
      ]);
      const stopPendingFor = new Set(
        pendingOps.filter((op) => op.kind === "stop").map((op) => op.payload.timeEntryId)
      );
      // Anything still showing a queued Stop lost the sync race (offline)
      // — treat it as already-stopped from this app's point of view, not
      // as a session to resume. It stays queued and will finish syncing
      // on the next successful flush.
      const sessions = serverSessions.sessions.filter((s) => !stopPendingFor.has(s.id));

      if (sessions.length === 0) {
        // Nothing running server-side (or the only thing that was is
        // covered by a Stop still finishing its sync — not unexpected,
        // don't warn about that one). If local storage thought a
        // DIFFERENT session was still active, it ended without this
        // app's knowledge (stopped elsewhere, or the app was killed
        // before Start ever reached the server) — clear the stale
        // marker and say so, rather than silently losing the VA's sense
        // of what happened. Any orphaned pending screenshot has no live
        // session left to attach to either.
        if (marker && !stopPendingFor.has(marker.timeEntryId)) {
          await setActiveSessionMarker(null);
          await setPendingScreenshot(null);
          set({ recoveryNotice: "Your previous timer session had already ended and wasn't resumed." });
        } else if (marker && stopPendingFor.has(marker.timeEntryId)) {
          await setActiveSessionMarker(null);
        }
        return;
      }

      if (sessions.length > 1) {
        console.warn(`[timer] ${sessions.length} sessions running simultaneously — resuming only the most recent.`);
      }
      const session = sessions[0];
      if (!session) return;
      const matchesLocalMarker = marker && marker.timeEntryId === session.id;

      if (matchesLocalMarker) {
        const gapMs = Date.now() - new Date(marker.lastSeenAt).getTime();
        if (gapMs > STALE_SESSION_THRESHOLD_MS) {
          const closedAt = await closeStaleSession(marker);
          set({
            status: "idle",
            placementId: null,
            timeEntryId: null,
            serverStartTime: null,
            currentSegmentStart: null,
            task: "",
            elapsedSeconds: 0,
            liveUnsyncedSeconds: 0,
            screenshotOffsetMs: null,
            screenshotCaptured: false,
            activityMonitoringAvailable: false,
            recoveryNotice:
              `The app closed unexpectedly while a timer was running. ` +
              `We saved your tracked time up to ${new Date(closedAt).toLocaleTimeString()} and stopped the ` +
              `timer there — time after that wasn't counted, since there's no way to confirm what happened ` +
              `while the app was closed. Start a new session to keep tracking.`,
          });
          void useTotalsStore.getState().refresh();
          return;
        }
      }
      // Re-stamped for the same reason as in start() — session.startTime
      // is a raw Postgres timestamptz string, not necessarily in the
      // exact format createSegmentSchema's z.string().datetime() accepts.
      const serverStartTime = new Date(session.startTime).toISOString();
      const resumedSegmentStart = matchesLocalMarker ? marker.currentSegmentStart : new Date().toISOString();
      const now = Date.now();

      set({
        status: "running",
        placementId: session.placementId,
        timeEntryId: session.id,
        serverStartTime,
        currentSegmentStart: resumedSegmentStart,
        task: matchesLocalMarker ? marker.task : "",
        elapsedSeconds: Math.floor((now - new Date(serverStartTime).getTime()) / 1000),
        liveUnsyncedSeconds: Math.floor((now - new Date(resumedSegmentStart).getTime()) / 1000),
        // A local marker's screenshot progress for THIS window carries
        // over exactly (still the same window); resuming a session with
        // no matching marker has no way to know, so it gets a fresh
        // target within whatever's left of the (now-effectively-restarted)
        // window rather than assuming one way or the other.
        screenshotOffsetMs: matchesLocalMarker ? marker.screenshotOffsetMs : randomScreenshotOffsetMs(),
        screenshotCaptured: matchesLocalMarker ? marker.screenshotCaptured : false,
        // Reaching this point at all with a matching marker means the
        // app went away without a clean Stop (stop() always clears the
        // marker) — always say so, even when the gap was short enough
        // to resume cleanly with nothing lost, rather than resuming
        // silently and leaving the VA to wonder whether anything is off.
        recoveryNotice: matchesLocalMarker
          ? "The app restarted while a timer was running. Your session was recovered with no tracked time lost."
          : "Resumed a timer that was already running on the server.",
      });

      const state = get();
      await persistMarker({
        timeEntryId: state.timeEntryId!,
        placementId: state.placementId!,
        serverStartTime: state.serverStartTime!,
        currentSegmentStart: state.currentSegmentStart!,
        task: state.task,
        screenshotOffsetMs: state.screenshotOffsetMs!,
        screenshotCaptured: state.screenshotCaptured,
      });
      lastHeartbeatWriteMs = Date.now();

      startTicking();
      void beginActivityMonitoring();
      void flushQueue();
    },

    async start(placementId) {
      if (get().status !== "idle") return;
      set({ status: "starting", error: null });
      try {
        const session = await timeApi.startTimer(placementId);
        // Postgres/PostgREST serializes timestamptz as e.g.
        // "...+00:00" (offset suffix, microsecond precision) — not the
        // "...Z" (millisecond precision) form JS's own toISOString()
        // produces, which is what createSegmentSchema's z.string().datetime()
        // requires by default. Re-stamping through `new Date(...).toISOString()`
        // here means every value this store ever uses as a segment
        // boundary is in the one format the API actually accepts,
        // regardless of whether it originated from the server or was
        // computed locally.
        const startTime = new Date(session.startTime).toISOString();
        const screenshotOffsetMs = randomScreenshotOffsetMs();
        set({
          status: "running",
          placementId,
          timeEntryId: session.id,
          serverStartTime: startTime,
          currentSegmentStart: startTime,
          task: "",
          elapsedSeconds: 0,
          liveUnsyncedSeconds: 0,
          screenshotOffsetMs,
          screenshotCaptured: false,
          screenshotPermissionIssue: false,
        });
        await persistMarker({
          timeEntryId: session.id,
          placementId,
          serverStartTime: startTime,
          currentSegmentStart: startTime,
          task: "",
          screenshotOffsetMs,
          screenshotCaptured: false,
        });
        lastHeartbeatWriteMs = Date.now();
        startTicking();
        void beginActivityMonitoring();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Couldn't start the timer. Please try again.";
        set({ status: "idle", error: message });
      }
    },

    async stop() {
      const state = get();
      if (state.status !== "running" || !state.timeEntryId || !state.currentSegmentStart) return;
      set({ status: "stopping" });
      stopTicking();

      const now = new Date();
      const segmentStart = new Date(state.currentSegmentStart);
      // Give a capture already in flight for THIS window a chance to
      // finish and stash before deciding whether there's anything to
      // attach or discard below — Stop can land in the same instant a
      // capture was triggered.
      await waitForInFlightCapture(state.currentSegmentStart);
      // Only submit a final partial segment if any time has actually
      // accumulated in it — stopping the instant a new boundary rolled
      // over would otherwise enqueue a zero-length segment.
      if (now.getTime() > segmentStart.getTime()) {
        const clientSegmentId = crypto.randomUUID();
        // Read BEFORE stopActivityMonitoring() below — stopping clears
        // the Rust-side counters, so the final window's numbers have to
        // be collected first or they're lost, not just reset to zero.
        const activityFields = await activityFieldsForWindow(now.getTime() - segmentStart.getTime());
        await enqueue({
          kind: "segment",
          clientSegmentId,
          payload: {
            timeEntryId: state.timeEntryId,
            segmentStart: state.currentSegmentStart,
            segmentEnd: now.toISOString(),
            memo: state.task.trim() || null,
            ...activityFields,
          },
        });
        await attachPendingScreenshot(state.currentSegmentStart, clientSegmentId);
      } else {
        // No final segment to attach to — a screenshot captured for this
        // window (if any) has nowhere to go. Discard it rather than
        // leaving it stranded in local storage forever. Any accumulated
        // activity counts are simply dropped along with the monitor's
        // own state by stopActivityMonitoring() below — nothing reads
        // them, and there's no segment for them to attach to either.
        await setPendingScreenshot(null);
      }
      // Stops the polling thread outright — from this point on nothing
      // in this app touches keyboard/mouse state again until the next
      // Start. Always called, whether or not a final segment was made
      // above, so activity tracking never outlives the timer itself.
      await stopActivityMonitoring();

      await enqueue({ kind: "stop", payload: { timeEntryId: state.timeEntryId } });
      await flushQueue();

      await setActiveSessionMarker(null);
      set({
        status: "idle",
        placementId: null,
        timeEntryId: null,
        serverStartTime: null,
        currentSegmentStart: null,
        task: "",
        elapsedSeconds: 0,
        liveUnsyncedSeconds: 0,
        screenshotOffsetMs: null,
        screenshotCaptured: false,
        activityMonitoringAvailable: false,
      });
      void useTotalsStore.getState().refresh();
    },
  };
});
