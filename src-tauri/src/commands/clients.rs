use crate::models::{Client, ClientStats};
use crate::state::AppState;
use tauri::State;
#[tauri::command]
pub fn get_clients(state: State<'_, AppState>) -> Result<Vec<Client>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_clients()
}
#[tauri::command]
pub fn get_client_stats(client_id: i64, state: State<'_, AppState>) -> Result<ClientStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_client_stats(client_id)
}
#[tauri::command]
pub fn create_client(client: Client, state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_client(client)
}
#[tauri::command]
pub fn update_client(id: i64, client: Client, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_client(id, client)
}
#[tauri::command]
pub fn delete_client(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_client(id)
}
