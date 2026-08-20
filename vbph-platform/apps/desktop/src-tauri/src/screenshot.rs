//! Screen capture for the periodic work-diary screenshot. Captures the
//! OS-designated PRIMARY display only (see docs/database.md for the
//! recommendation this implements) — not every connected monitor.
//!
//! Compression: downscaled to a max dimension of 1920px (screenshots of
//! desktop/text content stay readable well below their native
//! resolution — a 5K display's screenshot doesn't need to ship at 5K to
//! verify what was on screen) and re-encoded as JPEG at a fixed quality
//! chosen to keep text legible while controlling upload/storage size.

use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, ImageEncoder, imageops::FilterType};
use xcap::Monitor;

const MAX_DIMENSION: u32 = 1920;
const JPEG_QUALITY: u8 = 75;

#[derive(serde::Serialize)]
pub struct CapturedScreenshot {
    pub base64: String,
    pub width: u32,
    pub height: u32,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
}

fn primary_monitor() -> Result<Monitor, String> {
    let monitors = Monitor::all().map_err(|e| format!("Couldn't list displays: {e}"))?;
    if monitors.is_empty() {
        return Err("No display found to capture.".to_string());
    }
    Ok(monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .cloned()
        .unwrap_or_else(|| monitors[0].clone()))
}

/// A cheap heuristic for "Screen Recording permission isn't actually
/// granted." On macOS, xcap's monitor capture goes through the legacy
/// `CGWindowListCreateImage` API (see xcap's src/macos/capture.rs) —
/// which, unlike most permission-gated APIs, does NOT return an error
/// when access hasn't been granted. It silently returns a fully (or
/// near-fully) black image instead. Sampling a spread of pixels and
/// checking they're all essentially black catches this reliably without
/// scanning every pixel of a multi-megapixel capture. A real desktop
/// that happens to be nearly all black is possible but rare enough that
/// treating this as "probably a permission problem" and letting the
/// caller decide what to do about it is the right tradeoff — silently
/// uploading a useless black rectangle as "evidence of work" would be
/// worse than flagging it.
fn looks_permission_blocked(image: &image::RgbaImage) -> bool {
    let (w, h) = (image.width(), image.height());
    if w == 0 || h == 0 {
        return true;
    }
    let samples = 400;
    let mut non_black = 0u32;
    for i in 0..samples {
        let x = (i * 37) % w;
        let y = (i * 53) % h;
        let px = image.get_pixel(x, y);
        if px.0[0] > 8 || px.0[1] > 8 || px.0[2] > 8 {
            non_black += 1;
        }
    }
    non_black == 0
}

#[tauri::command]
pub fn capture_screenshot() -> Result<CapturedScreenshot, String> {
    let monitor = primary_monitor()?;
    let raw = monitor
        .capture_image()
        .map_err(|e| format!("CAPTURE_FAILED: {e}"))?;

    #[cfg(target_os = "macos")]
    {
        if looks_permission_blocked(&raw) {
            return Err("PERMISSION_DENIED".to_string());
        }
    }

    let dynamic = DynamicImage::ImageRgba8(raw);
    let resized = if dynamic.width() > MAX_DIMENSION || dynamic.height() > MAX_DIMENSION {
        dynamic.resize(MAX_DIMENSION, MAX_DIMENSION, FilterType::Lanczos3)
    } else {
        dynamic
    };
    let rgb = resized.to_rgb8();
    let (width, height) = (rgb.width(), rgb.height());

    let mut buf: Vec<u8> = Vec::new();
    JpegEncoder::new_with_quality(&mut buf, JPEG_QUALITY)
        .write_image(&rgb, width, height, image::ExtendedColorType::Rgb8)
        .map_err(|e| format!("Couldn't encode screenshot: {e}"))?;

    Ok(CapturedScreenshot {
        base64: base64::engine::general_purpose::STANDARD.encode(&buf),
        width,
        height,
        mime_type: "image/jpeg".to_string(),
    })
}

/// Checked WITHOUT triggering the system permission prompt — used to
/// decide whether to show an in-app "you'll need to grant Screen
/// Recording access" notice before ever attempting a capture. Always
/// `true` on platforms that don't gate screen capture behind a runtime
/// permission (Windows' GDI-based capture path here needs none — see
/// docs/database.md).
#[tauri::command]
pub fn has_screen_recording_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        objc2_core_graphics::CGPreflightScreenCaptureAccess()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Triggers the OS's own permission prompt if the VA has never been
/// asked before (a no-op if already granted OR already permanently
/// denied — macOS only asks once per app, after that the user must go
/// to System Settings themselves, which is what
/// open_screen_recording_settings is for).
#[tauri::command]
pub fn request_screen_recording_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        objc2_core_graphics::CGRequestScreenCaptureAccess()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Deep-links straight to the Screen Recording pane of System Settings —
/// the only way to grant this permission after the one automatic prompt
/// has already been dismissed/denied once.
#[tauri::command]
pub fn open_screen_recording_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn()
            .map_err(|e| format!("Couldn't open System Settings: {e}"))?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    #[test]
    fn preflight_permission_check_does_not_panic() {
        let granted = has_screen_recording_permission();
        println!("has_screen_recording_permission() = {granted}");
    }

    /// A real end-to-end capture against whatever display(s) this
    /// machine actually has — not mocked. In a sandbox with no attached
    /// display or without Screen Recording granted, this is EXPECTED to
    /// fail or hit the permission heuristic; both are asserted to fail
    /// in a specific, recognizable way rather than silently succeeding
    /// with garbage, which is what actually matters here.
    #[test]
    fn capture_screenshot_produces_valid_bounded_jpeg_or_a_recognizable_error() {
        match capture_screenshot() {
            Ok(shot) => {
                assert_eq!(shot.mime_type, "image/jpeg");
                assert!(shot.width <= MAX_DIMENSION, "width {} exceeds cap", shot.width);
                assert!(shot.height <= MAX_DIMENSION, "height {} exceeds cap", shot.height);
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(&shot.base64)
                    .expect("base64 must decode");
                assert!(bytes.len() > 100, "JPEG suspiciously small: {} bytes", bytes.len());
                // JPEG magic bytes (SOI marker).
                assert_eq!(&bytes[0..2], &[0xFF, 0xD8], "not a JPEG (missing SOI marker)");
                println!(
                    "captured {}x{} JPEG, {} bytes ({} monitor(s) detected)",
                    shot.width,
                    shot.height,
                    bytes.len(),
                    Monitor::all().map(|m| m.len()).unwrap_or(0)
                );
            }
            Err(e) => {
                println!("capture_screenshot() failed (expected in a sandbox with no real display/permission): {e}");
                assert!(
                    e == "PERMISSION_DENIED" || e.starts_with("CAPTURE_FAILED") || e.contains("display"),
                    "unexpected error shape: {e}"
                );
            }
        }
    }
}
