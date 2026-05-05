use serde::Serialize;
use tauri::AppHandle;

use crate::services::database_service;

#[derive(Serialize)]
pub struct LocalDatabaseStatus {
    database_path: String,
    backup_directory: String,
    journal_mode: String,
    foreign_keys_enabled: bool,
    migrations_applied: u32,
}

#[tauri::command]
pub fn initialize_local_database(app: AppHandle) -> Result<LocalDatabaseStatus, String> {
    database_service::initialize_local_database(&app)
        .map(|status| LocalDatabaseStatus {
            database_path: status.database_path.display().to_string(),
            backup_directory: status.backup_directory.display().to_string(),
            journal_mode: status.journal_mode,
            foreign_keys_enabled: status.foreign_keys_enabled,
            migrations_applied: status.migrations_applied,
        })
        .map_err(|error| error.user_message())
}
