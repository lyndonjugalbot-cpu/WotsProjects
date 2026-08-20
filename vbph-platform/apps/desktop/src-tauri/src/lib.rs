mod activity;
mod screenshot;
mod secure_store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(activity::ActivityMonitorState::default())
        .invoke_handler(tauri::generate_handler![
            secure_store::secure_store_save,
            secure_store::secure_store_load,
            secure_store::secure_store_clear,
            screenshot::capture_screenshot,
            screenshot::has_screen_recording_permission,
            screenshot::request_screen_recording_permission,
            screenshot::open_screen_recording_settings,
            activity::start_activity_monitoring,
            activity::stop_activity_monitoring,
            activity::get_and_reset_activity,
            activity::has_accessibility_permission,
            activity::request_accessibility_permission,
            activity::open_accessibility_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
