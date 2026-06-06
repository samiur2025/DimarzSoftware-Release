use crate::database::Database;
use crate::licensing::LicenseManager;
use crate::state::AppState;
use tauri::Manager;
use tauri::Emitter;
pub mod commands;
pub mod database;
pub mod licensing;
pub mod models;
pub mod security;
pub mod state;
#[tauri::command]
async fn initialize_app(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    // Step 1: Check license in background
    let license_valid = {
        let license_manager = state.license.lock().await.clone();
        tokio::task::spawn_blocking(move || license_manager.validate_local())
            .await
            .map_err(|e| e.to_string())??
    };

    if !license_valid {
        return Err("INVALID_LICENSE".to_string());
    }

    window.emit("init-progress", "Loading database...").unwrap();

    let app_dir = window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    
    let db_path = app_dir.join("dimrz.duckdb");
    let db_path_str = db_path.to_str().unwrap().to_string();

    // Step 2: Initialize DuckDB in background
    let db = tokio::task::spawn_blocking(move || {
        Database::new(&db_path_str)
    })
    .await
    .map_err(|e| e.to_string())??;

    *state.db.lock().await = Some(db);

    window.emit("init-progress", "Ready").unwrap();
    Ok("initialized".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let license = LicenseManager::new(app_dir.clone());
            app.manage(AppState {
                db: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
                license: std::sync::Arc::new(tokio::sync::Mutex::new(license)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            initialize_app,
            commands::get_hardware_id,
            commands::activate_license,
            commands::check_license,
            commands::get_leads,
            commands::get_filter_counts,
            commands::delete_forever_cmd,
            commands::optimize_db_cmd,
            commands::clear_all_leads_cmd,
            commands::import_leads_csv,
            commands::export_leads_csv,
            commands::backup_database,
            commands::restore_database,
            commands::audit_csv_cmd,
            commands::commit_csv_cmd,
            commands::get_clients,
            commands::get_client_stats,
            commands::create_client,
            commands::update_client,
            commands::delete_client,
            commands::get_projects,
            commands::create_project,
            commands::update_project,
            commands::delete_project,
            commands::get_team_members,
            commands::create_team_member,
            commands::update_team_member,
            commands::delete_team_member,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
