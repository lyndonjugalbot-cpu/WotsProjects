//! A single JSON blob in the OS's own secure credential store (macOS
//! Keychain / Windows Credential Manager / Linux Secret Service via the
//! `keyring` crate) — never a plaintext file. This is the ONLY place the
//! VA's Supabase refresh token is persisted between app launches; the
//! short-lived access token is never written to disk at all (see
//! src/lib/auth.ts on the frontend side).
//!
//! The value stored is an opaque string as far as this module is
//! concerned — the frontend decides its shape (currently a JSON object
//! with refreshToken/vaId/email). Keeping this module dumb-string-in,
//! dumb-string-out avoids needing to keep a Rust struct in sync with a
//! TypeScript one for something that's never inspected on this side.

use keyring::Entry;

const SERVICE: &str = "com.virtualbridgeph.timetracker";
const ACCOUNT: &str = "va-session";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

pub fn save(value: &str) -> Result<(), String> {
    entry()?.set_password(value).map_err(|e| e.to_string())
}

pub fn load() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secure_store_save(value: String) -> Result<(), String> {
    save(&value)
}

#[tauri::command]
pub fn secure_store_load() -> Result<Option<String>, String> {
    load()
}

#[tauri::command]
pub fn secure_store_clear() -> Result<(), String> {
    clear()
}

#[cfg(test)]
mod tests {
    use super::*;

    // A real round trip through the OS keychain (not a mock) — this is
    // exactly the code path the app calls on login/bootstrap/logout, and
    // it's the one thing in this app that would be dishonest to fake:
    // whether a secret actually persists in and clears from the real
    // platform credential store. Uses the same ACCOUNT the app uses
    // (this is a single-account desktop app), so run serially — a
    // parallel run of these two tests would race on the same entry.
    #[test]
    fn round_trips_through_the_real_os_keychain() {
        clear().expect("clear should succeed even with no prior entry");
        assert_eq!(load().unwrap(), None);

        save("test-value-123").expect("save should succeed");
        assert_eq!(load().unwrap(), Some("test-value-123".to_string()));

        save("test-value-456").expect("save should overwrite");
        assert_eq!(load().unwrap(), Some("test-value-456".to_string()));

        clear().expect("clear should succeed");
        assert_eq!(load().unwrap(), None);

        // Clearing an already-empty entry is a no-op, not an error.
        clear().expect("clearing twice should still succeed");
    }
}
