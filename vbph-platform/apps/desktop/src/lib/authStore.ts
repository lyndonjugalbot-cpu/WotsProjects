import { create } from "zustand";
import { config } from "./config";
import { signInWithPassword, refreshSession, AuthApiError, type AuthTokens } from "./supabaseAuth";
import { saveStoredSession, loadStoredSession, clearStoredSession } from "./secureStore";
import type { MyProfile } from "./types";

// "checking" — bootstrapping on app launch, nothing to show yet.
// "signed-out" — no valid session; show Login (optionally with a reason,
//   e.g. "Your session expired").
// "offline-locked" — a stored session exists but couldn't be verified
//   because the network is unreachable right now (NOT an invalid
//   session — don't discard it). Distinct screen: "You're offline,"
//   with Retry, rather than forcing a re-login for something that isn't
//   a credentials problem.
// "signed-in" — accessToken/profile are populated and usable.
export type AuthStatus = "checking" | "signed-out" | "offline-locked" | "signed-in";

interface AuthState {
  status: AuthStatus;
  profile: MyProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Unix seconds. */
  expiresAt: number | null;
  /** Kept only to re-persist alongside a rotated refresh token — never sent anywhere. */
  email: string | null;
  errorMessage: string | null;
  loginPending: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: string) => Promise<void>;
  /** Always returns a currently-valid access token, refreshing first if needed. Throws if the session is dead. */
  getAccessToken: () => Promise<string>;
}

const REFRESH_SKEW_SECONDS = 60;

async function fetchMe(accessToken: string): Promise<MyProfile> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}/api/time/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new AuthApiError(0, "Couldn't reach the server.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AuthApiError(res.status, body.error ?? "Couldn't verify this session.");
  }
  return res.json();
}

function applyTokens(set: (partial: Partial<AuthState>) => void, tokens: AuthTokens) {
  set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  profile: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  email: null,
  errorMessage: null,
  loginPending: false,

  async bootstrap() {
    const stored = await loadStoredSession();
    if (!stored) {
      set({ status: "signed-out" });
      return;
    }

    try {
      const tokens = await refreshSession(stored.refreshToken);
      applyTokens(set, tokens);
      set({ email: stored.email });
      // Supabase rotates the refresh token on every use — persist the new one immediately.
      await saveStoredSession({ refreshToken: tokens.refreshToken, vaId: stored.vaId, email: stored.email });

      const profile = await fetchMe(tokens.accessToken);
      if (profile.role !== "VA") {
        await clearStoredSession();
        set({ status: "signed-out", errorMessage: "This app is for Virtual Assistants only.", accessToken: null, refreshToken: null, profile: null });
        return;
      }
      if (profile.status === "suspended") {
        await clearStoredSession();
        set({ status: "signed-out", errorMessage: "This account has been suspended.", accessToken: null, refreshToken: null, profile: null });
        return;
      }

      set({ status: "signed-in", profile, errorMessage: null });
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 0) {
        // Network unreachable — the stored session might still be perfectly
        // valid. Don't sign out; let the user retry once they're back online.
        set({ status: "offline-locked" });
        return;
      }
      // Any real rejection (refresh token expired/revoked, account gone) —
      // the stored session is genuinely dead. Clear it so this doesn't loop.
      await clearStoredSession();
      set({
        status: "signed-out",
        errorMessage: "Your session expired. Please sign in again.",
        accessToken: null,
        refreshToken: null,
        profile: null,
      });
    }
  },

  async login(email, password) {
    set({ loginPending: true, errorMessage: null });
    try {
      const tokens = await signInWithPassword(email, password);
      const profile = await fetchMe(tokens.accessToken);

      if (profile.role !== "VA") {
        set({ loginPending: false, errorMessage: "This app is for Virtual Assistants only." });
        return;
      }
      if (profile.status === "suspended") {
        set({ loginPending: false, errorMessage: "This account has been suspended." });
        return;
      }

      await saveStoredSession({ refreshToken: tokens.refreshToken, vaId: profile.id, email });
      applyTokens(set, tokens);
      set({ status: "signed-in", profile, email, loginPending: false, errorMessage: null });
    } catch (err) {
      const message = err instanceof AuthApiError ? err.message : "Couldn't sign in. Please try again.";
      set({ loginPending: false, errorMessage: message });
    }
  },

  async logout(reason) {
    await clearStoredSession();
    set({
      status: "signed-out",
      profile: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      errorMessage: reason ?? null,
    });
  },

  async getAccessToken() {
    const { accessToken, refreshToken, expiresAt, profile, email } = get();
    const nowSeconds = Date.now() / 1000;

    if (accessToken && expiresAt && expiresAt - nowSeconds > REFRESH_SKEW_SECONDS) {
      return accessToken;
    }
    if (!refreshToken) {
      throw new AuthApiError(401, "Not signed in.");
    }

    try {
      const tokens = await refreshSession(refreshToken);
      applyTokens(set, tokens);
      if (profile) {
        await saveStoredSession({ refreshToken: tokens.refreshToken, vaId: profile.id, email: email ?? "" }).catch(() => {});
      }
      return tokens.accessToken;
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 0) {
        // Offline: the old access token may still have a few seconds of
        // life left server-side even past our own skew margin — hand it
        // back rather than failing outright, so an in-flight request can
        // still try. If it's truly expired the request will 401 and the
        // caller (apiClient) treats that as a hard sign-out.
        if (accessToken) return accessToken;
        throw err;
      }
      await get().logout("Your session expired. Please sign in again.");
      throw err;
    }
  },
}));
