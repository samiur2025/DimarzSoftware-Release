use crate::database::Database;
use crate::licensing::LicenseManager;
use std::sync::Mutex;
pub struct AppState {
    pub db: std::sync::Arc<Mutex<Database>>,
    pub license: Mutex<LicenseManager>,
}
