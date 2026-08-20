import { invoke } from "@tauri-apps/api/core";

// Thin wrapper around the Rust activity-monitoring commands
// (src-tauri/src/activity.rs). All actual keyboard/mouse polling and
// counting happens there — this module never sees a key code, a mouse
// coordinate, or anything else beyond the four aggregate numbers below.

export interface ActivitySnapshot {
  keyboardCount: number;
  mouseClickCount: number;
  mouseMovementCount: number;
  activeSecondsCount: number;
}

export class ActivityMonitorPermissionError extends Error {
  constructor() {
    super("Accessibility permission is required to measure activity.");
  }
}

/** Starts polling, if not already running. */
export async function startActivityMonitoring(): Promise<void> {
  try {
    await invoke("start_activity_monitoring");
  } catch (err) {
    if (err === "ACCESSIBILITY_PERMISSION_REQUIRED") {
      throw new ActivityMonitorPermissionError();
    }
    throw err;
  }
}

/** Stops polling immediately — no further system input state is touched until the next start. */
export function stopActivityMonitoring(): Promise<void> {
  return invoke<void>("stop_activity_monitoring");
}

/** Reads the current segment window's counts and resets them for the next window, atomically. */
export function getAndResetActivity(): Promise<ActivitySnapshot> {
  return invoke<ActivitySnapshot>("get_and_reset_activity");
}

/** Checked WITHOUT prompting — advisory only, see screenshotCapture.ts for why this is never gated on proactively. */
export function hasAccessibilityPermission(): Promise<boolean> {
  return invoke<boolean>("has_accessibility_permission");
}

/** Triggers the OS's one-time permission prompt, if the VA hasn't been asked before. */
export function requestAccessibilityPermission(): Promise<boolean> {
  return invoke<boolean>("request_accessibility_permission");
}

/** Deep-links to the Accessibility pane of System Settings (macOS only; a no-op elsewhere). */
export function openAccessibilitySettings(): Promise<void> {
  return invoke<void>("open_accessibility_settings");
}
