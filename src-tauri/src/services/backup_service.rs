use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

pub struct LocalBackupFile {
    pub path: PathBuf,
    pub file_name: String,
    pub size_bytes: u64,
    pub modified_at_unix_ms: u64,
}

pub fn create_local_database_backup(app: &AppHandle) -> Result<PathBuf, AppError> {
    let database_path = database_service::resolve_database_file(app)?;
    let backup_directory = database_service::resolve_backup_directory(app)?;

    fs::create_dir_all(&backup_directory)?;

    if !database_path.exists() {
        database_service::initialize_local_database(app)?;
    }

    let backup_path = backup_directory.join(format!("hris-payroll-{}.sqlite3", timestamp()?));
    create_sqlite_backup(&database_path, &backup_path)?;
    let _ = record_backup_event(app, &backup_path, "manual-backup");

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

    if safe_backup_path.extension().and_then(|extension| extension.to_str()) != Some("sqlite3") {
        return Err(AppError::Path(
            "file restore harus berupa backup .sqlite3 aplikasi".to_string(),
        ));
    }

    create_safety_backup(app, "pre-restore")?;
    remove_sqlite_sidecar_files(&database_path)?;
    fs::copy(&safe_backup_path, &database_path)?;
    remove_sqlite_sidecar_files(&database_path)?;
    let _ = record_backup_event(app, &backup_path, "restore-applied");

    Ok(())
}

pub fn list_local_database_backups(app: &AppHandle) -> Result<Vec<LocalBackupFile>, AppError> {
    let backup_directory = database_service::resolve_backup_directory(app)?;
    fs::create_dir_all(&backup_directory)?;

    let mut backups = Vec::new();

    for entry in fs::read_dir(backup_directory)? {
        let entry = entry?;
        let path = entry.path();

        let is_sqlite_backup =
            path.extension().and_then(|extension| extension.to_str()) == Some("sqlite3");

        if !path.is_file() || !is_sqlite_backup {
            continue;
        }

        let metadata = entry.metadata()?;
        let modified_at_unix_ms = metadata
            .modified()?
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .map_err(|error| AppError::FileSystem(error.to_string()))?;
        let modified_at_unix_ms = u64::try_from(modified_at_unix_ms)
            .map_err(|error| AppError::FileSystem(error.to_string()))?;

        backups.push(LocalBackupFile {
            file_name: path
                .file_name()
                .and_then(|file_name| file_name.to_str())
                .unwrap_or("backup.sqlite3")
                .to_string(),
            path,
            size_bytes: metadata.len(),
            modified_at_unix_ms,
        });
    }

    backups.sort_by(|left, right| right.modified_at_unix_ms.cmp(&left.modified_at_unix_ms));

    Ok(backups)
}

fn create_sqlite_backup(database_path: &PathBuf, backup_path: &PathBuf) -> Result<(), AppError> {
    let connection = Connection::open(database_path)?;
    let backup_path_text = backup_path.to_string_lossy().to_string();
    connection.execute("VACUUM INTO ?1", params![backup_path_text])?;

    Ok(())
}

fn remove_sqlite_sidecar_files(database_path: &PathBuf) -> Result<(), AppError> {
    for suffix in ["-wal", "-shm"] {
        let sidecar_path = PathBuf::from(format!("{}{}", database_path.display(), suffix));

        match fs::remove_file(&sidecar_path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }

    Ok(())
}

fn record_backup_event(
    app: &AppHandle,
    backup_path: &PathBuf,
    reason: &str,
) -> Result<(), AppError> {
    let connection = database_service::open_local_connection(app)?;

    connection.execute(
        "INSERT INTO local_backup_events (id, backup_path, reason, created_at)
         VALUES (?1, ?2, ?3, datetime('now'))",
        params![
            format!("{reason}-{}", timestamp()?),
            backup_path.display().to_string(),
            reason,
        ],
    )?;

    Ok(())
}

fn timestamp() -> Result<u128, AppError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| AppError::FileSystem(error.to_string()))
}
