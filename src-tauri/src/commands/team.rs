use crate::models::TeamMember;
use crate::state::AppState;
use tauri::State;
#[tauri::command]
pub fn get_team_members(state: State<'_, AppState>) -> Result<Vec<TeamMember>, String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_team_members()
}
#[tauri::command]
pub fn create_team_member(member: TeamMember, state: State<'_, AppState>) -> Result<i64, String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.create_team_member(member)
}
#[tauri::command]
pub fn update_team_member(
    id: i64,
    member: TeamMember,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.update_team_member(id, member)
}
#[tauri::command]
pub fn delete_team_member(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db_lock = state.db.blocking_lock();
        let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.delete_team_member(id)
}
