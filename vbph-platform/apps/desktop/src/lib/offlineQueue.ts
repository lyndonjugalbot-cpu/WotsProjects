import { getPendingOps, setPendingOps, getSegmentIdMap, setSegmentIdMap, type PendingOp } from "./localStore";
import { timeApi, ApiError } from "./apiClient";

// The "local-safe recovery for unsynced timer data" requirement, in one
// place: every segment (and the final stop-of-timer call) is written to
// this queue FIRST, then flushed to the server. If the process is killed
// mid-flush, or the network drops, whatever hasn't been confirmed
// synced is still sitting in the local store (see localStore.ts) and
// gets retried on the next flush — nothing is only ever held in memory.
//
// A network failure leaves an op in the queue untouched and stops the
// flush right there (preserves ordering — a later segment shouldn't sync
// before an earlier one). A genuine server rejection (4xx: the entry
// doesn't exist / bounds violation / etc.) can never succeed by retrying
// the same payload, so that op is dropped after logging — otherwise a
// single bad op would wedge the queue forever and silently block every
// segment after it too.

// Serializes EVERY read-modify-write of the pending-ops file — both
// enqueue()'s append and flush()'s per-item removal go through this same
// lock. This matters beyond simple double-enqueue races: without it, a
// segment enqueued WHILE flush() is mid-submission (e.g. a rollover tick
// firing during stop()'s own flush) would be invisible to that flush()
// call's already-in-flight read, and when that call finished and wrote
// its own (now-stale) view back, it would silently erase the
// just-enqueued op from the file — an op the caller believes is safely
// queued, gone without ever syncing or remaining queued for retry. Each
// operation here reads fresh state and writes back only after acquiring
// the lock, so a write can never be based on data another write has
// since superseded.
let writeLock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeLock.then(fn);
  writeLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const listeners = new Set<(ops: PendingOp[]) => void>();

