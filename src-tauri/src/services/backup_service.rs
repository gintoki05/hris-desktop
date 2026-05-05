use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

pub fn create_local_database_backup(app: &AppHandle) -> Result<PathBuf, AppError> {
    let database_path = database_service::resolve_database_file(app)?;
    let backup_directory = database_service::resolve_backup_directory(app)?;

    fs::create_dir_all(&backup_directory)?;

    if !database_path.exists() {
        database_service::initialize_local_database(app)?;
    }

    let backup_path = backup_directory.join(format!("hris-payroll-{}.sqlite3", timestamp()?));
    create_sqlite_backup(&database_path, &backup_path)?;

    Ok(backup_path)
}

pub fn create_safety_backup(app: &AppHandle, reason: &str) -> Result<Option<PathBuf>, AppError> {
    let database_path = database_service::resolve_database_file(app)?;

    if !database_path.exists() {
        return Ok(None);
    }

    let backup_directory = database_service::resolve_backup_directory(app)?;
    fs::create_dir_all(&backup_directory)?;

    let backup_path =
        backup_directory.join(format!("hris-payroll-{reason}-{}.sqlite3", timestamp()?));
    create_sqlite_backup(&database_path, &backup_path)?;

    Ok(Some(backup_path))
}

pub fn restore_database_from_backup(app: &AppHandle, backup_path: PathBuf) -> Result<(), AppError> {
    let database_path = database_service::resolve_database_file(app)?;
    let backup_directory = database_service::resolve_backup_directory(app)?;
    let safe_backup_path =
        database_service::ensure_path_inside_directory(&backup_path, &backup_directory)?;

    create_safety_backup(app, "pre-restore")?;
    fs::copy(safe_backup_path, database_path)?;

    Ok(())
}

fn create_sqlite_backup(database_path: &PathBuf, backup_path: &PathBuf) -> Result<(), AppError> {
    let connection = Connection::open(database_path)?;
    let backup_path_text = backup_path.to_string_lossy().to_string();
    connection.execute("VACUUM INTO ?1", params![backup_path_text])?;

    Ok(())
}

fn timestamp() -> Result<u64, AppError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| AppError::FileSystem(error.to_string()))
}
