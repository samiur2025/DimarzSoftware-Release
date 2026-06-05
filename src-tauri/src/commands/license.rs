use crate::state::AppState;
use tauri::State;
#[tauri::command]
pub async fn get_hardware_id() -> Result<String, String> {
    crate::licensing::hardware::HardwareFingerprint::generate()
}
#[tauri::command]
pub async fn activate_license(
    license_key: String,
    state: State<'_, AppState>,
) -> Result<crate::models::ActivationResponse, String> {
    let hardware_id = crate::licensing::hardware::HardwareFingerprint::generate()?;
    let license = state.license.lock().map_err(|e| e.to_string())?.clone();
    license.activate_online(license_key, hardware_id).await
}
#[tauri::command]
pub fn check_license(state: State<'_, AppState>) -> Result<bool, String> {
    let license = state.license.lock().map_err(|e| e.to_string())?;
    license.validate_local()
}
