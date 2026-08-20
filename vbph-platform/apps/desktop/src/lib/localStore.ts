import { load, type Store } from "@tauri-apps/plugin-store";

// Non-secret local state, backed by a plain JSON file in the OS app-data
// directory (via the official Tauri store plugin). NOTHING that belongs
// in the OS keychain (tokens) ever goes here — see secureStore.ts for
// that. What lives here is exactly the state needed to recover from an
// app crash or restart without losing track of in-progress work:
//   - activeSession: a local mirror of "a timer is running," written
//     BEFORE the server call that starts it even returns, so a crash
//     between "user clicked Start" and "server confirmed" still leaves a
//     breadcrumb to reconcile against on next launch. Also remembers
//     whether this segment window's one screenshot has already been
//     captured, so a restart mid-window doesn't capture a second one.
//   - pendingOps: segments, screenshot uploads, and the final stop, that
//     were computed locally but not yet confirmed synced to the server —
//     the "local-safe recovery for unsynced timer data" the spec asks
//     for.
//   - lastPlacementId: which placement was selected, purely a UX
//     convenience for skipping back to Project Selection — always
//     re-validated against the server before being trusted.
//   - screenshotDisclosureSeen: whether the VA has already been shown
//     the one-time "this app captures periodic screenshots" notice.

let storePromise: Promise<Store> | null = null;

// A failed load (e.g. the underlying JSON file is truncated or corrupted
// — a crash mid-write is the realistic cause, not tampering) must NOT be
// cached: caching a rejected promise here would leave every future call
// permanently rejecting for the rest of the process's life, since
// `storePromise` would never be reassigned again. Clearing it on failure
// lets the next call retry — by the time that happens the caller above
// has already treated this call's failure as "nothing there," so a
// following write (setActiveSessionMarker, etc.) naturally heals the
// file by overwriting whatever couldn't be read.
function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("vbph-local-state.json", { autoSave: false }).catch((err) => {
      storePromise = null;
      throw err;
    });
  }
  return storePromise;
}

// A captured screenshot's bytes live in their OWN store file, separate
// from the frequently-rewritten state above (setTask() alone would
// otherwise rewrite a multi-hundred-KB base64 blob on every keystroke's
// blur). At most one screenshot is ever pending here at a time — the one
// captured for whichever segment window hasn't rolled over yet.
let screenshotStorePromise: Promise<Store> | null = null;

function getScreenshotStore(): Promise<Store> {
  if (!screenshotStorePromise) {
    screenshotStorePromise = load("vbph-pending-screenshot.json", { autoSave: false }).catch((err) => {
      screenshotStorePromise = null;
      throw err;
    });
  }
  return screenshotStorePromise;
}

export interface ActiveSessionMarker {
  timeEntryId: string;
  placementId: string;
  serverStartTime: string;
  /** Start of the segment currently being accumulated, not yet submitted. */
  currentSegmentStart: string;
  task: string;
  /** Random target offset (ms) within the current segment window for its one screenshot. */
  screenshotOffsetMs: number;
  /** Whether the current window's screenshot has already been captured (or attempted). */
  screenshotCaptured: boolean;
  /**
   * ISO timestamp, rewritten periodically (see timerStore.ts's heartbeat)
   * while tracking is genuinely active. On relaunch this is the last
   * moment this app can actually VOUCH for — everything after it, up to
   * whenever the crash/quit actually happened, is unobserved. Recovery
   * uses it to decide how much of the gap (if any) is safe to resume
   * into, rather than assuming the VA was working the whole time.
   */
  lastSeenAt: string;
}

