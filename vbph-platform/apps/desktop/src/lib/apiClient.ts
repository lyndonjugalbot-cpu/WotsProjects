import { config } from "./config";
import { useAuthStore } from "./authStore";
import { markOnline, markOffline } from "./network";
import type { MyProfile, VaPlacementSummary, TimeSession, TimeSegment } from "./types";

export class ApiError extends Error {
  status: number;
  /** True when this is a network-layer failure (couldn't reach the server at all), not an HTTP error response. */
  isNetworkError: boolean;
  constructor(status: number, message: string, isNetworkError = false) {
    super(message);
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

async function request<T>(path: string, init?: RequestInit, _retried = false): Promise<T> {
  let accessToken: string;
  try {
    accessToken = await useAuthStore.getState().getAccessToken();
  } catch {
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  // A FormData body (screenshot upload) must NOT get an explicit
  // Content-Type — fetch sets its own multipart boundary automatically,
  // and overriding it here would drop the boundary parameter and break
  // the server's form parsing.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    });
  } catch {
    markOffline();
    throw new ApiError(0, "Couldn't reach the server. Check your internet connection.", true);
  }

  markOnline();

  if (res.status === 401 && !_retried) {
    // The access token could have gone stale between getAccessToken()'s
    // own check and the request actually landing (clock skew, or a token
    // revoked server-side mid-session) — force one real refresh and retry
    // exactly once before treating this as a dead session.
    try {
      await useAuthStore.getState().getAccessToken();
    } catch {
      // fall through to logout below
    }
    return request<T>(path, init, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    if (res.status === 401) {
      await useAuthStore.getState().logout("Your session has expired. Please sign in again.");
    }
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const timeApi = {
  me: () => request<MyProfile>("/api/time/me"),

  activePlacements: () => request<{ placements: VaPlacementSummary[] }>("/api/time/placements"),

  activeSessions: () => request<{ sessions: TimeSession[] }>("/api/time/entries/active"),

  startTimer: (placementId: string) =>
    request<TimeSession>("/api/time/entries", {
      method: "POST",
      body: JSON.stringify({ placementId }),
    }),

  stopTimer: (timeEntryId: string, endedAt?: string) =>
    request<TimeSession>(`/api/time/entries/${timeEntryId}/stop`, {
      method: "PATCH",
      // endedAt is only ever set by stale-session reconciliation (see
      // timerStore.ts) — a normal Stop click omits it and JSON.stringify
      // drops the undefined key, giving the server no body, same as before.
      body: JSON.stringify({ endedAt }),
    }),

  createSegment: (input: {
    timeEntryId: string;
    // Client-generated idempotency key — see createSegmentSchema and
    // createSegment() in the web app's service.ts. Required so a retried
    // offline-queue op (this exact segment, resent because the app never
    // confirmed the original response) lands on the same server row
    // instead of creating a duplicate.
    clientSegmentId: string;
    segmentStart: string;
    segmentEnd: string;
    memo: string | null;
    keyboardActivityCount?: number | null;
    mouseActivityCount?: number | null;
    activityPercentage?: number | null;
  }) => {
    // createSegmentSchema's memo field is `z.string().optional()` —
    // omittable, but NOT `.nullable()`. Sending an explicit `memo: null`
    // fails validation ("expected string, received null"); JSON.stringify
    // drops keys whose value is `undefined`, so converting null → undefined
    // here is what actually omits the field from the request body. The
    // three activity fields are the opposite — `.nullable().optional()` —
    // so `null` (monitoring wasn't available for this window) is valid
    // and distinct from omitting them entirely.
    const { memo, ...rest } = input;
    const body = memo === null ? rest : input;
    return request<TimeSegment>("/api/time/segments", { method: "POST", body: JSON.stringify(body) });
  },

  uploadScreenshot: (segmentId: string, base64: string, mimeType: string) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const form = new FormData();
    form.set("file", new Blob([bytes], { type: mimeType }), `screenshot.${extension}`);
    return request<{ screenshotId: string; screenshotUrl: string }>(
      `/api/time/segments/${segmentId}/screenshot`,
      { method: "POST", body: form }
    );
  },

  diary: (startDate: string, endDate: string) =>
    request<{ sessions: TimeSession[] }>(
      `/api/time/diary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    ),
};
