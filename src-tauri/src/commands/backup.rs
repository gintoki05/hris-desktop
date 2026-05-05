use tauri::AppHandle;

use crate::services::backup_service;

#[tauri::command]
pub fn create_local_database_backup(app: AppHandle) -> Result<String, String> {
    backup_service::create_local_database_backup(&app)
        .map(|path| path.display().to_string())
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn restore_local_database_backup(app: AppHandle, backup_path: String) -> Result<(), String> {
    backup_service::restore_database_from_backup(&app, backup_path.into())
        .map_err(|error| error.user_message())
}