export type PendingOp =
  | {
      id: string;
      kind: "segment";
      createdAt: string;
      attempts: number;
      /**
       * Correlates this not-yet-created segment with a same-window
       * screenshot upload queued right after it (see offlineQueue.ts),
       * AND is the idempotency key sent to the server as-is on every
       * (re)submission of this op — see createSegment() in the web app's
       * service.ts. One id serves both purposes: it's the same value
       * either way, so there's nothing to keep in sync.
       */
      clientSegmentId: string;
      payload: {
        timeEntryId: string;
        segmentStart: string;
        segmentEnd: string;
        memo: string | null;
        keyboardActivityCount: number | null;
        mouseActivityCount: number | null;
        activityPercentage: number | null;
      };
    }
  | {
      id: string;
      kind: "stop";
      createdAt: string;
      attempts: number;
      payload: {
        timeEntryId: string;
        /** Only set by stale-session reconciliation — see timerStore.ts. Omitted, a normal Stop uses the server's own clock. */
        endedAt?: string;
      };
    }
  | {
      id: string;
      kind: "screenshot";
      createdAt: string;
      attempts: number;
      clientSegmentId: string;
      payload: {
        base64: string;
        mimeType: string;
      };
    };

export interface PendingScreenshot {
  /** Identifies which segment WINDOW this belongs to (currentSegmentStart at capture time) — not a server id, which doesn't exist yet. */
  windowStart: string;
  capturedAt: string;
  base64: string;
  mimeType: string;
}

const KEYS = {
  activeSession: "activeSession",
  pendingOps: "pendingOps",
  lastPlacementId: "lastPlacementId",
  screenshotDisclosureSeen: "screenshotDisclosureSeen",
  segmentIdMap: "segmentIdMap",
} as const;

// ── Corruption resilience ───────────────────────────────────────────────
//
// Everything below reads back data this same app wrote, through a
// well-behaved store plugin — in ordinary operation there's nothing to
// validate. This exists for the abnormal case: a crash mid-write leaves
// a truncated/partial JSON file, an older app version wrote a shape a
// migration since changed, or the file is simply gone/unreadable. None
// of that should ever crash the app or block Start/reconcile — it
// should log, fall back to "nothing was there," and let a subsequent
// write heal the file. A local, non-billing-critical convenience value
// (lastPlacementId, screenshotDisclosureSeen) failing safe as "unset" is
// harmless; getPendingOps and getActiveSessionMarker are the two where
// this actually protects real tracked-but-unsynced work from being lost
// to a hard crash instead of just a stale cache miss.

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isActiveSessionMarker(v: unknown): v is ActiveSessionMarker {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    isNonEmptyString(m.timeEntryId) &&
    isNonEmptyString(m.placementId) &&
    isNonEmptyString(m.serverStartTime) &&
    isNonEmptyString(m.currentSegmentStart) &&
    typeof m.task === "string" &&
    typeof m.screenshotOffsetMs === "number" &&
    typeof m.screenshotCaptured === "boolean" &&
    isNonEmptyString(m.lastSeenAt)
  );
}

function isPendingOp(v: unknown): v is PendingOp {
  if (typeof v !== "object" || v === null) return false;
  const op = v as Record<string, unknown>;
  if (!isNonEmptyString(op.id) || !isNonEmptyString(op.createdAt) || typeof op.attempts !== "number") {
    return false;
  }
  const payload = op.payload;
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (op.kind === "segment") {
    return (
      isNonEmptyString(op.clientSegmentId) &&
      isNonEmptyString(p.timeEntryId) &&
      isNonEmptyString(p.segmentStart) &&
      isNonEmptyString(p.segmentEnd)
    );
  }
  if (op.kind === "stop") {
    return isNonEmptyString(p.timeEntryId);
  }
  if (op.kind === "screenshot") {
    return isNonEmptyString(op.clientSegmentId) && typeof p.base64 === "string" && typeof p.mimeType === "string";
  }
  return false;
}

function isPendingScreenshot(v: unknown): v is PendingScreenshot {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isNonEmptyString(s.windowStart) &&
    isNonEmptyString(s.capturedAt) &&
    typeof s.base64 === "string" &&
    typeof s.mimeType === "string"
  );
}

function isSegmentIdMap(v: unknown): v is Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((val) => typeof val === "string");
}

/**
 * Every read in this file goes through this: never let a corrupted or
 * unreadable store take the app down, always fall back to `fallback`,
 * always log so a real recurring problem is still visible.
 */
