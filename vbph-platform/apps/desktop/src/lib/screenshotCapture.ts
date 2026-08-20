import { invoke } from "@tauri-apps/api/core";

// Thin wrapper around the Rust screenshot commands (src-tauri/src/screenshot.rs).
// All actual OS-level capture logic lives there — this module never
// touches the display itself.

export interface CapturedScreenshot {
  base64: string;
  width: number;
  height: number;
  mimeType: string;
}

export class ScreenCapturePermissionError extends Error {
  constructor() {
    super("Screen Recording permission is required to capture screenshots.");
  }
}

/** Captures the primary display, downscaled and JPEG-compressed on the Rust side. */
export async function captureScreenshot(): Promise<CapturedScreenshot> {
  try {
    return await invoke<CapturedScreenshot>("capture_screenshot");
  } catch (err) {
    if (err === "PERMISSION_DENIED") {
      throw new ScreenCapturePermissionError();
    }
    throw err;
  }
}

/** Checked WITHOUT prompting — true on platforms/states where capture will actually work. */
export function hasScreenRecordingPermission(): Promise<boolean> {
  return invoke<boolean>("has_screen_recording_permission");
}

/** Triggers the OS's one-time permission prompt, if the VA hasn't been asked before. */
export function requestScreenRecordingPermission(): Promise<boolean> {
  return invoke<boolean>("request_screen_recording_permission");
}

/** Deep-links to the OS privacy settings pane for this permission (macOS only; a no-op elsewhere). */
export function openScreenRecordingSettings(): Promise<void> {
  return invoke<void>("open_screen_recording_settings");
}
