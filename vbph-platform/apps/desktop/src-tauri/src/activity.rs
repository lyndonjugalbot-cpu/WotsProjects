//! Privacy-conscious aggregate activity monitoring while the timer is
//! running. This module NEVER records which keys were pressed, typed
//! text, passwords, clipboard content, or specific clicked UI elements —
//! it only ever counts. See `poll_tick` for exactly what crosses out of
//! this module: three numbers per poll (new key presses, new clicks,
//! whether the mouse moved), nothing else. The transient key/mouse state
//! used to compute those numbers lives only in local variables inside
//! the polling loop and is overwritten every ~100ms — never logged,
//! never persisted, never sent anywhere.
//!
//! Deliberately POLLING (device_query's `get_keys`/`get_mouse`, point-in-
//! time OS queries), not an installed global event hook/tap. That choice
//! is what makes "must completely stop when the timer stops" a real,
//! verifiable guarantee rather than an event callback that's merely told
//! to go quiet: stopping this monitor means the polling thread exits and
//! nothing in this app touches system input state again until the next
//! Start — there is no persistent hook left registered with the OS in
//! between.

use device_query::{DeviceQuery, DeviceState, Keycode, MouseState};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const POLL_INTERVAL: Duration = Duration::from_millis(100);
// Ignores sub-pixel jitter some mice/trackpads report even at rest, so
// "moved" reflects an actual, intentional mouse movement.
const MOVEMENT_THRESHOLD_PX: i32 = 3;

#[derive(Default)]
struct Counters {
    keyboard_count: u64,
    mouse_click_count: u64,
    mouse_movement_count: u64,
    /// Unix-epoch seconds in which ANY activity (keyboard, click, or
    /// movement) was observed — the raw material for the activity
    /// percentage, computed on the TypeScript side once a segment's
    /// actual duration is known. See docs/database.md for the exact
    /// formula.
    active_seconds: HashSet<u64>,
}

struct RunningMonitor {
    stop_flag: Arc<AtomicBool>,
    counters: Arc<Mutex<Counters>>,
}

#[derive(Default)]
pub struct ActivityMonitorState(Mutex<Option<RunningMonitor>>);

#[derive(serde::Serialize)]
pub struct ActivitySnapshot {
    #[serde(rename = "keyboardCount")]
    pub keyboard_count: u64,
    #[serde(rename = "mouseClickCount")]
    pub mouse_click_count: u64,
    #[serde(rename = "mouseMovementCount")]
    pub mouse_movement_count: u64,
    #[serde(rename = "activeSecondsCount")]
    pub active_seconds_count: u64,
}

fn now_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// One poll: compares the current keyboard/mouse snapshot against the
/// previous one and returns ONLY counts — (new key presses this tick,
/// new button presses this tick, whether the mouse moved past the noise
/// threshold). The actual key codes and cursor coordinates used to
/// compute this never leave this function.
fn poll_tick(
    device_state: &DeviceState,
    prev_keys: &mut HashSet<Keycode>,
    prev_mouse: &mut Option<MouseState>,
) -> (u64, u64, bool) {
    let keys_now: HashSet<Keycode> = device_state.get_keys().into_iter().collect();
    let mouse_now = device_state.get_mouse();

    let new_key_presses = keys_now.difference(prev_keys).count() as u64;

    let mut new_clicks = 0u64;
    let mut moved = false;
    if let Some(prev) = prev_mouse {
        let len = mouse_now.button_pressed.len().min(prev.button_pressed.len());
        for i in 0..len {
            if mouse_now.button_pressed[i] && !prev.button_pressed[i] {
                new_clicks += 1;
            }
        }
        let dx = (mouse_now.coords.0 - prev.coords.0).abs();
        let dy = (mouse_now.coords.1 - prev.coords.1).abs();
        moved = dx > MOVEMENT_THRESHOLD_PX || dy > MOVEMENT_THRESHOLD_PX;
    }

    *prev_keys = keys_now;
    *prev_mouse = Some(mouse_now);

    (new_key_presses, new_clicks, moved)
}

