use crate::models::{ExportPayload, LeadFilter, PaginatedLeads};
use crate::state::AppState;
use tauri::Manager;

// ─── Heavy async operations (CSV import/export) ───────────────────────────────
// These use spawn_blocking because they process large files and would block the UI.

#[tauri::command]
pub async fn import_leads_csv(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<crate::models::ImportResult, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        crate::database::Database::import_leads_csv(state.db.clone(), &file_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn export_leads_csv(
    file_path: String,
    filter: ExportPayload,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.export_leads_csv(&file_path, filter)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn audit_csv_cmd(
    csv_path: String,
    app_handle: tauri::AppHandle,
) -> Result<crate::models::AuditResult, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.audit_csv(csv_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn commit_csv_cmd(
    csv_path: String,
    rejected_rows: Vec<i64>,   // Only the REJECTED rows (hard duplicates) — tiny list
    client_profile: String,
    workspace_node: String,
    app_handle: tauri::AppHandle,
) -> Result<crate::models::ImportResult, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.commit_csv_fast(csv_path, rejected_rows, client_profile, workspace_node)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Fast synchronous commands (DB reads/writes) ──────────────────────────────
// These use State<> directly — safe, simple, and correct for DuckDB's non-Send Connection.

#[tauri::command]
pub async fn get_leads(
    filter: LeadFilter,
    app_handle: tauri::AppHandle,
) -> Result<PaginatedLeads, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_leads(filter)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_filter_counts(
    filter: LeadFilter,
    app_handle: tauri::AppHandle,
) -> Result<crate::models::FilterCounts, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_filter_counts(filter)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_forever_cmd(ids: Vec<i64>, app_handle: tauri::AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.delete_forever(ids)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn optimize_db_cmd(app_handle: tauri::AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.optimize_db()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn clear_all_leads_cmd(app_handle: tauri::AppHandle) -> Result<i64, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.clear_all_leads()
    })
    .await
    .map_err(|e| e.to_string())?
}
