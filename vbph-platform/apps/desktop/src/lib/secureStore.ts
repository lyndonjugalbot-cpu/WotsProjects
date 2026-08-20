import { invoke } from "@tauri-apps/api/core";

// Thin wrapper around the Rust `secure_store_*` commands (src-tauri/src/secure_store.rs),
// which persist a single opaque string in the OS's real credential store
// (Keychain/Credential Manager/Secret Service) — never a plaintext file
// on disk. This is the only thing that survives an app restart on its
// own; everything else in this app is re-derived from the server or from
// the non-secret local store (see localStore.ts).

export interface StoredSession {
  refreshToken: string;
  vaId: string;
  email: string;
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  await invoke("secure_store_save", { value: JSON.stringify(session) });
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const raw = await invoke<string | null>("secure_store_load");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.refreshToken === "string" && typeof parsed?.vaId === "string") {
      return parsed as StoredSession;
    }
    return null;
  } catch {
    // Corrupt/unexpected content in the keychain entry — treat exactly
    // like "no session" rather than throwing and blocking app startup.
    return null;
  }
}

export async function clearStoredSession(): Promise<void> {
  await invoke("secure_store_clear");
}