fn poll_loop(stop_flag: Arc<AtomicBool>, counters: Arc<Mutex<Counters>>, device_state: DeviceState) {
    let mut prev_keys: HashSet<Keycode> = HashSet::new();
    let mut prev_mouse: Option<MouseState> = None;

    while !stop_flag.load(Ordering::Relaxed) {
        let (new_key_presses, new_clicks, moved) = poll_tick(&device_state, &mut prev_keys, &mut prev_mouse);

        if new_key_presses > 0 || new_clicks > 0 || moved {
            if let Ok(mut c) = counters.lock() {
                c.keyboard_count += new_key_presses;
                c.mouse_click_count += new_clicks;
                if moved {
                    c.mouse_movement_count += 1;
                }
                c.active_seconds.insert(now_epoch_secs());
            }
        }

        thread::sleep(POLL_INTERVAL);
    }
}

// Plain functions taking `&ActivityMonitorState` (not the Tauri-specific
// `tauri::State<T>` wrapper) hold all the actual logic — this lets tests
// construct an `ActivityMonitorState` directly and exercise start/stop/
// snapshot behavior without spinning up a full Tauri runtime. The
// `#[tauri::command]` functions below are thin wrappers.

/// Starts polling, if not already running — idempotent, matching
/// startTimer()'s own idempotency. Fails with a specific, matchable
/// sentinel if the OS-level permission this needs (Accessibility, on
/// macOS only — see has_accessibility_permission) isn't granted, rather
/// than ever silently doing nothing or crashing: device_query's own
/// unchecked constructor PANICS without this permission, which is
/// exactly why `checked_new()` is used here instead.
fn start_monitoring(state: &ActivityMonitorState) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "activity monitor state poisoned".to_string())?;
    if guard.is_some() {
        return Ok(());
    }

    let device_state = DeviceState::checked_new().ok_or_else(|| "ACCESSIBILITY_PERMISSION_REQUIRED".to_string())?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    let counters = Arc::new(Mutex::new(Counters::default()));

    let thread_stop = stop_flag.clone();
    let thread_counters = counters.clone();
    thread::spawn(move || poll_loop(thread_stop, thread_counters, device_state));

    *guard = Some(RunningMonitor { stop_flag, counters });
    Ok(())
}

/// Signals the polling thread to stop and immediately forgets it —
/// idempotent (a no-op if nothing was running). Not joined: the thread
/// observes the flag and exits within one POLL_INTERVAL (100ms) on its
/// own, and the caller doesn't need to wait for that to know monitoring
/// has been told to stop. Called from the timer's own stop() path AND
/// from the sign-out guard, so activity tracking stops exactly when
/// screenshot capture does — see timerStore.ts.
fn stop_monitoring(state: &ActivityMonitorState) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(monitor) = guard.take() {
            monitor.stop_flag.store(true, Ordering::Relaxed);
        }
    }
}

/// Reads the current segment window's counts and atomically resets them
/// for the next window — mirrors the "one snapshot per segment" rhythm
/// createSegment already uses for screenshots. Returns all-zero if
/// monitoring isn't running (e.g. permission was never granted) rather
/// than erroring — a segment with no activity data is a normal,
/// expected state, not a failure.
fn get_and_reset(state: &ActivityMonitorState) -> ActivitySnapshot {
    let guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    match &*guard {
        Some(monitor) => {
            let mut c = monitor.counters.lock().unwrap_or_else(|e| e.into_inner());
            let snapshot = ActivitySnapshot {
                keyboard_count: c.keyboard_count,
                mouse_click_count: c.mouse_click_count,
                mouse_movement_count: c.mouse_movement_count,
                active_seconds_count: c.active_seconds.len() as u64,
            };
            *c = Counters::default();
            snapshot
        }
        None => ActivitySnapshot {
            keyboard_count: 0,
            mouse_click_count: 0,
            mouse_movement_count: 0,
            active_seconds_count: 0,
        },
    }
}

#[tauri::command]
pub fn start_activity_monitoring(state: tauri::State<ActivityMonitorState>) -> Result<(), String> {
    start_monitoring(&state)
}

#[tauri::command]
pub fn stop_activity_monitoring(state: tauri::State<ActivityMonitorState>) {
    stop_monitoring(&state)
}

#[tauri::command]
pub fn get_and_reset_activity(state: tauri::State<ActivityMonitorState>) -> ActivitySnapshot {
    get_and_reset(&state)
}