async function readSafely<T>(key: string, getStoreFn: () => Promise<Store>, fallback: T): Promise<T> {
  try {
    const store = await getStoreFn();
    return ((await store.get<T>(key)) ?? fallback) as T;
  } catch (err) {
    console.error(`[local-store] couldn't read "${key}" — treating it as empty.`, err);
    return fallback;
  }
}

export async function getActiveSessionMarker(): Promise<ActiveSessionMarker | null> {
  const value = await readSafely<unknown>(KEYS.activeSession, getStore, null);
  if (value === null) return null;
  if (!isActiveSessionMarker(value)) {
    console.error(`[local-store] "${KEYS.activeSession}" had an unexpected shape — ignoring it.`);
    return null;
  }
  return value;
}

export async function setActiveSessionMarker(marker: ActiveSessionMarker | null): Promise<void> {
  const store = await getStore();
  if (marker) await store.set(KEYS.activeSession, marker);
  else await store.delete(KEYS.activeSession);
  await store.save();
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const value = await readSafely<unknown>(KEYS.pendingOps, getStore, []);
  if (!Array.isArray(value)) {
    console.error(`[local-store] "${KEYS.pendingOps}" had an unexpected shape — ignoring it.`);
    return [];
  }
  // Drop only the individual entries that don't look like a real
  // PendingOp, rather than discarding the whole queue over one bad
  // entry — a partial-write crash is far more likely to corrupt/truncate
  // one record than to invalidate every queued op at once.
  const valid = value.filter(isPendingOp);
  if (valid.length !== value.length) {
    console.error(
      `[local-store] dropped ${value.length - valid.length} malformed entr${value.length - valid.length === 1 ? "y" : "ies"} from "${KEYS.pendingOps}".`
    );
  }
  return valid;
}

export async function setPendingOps(ops: PendingOp[]): Promise<void> {
  const store = await getStore();
  await store.set(KEYS.pendingOps, ops);
  await store.save();
}

export async function getLastPlacementId(): Promise<string | null> {
  const value = await readSafely<unknown>(KEYS.lastPlacementId, getStore, null);
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function setLastPlacementId(placementId: string | null): Promise<void> {
  const store = await getStore();
  if (placementId) await store.set(KEYS.lastPlacementId, placementId);
  else await store.delete(KEYS.lastPlacementId);
  await store.save();
}

export async function getScreenshotDisclosureSeen(): Promise<boolean> {
  const value = await readSafely<unknown>(KEYS.screenshotDisclosureSeen, getStore, false);
  return value === true;
}

export async function setScreenshotDisclosureSeen(seen: boolean): Promise<void> {
  const store = await getStore();
  await store.set(KEYS.screenshotDisclosureSeen, seen);
  await store.save();
}

/** clientSegmentId -> real server segment id, populated once a queued "segment" op syncs. */
export async function getSegmentIdMap(): Promise<Record<string, string>> {
  const value = await readSafely<unknown>(KEYS.segmentIdMap, getStore, {});
  if (!isSegmentIdMap(value)) {
    console.error(`[local-store] "${KEYS.segmentIdMap}" had an unexpected shape — ignoring it.`);
    return {};
  }
  return value;
}

export async function setSegmentIdMap(map: Record<string, string>): Promise<void> {
  const store = await getStore();
  await store.set(KEYS.segmentIdMap, map);
  await store.save();
}

export async function getPendingScreenshot(): Promise<PendingScreenshot | null> {
  const value = await readSafely<unknown>("pending", getScreenshotStore, null);
  if (value === null) return null;
  if (!isPendingScreenshot(value)) {
    console.error(`[local-store] "pending" screenshot had an unexpected shape — ignoring it.`);
    return null;
  }
  return value;
}

export async function setPendingScreenshot(shot: PendingScreenshot | null): Promise<void> {
  const store = await getScreenshotStore();
  if (shot) await store.set("pending", shot);
  else await store.delete("pending");
  await store.save();
}
