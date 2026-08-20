import { config } from "./config";

// Direct calls to Supabase's own Auth REST API — the same
// signInWithPassword/refresh flow the supabase-js SDK wraps, called here
// with a plain fetch instead of pulling in the whole SDK (this app never
// touches Supabase tables directly; everything past login goes through
// apps/web's own /api/time/* endpoints — see apiClient.ts). Only the
// public anon key is used, exactly as documented in
// apps/web/src/lib/api/auth.ts: "the desktop app authenticates directly
// against Supabase Auth ... and sends the resulting access token on
// every request."

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

export class AuthApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  error?: string;
  error_description?: string;
  msg?: string;
}

async function tokenRequest(grantType: "password" | "refresh_token", body: object): Promise<AuthTokens> {
  let res: Response;
  try {
    res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=${grantType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError(0, "Couldn't reach the server. Check your internet connection and try again.");
  }

  const data = (await res.json().catch(() => ({}))) as SupabaseTokenResponse;

  if (!res.ok) {
    const message = data.error_description ?? data.msg ?? "Invalid email or password.";
    throw new AuthApiError(res.status, message);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
}

export function signInWithPassword(email: string, password: string): Promise<AuthTokens> {
  return tokenRequest("password", { email, password });
}

export function refreshSession(refreshToken: string): Promise<AuthTokens> {
  return tokenRequest("refresh_token", { refresh_token: refreshToken });
}