/// Checked WITHOUT prompting — same "advisory only, never gate on it
/// proactively" reasoning as has_screen_recording_permission in
/// screenshot.rs (a preflight check can be pessimistic in ways an actual
/// attempt isn't). Always true on platforms that don't gate this behind
/// a runtime permission (Windows' GetAsyncKeyState/GetCursorPos here
/// need none — see docs/database.md).
#[tauri::command]
pub fn has_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos_accessibility_client::accessibility::application_is_trusted()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Triggers the OS's own permission prompt if the VA has never been
/// asked before.
#[tauri::command]
pub fn request_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        macos_accessibility_client::accessibility::application_is_trusted_with_prompt()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Deep-links straight to the Accessibility pane of System Settings —
/// a DIFFERENT pane than Screen Recording (open_screen_recording_settings
/// in screenshot.rs); these are two independent macOS permissions.
#[tauri::command]
pub fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
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
    use std::time::Instant;

    #[test]
    fn preflight_accessibility_check_does_not_panic() {
        let granted = has_accessibility_permission();
        println!("has_accessibility_permission() = {granted}");
    }

    #[test]
    fn start_stop_lifecycle_is_safe_and_idempotent() {
        let state = ActivityMonitorState::default();

        match start_monitoring(&state) {
            Ok(()) => {
                // Idempotent: starting again while already running is a no-op, not an error or a second thread.
                assert!(start_monitoring(&state).is_ok());

                let snapshot = get_and_reset(&state);
                println!(
                    "mid-run snapshot: keyboard={} clicks={} movement={} active_seconds={}",
                    snapshot.keyboard_count, snapshot.mouse_click_count, snapshot.mouse_movement_count, snapshot.active_seconds_count
                );

                stop_monitoring(&state);
                // Idempotent: stopping an already-stopped monitor is a safe no-op.
                stop_monitoring(&state);

                let after_stop = get_and_reset(&state);
                assert_eq!(after_stop.keyboard_count, 0);
                assert_eq!(after_stop.mouse_click_count, 0);
                assert_eq!(after_stop.mouse_movement_count, 0);
                assert_eq!(after_stop.active_seconds_count, 0);
            }
            Err(e) => {
                // No Accessibility permission in this environment — expected
                // and fine; the important thing is a clean, specific error,
                // never a panic (device_query's OWN unchecked constructor
                // panics here, which is exactly why start_monitoring uses
                // checked_new() instead).
                println!("start_monitoring() failed (expected without Accessibility permission): {e}");
                assert_eq!(e, "ACCESSIBILITY_PERMISSION_REQUIRED");
            }
        }
    }

    #[test]
    fn get_and_reset_on_a_never_started_monitor_returns_zero_not_a_panic() {
        let state = ActivityMonitorState::default();
        let snapshot = get_and_reset(&state);
        assert_eq!(snapshot.keyboard_count, 0);
        assert_eq!(snapshot.mouse_click_count, 0);
        assert_eq!(snapshot.mouse_movement_count, 0);
        assert_eq!(snapshot.active_seconds_count, 0);
    }

    /// Sustained CPU/memory measurement of the actual polling loop — not
    /// mocked, not estimated. Ignored by default (it deliberately runs
    /// for real wall-clock seconds); run explicitly with
    /// `cargo test --release -- --ignored --nocapture measure_resource_usage`.
    #[test]
    #[ignore]
    fn measure_resource_usage_while_monitoring_is_active() {
        let state = ActivityMonitorState::default();
        if let Err(e) = start_monitoring(&state) {
            println!("Skipping resource measurement — monitoring couldn't start: {e}");
            return;
        }

        let pid = std::process::id();
        println!("measuring PID {pid} for 15s while activity monitoring runs...");

        let start = Instant::now();
        let mut samples: Vec<(f32, f32)> = Vec::new();
        while start.elapsed() < Duration::from_secs(15) {
            std::thread::sleep(Duration::from_secs(3));
            if let Some(sample) = sample_ps(pid) {
                println!("  t={:>2}s  %CPU={:>5}  %MEM={:>5}  RSS(KB)={}", start.elapsed().as_secs(), sample.0, sample.1, sample.2);
                samples.push((sample.0, sample.1));
            }
        }

        stop_monitoring(&state);

        assert!(!samples.is_empty(), "expected at least one ps sample");
        let avg_cpu: f32 = samples.iter().map(|s| s.0).sum::<f32>() / samples.len() as f32;
        let avg_mem: f32 = samples.iter().map(|s| s.1).sum::<f32>() / samples.len() as f32;
        println!("average over {} samples: %CPU={:.2}  %MEM={:.2}", samples.len(), avg_cpu, avg_mem);

        // Loose sanity bounds, not tight performance assertions (exact
        // numbers are host-dependent) — this just catches a genuinely
        // runaway loop (e.g. a missing sleep), not normal variance.
        assert!(avg_cpu < 20.0, "unexpectedly high sustained CPU: {avg_cpu:.2}%");
    }

    /// A stand-in for `poll_loop` that does NOT call device_query (so it
    /// runs regardless of Accessibility permission) but performs
    /// equivalent-shaped work each tick: the same HashSet diff/insert
    /// pattern against a same-sized synthetic key set, the same mutex
    /// lock, the same 100ms sleep cadence. Hashing and diffing a small
    /// `HashSet` is themselves comparable to (arguably pricier than) the
    /// underlying `GetAsyncKeyState`/`CGEventSourceKeyState`-style OS
    /// queries `poll_tick` makes, so this is a fair, if not slightly
    /// conservative, proxy for the real loop's CPU/memory shape — used
    /// ONLY because the real one is gated behind a permission this
    /// sandbox has no interactive way to grant. See the resource-usage
    /// section of docs/database.md for why this distinction matters and
    /// isn't glossed over.
    fn synthetic_poll_loop(stop_flag: Arc<AtomicBool>, counters: Arc<Mutex<Counters>>) {
        let mut prev_keys: HashSet<u32> = HashSet::new();
        let mut tick: u32 = 0;
        while !stop_flag.load(Ordering::Relaxed) {
            tick = tick.wrapping_add(1);
            // A synthetic "1-3 keys currently down" set that changes
            // shape every tick, exercising the same diff/hash cost a
            // real bursty typing pattern would.
            let keys_now: HashSet<u32> = (0..(tick % 3)).map(|k| k + tick).collect();
            let new_key_presses = keys_now.difference(&prev_keys).count() as u64;
            prev_keys = keys_now;

            if new_key_presses > 0 {
                if let Ok(mut c) = counters.lock() {
                    c.keyboard_count += new_key_presses;
                    c.active_seconds.insert(now_epoch_secs());
                }
            }
            thread::sleep(POLL_INTERVAL);
        }
    }

    #[test]
    #[ignore]
    fn measure_resource_usage_synthetic_equivalent_loop() {
        let stop_flag = Arc::new(AtomicBool::new(false));
        let counters = Arc::new(Mutex::new(Counters::default()));
        let thread_stop = stop_flag.clone();
        let thread_counters = counters.clone();
        thread::spawn(move || synthetic_poll_loop(thread_stop, thread_counters));

        let pid = std::process::id();
        println!("measuring PID {pid} for 15s while a shape-equivalent synthetic poll loop runs (10Hz, same diff/lock/sleep pattern as the real one)...");

        let start = Instant::now();
        let mut samples: Vec<(f32, f32)> = Vec::new();
        while start.elapsed() < Duration::from_secs(15) {
            std::thread::sleep(Duration::from_secs(3));
            if let Some(sample) = sample_ps(pid) {
                println!(
                    "  t={:>2}s  %CPU={:>5}  %MEM={:>5}  RSS(KB)={}",
                    start.elapsed().as_secs(),
                    sample.0,
                    sample.1,
                    sample.2
                );
                samples.push((sample.0, sample.1));
            }
        }

        stop_flag.store(true, Ordering::Relaxed);

        let snapshot = counters.lock().unwrap();
        println!(
            "accumulated over the run: keyboard={} active_seconds={}",
            snapshot.keyboard_count, snapshot.active_seconds.len()
        );
        drop(snapshot);

        assert!(!samples.is_empty(), "expected at least one ps sample");
        let avg_cpu: f32 = samples.iter().map(|s| s.0).sum::<f32>() / samples.len() as f32;
        let avg_mem: f32 = samples.iter().map(|s| s.1).sum::<f32>() / samples.len() as f32;
        println!("average over {} samples: %CPU={:.2}  %MEM={:.2}", samples.len(), avg_cpu, avg_mem);
        assert!(avg_cpu < 20.0, "unexpectedly high sustained CPU: {avg_cpu:.2}%");
    }

    /// Returns (%CPU, %MEM, RSS in KB) for a pid via `ps`, macOS/Linux `ps -o` syntax.
    fn sample_ps(pid: u32) -> Option<(f32, f32, u64)> {
        let output = std::process::Command::new("ps")
            .args(["-o", "%cpu=,%mem=,rss=", "-p", &pid.to_string()])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output.stdout);
        let mut parts = text.split_whitespace();
        let cpu: f32 = parts.next()?.parse().ok()?;
        let mem: f32 = parts.next()?.parse().ok()?;
        let rss: u64 = parts.next()?.parse().ok()?;
        Some((cpu, mem, rss))
    }
}