export function onQueueChange(cb: (ops: PendingOp[]) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function notify(ops: PendingOp[]) {
  for (const cb of listeners) cb(ops);
}

// Plain `Omit<PendingOp, ...>` collapses PendingOp's discriminated union
// down to only its shared keys (Omit computes `keyof` over the whole
// union first, which is the INTERSECTION of each member's keys) — every
// call site would lose the "kind decides which payload shape" checking
// it exists for. Distributing Omit over each union member individually
// keeps it discriminated.
type DistributiveOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never;

export async function enqueue(op: DistributiveOmit<PendingOp, "id" | "createdAt" | "attempts">): Promise<void> {
  await withLock(async () => {
    const ops = await getPendingOps();
    const withId = { ...op, id: crypto.randomUUID(), createdAt: new Date().toISOString(), attempts: 0 } as PendingOp;
    const next = [...ops, withId];
    await setPendingOps(next);
    await notify(next);
  });
  void flush();
}

export async function peekQueueSize(): Promise<number> {
  return (await getPendingOps()).length;
}

/**
 * A "screenshot" op is enqueued for a segment that doesn't have a real
 * server id yet — segments and their screenshots are always enqueued as
 * a pair, segment first (see timerStore.ts) — so it carries the SAME
 * `clientSegmentId` the segment op was tagged with instead. Because
 * runFlush() processes ops strictly one at a time, in order, and never
 * advances past a "retry-later" result, by the time a screenshot op's
 * turn comes its paired segment op has unconditionally already been
 * resolved: synced (this map has its real id) or dropped (it never
 * will, and this screenshot has nothing to attach to either).
 */
async function resolveSegmentId(clientSegmentId: string): Promise<string | undefined> {
  const map = await getSegmentIdMap();
  return map[clientSegmentId];
}

async function rememberSegmentId(clientSegmentId: string, realSegmentId: string): Promise<void> {
  await withLock(async () => {
    const map = await getSegmentIdMap();
    await setSegmentIdMap({ ...map, [clientSegmentId]: realSegmentId });
  });
}

async function forgetSegmentId(clientSegmentId: string): Promise<void> {
  await withLock(async () => {
    const map = await getSegmentIdMap();
    if (!(clientSegmentId in map)) return;
    const next = { ...map };
    delete next[clientSegmentId];
    await setSegmentIdMap(next);
  });
}

async function submitOne(op: PendingOp): Promise<"synced" | "dropped" | "retry-later"> {
  try {
    if (op.kind === "segment") {
      // clientSegmentId travels with the op at the top level (also used
      // for local screenshot correlation, see resolveSegmentId above) —
      // sent through unchanged on every attempt, including retries, so
      // the server can recognize a resend as the SAME segment.
      const segment = await timeApi.createSegment({ ...op.payload, clientSegmentId: op.clientSegmentId });
      await rememberSegmentId(op.clientSegmentId, segment.id);
    } else if (op.kind === "stop") {
      await timeApi.stopTimer(op.payload.timeEntryId, op.payload.endedAt);
    } else {
      const realSegmentId = await resolveSegmentId(op.clientSegmentId);
      if (!realSegmentId) {
        console.error(
          `[offline-queue] dropping screenshot op ${op.id} — its segment (${op.clientSegmentId}) never synced.`
        );
        return "dropped";
      }
      await timeApi.uploadScreenshot(realSegmentId, op.payload.base64, op.payload.mimeType);
      await forgetSegmentId(op.clientSegmentId);
    }
    return "synced";
  } catch (err) {
    if (err instanceof ApiError && (err.isNetworkError || err.status === 401)) {
      // A network failure obviously can't be blamed on the op itself.
      // Neither can a 401 here: apiClient already retries a genuinely
      // stale access token once internally, so a 401 surfacing all the
      // way up means either that race window was hit anyway, or the VA
      // signed out from underneath an in-flight flush — not that the
      // server looked at this op and rejected it. Both are transient
      // from the op's point of view: worth retrying once a valid
      // session exists again, not a reason to permanently lose tracked
      // time.
      return "retry-later";
    }
    console.error(`[offline-queue] dropping ${op.kind} op ${op.id} — server rejected it:`, err);
    return "dropped";
  }
}

let flushPromise: Promise<void> | null = null;

/**
 * Coalesces concurrent callers onto ONE in-flight run rather than the
 * common `if (running) return` pattern, which would let a caller that
 * explicitly awaits flush() (stop(), for instance) resolve while a
 * flush triggered moments earlier by enqueue()'s fire-and-forget call
 * was still actually running in the background — observed directly
 * while testing: stop()'s caller believed the queue had been given a
 * chance to sync and moved on (e.g. signing out), while the real flush
 * was still mid-flight and then failed once the session it depended on
 * was gone. Every caller now genuinely waits for the SAME run to finish.
 */
export function flush(): Promise<void> {
  if (!flushPromise) {
    flushPromise = runFlush().finally(() => {
      flushPromise = null;
    });
  }
  return flushPromise;
}

async function runFlush(): Promise<void> {
  for (;;) {
    // Fresh read every iteration — never a stale snapshot carried across
    // an await boundary — so an op enqueued while the previous
    // iteration's submitOne() was in flight is still there to see.
    const ops = await getPendingOps();
    const head = ops[0];
    if (!head) return;

    const result = await submitOne(head);

    if (result === "retry-later") {
      // Leave the queue untouched — preserves ordering, retried on the
      // next flush() call — and stop rather than spin on the same
      // failure.
      return;
    }

    // "synced" or "dropped" both remove it — by id, against a FRESH
    // read taken under the lock, not the `ops` snapshot from above,
    // which could already be stale by now.
    await withLock(async () => {
      const current = await getPendingOps();
      const next = current.filter((o) => o.id !== head.id);
      await setPendingOps(next);
      await notify(next);
    });
  }
}

let backgroundSyncStarted = false;

/**
 * Retries the queue on two independent signals: the browser's `online`
 * event (fast, when it fires) and a 30s poll (a backstop — the Tauri
 * webview's connectivity events aren't always reliable, and a poll also
 * naturally recovers from "online per navigator.onLine but the actual
 * path to the server was down," which markOffline() alone can detect
 * only once a real request is attempted). Call once, after sign-in.
 */
export function startBackgroundSync(): () => void {
  if (backgroundSyncStarted) return () => {};
  backgroundSyncStarted = true;

  const onOnline = () => void flush();
  window.addEventListener("online", onOnline);
  const interval = setInterval(() => void flush(), 30_000);
  void flush();

  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
    backgroundSyncStarted = false;
  };
}
