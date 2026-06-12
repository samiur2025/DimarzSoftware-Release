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
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.import_leads_csv(&file_path)
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
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
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
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
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
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.commit_csv_fast(csv_path, rejected_rows, client_profile, workspace_node)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn backup_database(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.backup_leads(&file_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn restore_database(
    file_path: String,
    replace: bool,
    app_handle: tauri::AppHandle,
) -> Result<i64, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.restore_leads(&file_path, replace)
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
        let db_clone = {
            let db_lock = state.db.blocking_lock();
            let db = db_lock.as_ref().ok_or("Database not initialized")?;
            db.try_clone()?
        };
        db_clone.get_leads(filter)
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
        let db_clone = {
            let db_lock = state.db.blocking_lock();
            let db = db_lock.as_ref().ok_or("Database not initialized")?;
            db.try_clone()?
        };
        db_clone.get_filter_counts(filter)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_forever_cmd(ids: Vec<i64>, app_handle: tauri::AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.delete_forever(ids)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn optimize_db_cmd(app_handle: tauri::AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.optimize_db()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn clear_all_leads_cmd(app_handle: tauri::AppHandle) -> Result<i64, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.clear_all_leads()
    })
    .await
    .map_err(|e| e.to_string())?
}

// ─── Transaction Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn get_transactions_cmd(app_handle: tauri::AppHandle) -> Result<Vec<crate::models::Transaction>, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.get_transactions()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_transaction_cmd(tx: crate::models::Transaction, app_handle: tauri::AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.add_transaction(tx)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_transaction_cmd(id: i64, app_handle: tauri::AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.delete_transaction(id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_transaction_summary_cmd(app_handle: tauri::AppHandle) -> Result<crate::models::TransactionSummary, String> {
    tokio::task::spawn_blocking(move || {
        let state = app_handle.state::<AppState>();
        let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
        db.get_transaction_summary()
    })
    .await
    .map_err(|e| e.to_string())?
}
