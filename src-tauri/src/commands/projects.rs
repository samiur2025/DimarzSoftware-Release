use crate::models::Project;
use crate::state::AppState;
use tauri::State;
#[tauri::command]
pub fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_projects()
}
#[tauri::command]
pub fn create_project(project: Project, state: State<'_, AppState>) -> Result<i64, String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.create_project(project)
}
#[tauri::command]
pub fn update_project(id: i64, project: Project, state: State<'_, AppState>) -> Result<(), String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.update_project(id, project)
}
#[tauri::command]
pub fn delete_project(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.delete_project(id)
}
