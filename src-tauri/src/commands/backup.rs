use tauri::AppHandle;

use crate::services::backup_service;

#[derive(serde::Serialize)]
pub struct LocalBackupFile {
    path: String,
    file_name: String,
    size_bytes: u64,
    modified_at_unix_ms: u64,
}

#[tauri::command]
pub fn create_local_database_backup(app: AppHandle) -> Result<String, String> {
    backup_service::create_local_database_backup(&app)
        .map(|path| path.display().to_string())
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn list_local_database_backups(app: AppHandle) -> Result<Vec<LocalBackupFile>, String> {
    backup_service::list_local_database_backups(&app)
        .map(|files| {
            files
                .into_iter()
                .map(|file| LocalBackupFile {
                    path: file.path.display().to_string(),
                    file_name: file.file_name,
                    size_bytes: file.size_bytes,
                    modified_at_unix_ms: file.modified_at_unix_ms,
                })
                .collect()
        })
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn restore_local_database_backup(app: AppHandle, backup_path: String) -> Result<(), String> {
    backup_service::restore_database_from_backup(&app, backup_path.into())
        .map_err(|error| error.user_message())
}
