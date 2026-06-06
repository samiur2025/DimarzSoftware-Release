use crate::database::Database;
use crate::licensing::LicenseManager;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub db: Arc<Mutex<Option<Database>>>,
    pub license: Arc<Mutex<LicenseManager>>,
}
