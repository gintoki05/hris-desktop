use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

#[derive(Serialize)]
pub struct AttendanceImportBatch {
    pub id: String,
    pub source_file_name: String,
    pub imported_at: String,
    pub imported_by: String,
    pub total_rows: i32,
}

#[derive(Deserialize)]
pub struct AttendanceImportInput {
    pub source_file_name: String,
    pub sheet_name: String,
    pub rows: Vec<AttendanceImportRowInput>,
    pub actor: AttendanceImportActor,
}

#[derive(Deserialize)]
pub struct AttendanceImportActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct AttendanceImportRowInput {
    pub source_row_number: i32,
    pub employee_id: Option<String>,
    pub employee_nik: String,
    pub employee_name: String,
    pub work_date: String,
    pub clock_in: Option<String>,
    pub clock_out: Option<String>,
    pub raw_payload_json: String,
    pub status: String,
    pub error_message: String,
}

pub fn save_attendance_import_batch(
    app: &AppHandle,
    input: AttendanceImportInput,
) -> Result<AttendanceImportBatch, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;

    let source_file_name = input.source_file_name.trim().to_string();
    let sheet_name = input.sheet_name.trim().to_string();
    validate_required("nama file import", &source_file_name)?;
    validate_required("nama sheet import", &sheet_name)?;
    if input.rows.is_empty() {
        return Err(AppError::Database(
            "preview import tidak memiliki baris absensi valid".to_string(),
        ));
    }

    let rows = normalize_rows(input.rows)?;
    let mut connection = database_service::open_local_connection(app)?;
    validate_rows_against_database(&connection, &rows)?;

    let batch_id = create_id("attendance-import-batch")?;
    let notes = format!(
        "sheet={sheet_name}; imported_by={}; rows={}",
        input.actor.display_name,
        rows.len()
    );
    let transaction = connection.transaction()?;
    transaction.execute(
        "
        INSERT INTO attendance_import_batches (id, source_file_name, imported_at, notes)
        VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), ?3)
        ",
        params![&batch_id, &source_file_name, &notes],
    )?;

    for (index, row) in rows.iter().enumerate() {
        let row_id = format!("{batch_id}-row-{}", index + 1);
        let entry_id = format!("{batch_id}-entry-{}", index + 1);
        let employee_id = row.employee_id.as_deref().unwrap_or_default();

        transaction.execute(
            "
            INSERT INTO attendance_import_rows (
                id, import_batch_id, source_row_number, employee_id, employee_nik,
                employee_name, work_date, clock_in, clock_out, raw_payload_json,
                status, error_message, created_at
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5,
                ?6, ?7, ?8, ?9, ?10,
                ?11, ?12, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
            ",
            params![
                &row_id,
                &batch_id,
                row.source_row_number,
                employee_id,
                &row.employee_nik,
                &row.employee_name,
                &row.work_date,
                &row.clock_in,
                &row.clock_out,
                &row.raw_payload_json,
                &row.status,
                &row.error_message,
            ],
        )?;

        transaction.execute(
            "
            INSERT INTO attendance_entries (
                id, employee_id, import_batch_id, work_date, status, clock_in, clock_out,
                minutes_late, minutes_early_leave, overtime_minutes, source, created_at, updated_at
            )
            VALUES (
                ?1, ?2, ?3, ?4, 'present', ?5, ?6,
                0, 0, 0, 'import', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
            ",
            params![
                &entry_id,
                employee_id,
                &batch_id,
                &row.work_date,
                &row.clock_in,
                &row.clock_out,
            ],
        )?;
    }

    transaction.commit()?;
    get_batch_by_id(app, &batch_id)?.ok_or_else(|| {
        AppError::Database("batch import tersimpan tetapi gagal dibaca ulang".to_string())
    })
}

fn normalize_rows(
    rows: Vec<AttendanceImportRowInput>,
) -> Result<Vec<AttendanceImportRowInput>, AppError> {
    let mut normalized = Vec::new();

    for row in rows {
        let next = AttendanceImportRowInput {
            source_row_number: row.source_row_number,
            employee_id: row.employee_id.map(|value| value.trim().to_string()),
            employee_nik: row.employee_nik.trim().to_string(),
            employee_name: row.employee_name.trim().to_string(),
            work_date: row.work_date.trim().to_string(),
            clock_in: row.clock_in.map(|value| value.trim().to_string()),
            clock_out: row.clock_out.map(|value| value.trim().to_string()),
            raw_payload_json: row.raw_payload_json.trim().to_string(),
            status: row.status.trim().to_string(),
            error_message: row.error_message.trim().to_string(),
        };

        if next.status != "valid" {
            return Err(AppError::Database(
                "preview masih memiliki baris error atau karyawan tidak dikenal".to_string(),
            ));
        }

        validate_required("karyawan import", next.employee_id.as_deref().unwrap_or_default())?;
        validate_required("nama karyawan import", &next.employee_name)?;
        validate_iso_date("tanggal absensi import", &next.work_date)?;
        validate_time("jam masuk import", next.clock_in.as_deref())?;
        validate_optional_time("jam pulang import", next.clock_out.as_deref())?;
        validate_required("raw payload import", &next.raw_payload_json)?;
        serde_json::from_str::<serde_json::Value>(&next.raw_payload_json)
            .map_err(|error| AppError::Database(format!("raw payload import tidak valid: {error}")))?;

        if normalized.iter().any(|existing: &AttendanceImportRowInput| {
            existing.employee_id == next.employee_id && existing.work_date == next.work_date
        }) {
            return Err(AppError::Database(
                "satu file import berisi duplikat karyawan dan tanggal".to_string(),
            ));
        }

        normalized.push(next);
    }

    Ok(normalized)
}

fn validate_rows_against_database(
    connection: &rusqlite::Connection,
    rows: &[AttendanceImportRowInput],
) -> Result<(), AppError> {
    for row in rows {
        let employee_id = row.employee_id.as_deref().unwrap_or_default();
        let active_employee: bool = connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM employees WHERE id = ?1 AND status = 'active')",
            [employee_id],
            |value| value.get(0),
        )?;
        if !active_employee {
            return Err(AppError::Database(format!(
                "baris {} memakai karyawan yang tidak aktif atau tidak ditemukan",
                row.source_row_number
            )));
        }

        let existing_entry: bool = connection.query_row(
            "
            SELECT EXISTS(
                SELECT 1 FROM attendance_entries
                WHERE employee_id = ?1 AND work_date = ?2
            )
            ",
            params![employee_id, &row.work_date],
            |value| value.get(0),
        )?;
        if existing_entry {
            return Err(AppError::Database(format!(
                "absensi {} pada {} sudah pernah tersimpan",
                row.employee_name, row.work_date
            )));
        }

        let finalized_payroll: bool = connection.query_row(
            "
            SELECT EXISTS(
                SELECT 1 FROM payroll_runs
                WHERE status = 'finalized'
                    AND period_start <= ?1
                    AND period_end >= ?1
            )
            ",
            [&row.work_date],
            |value| value.get(0),
        )?;
        if finalized_payroll {
            return Err(AppError::Database(format!(
                "tanggal {} sudah masuk payroll final",
                row.work_date
            )));
        }
    }

    Ok(())
}

fn get_batch_by_id(
    app: &AppHandle,
    batch_id: &str,
) -> Result<Option<AttendanceImportBatch>, AppError> {
    let connection = database_service::open_local_connection(app)?;
    connection
        .query_row(
            "
            SELECT id, source_file_name, imported_at, COALESCE(notes, ''), (
                SELECT COUNT(*) FROM attendance_import_rows WHERE import_batch_id = attendance_import_batches.id
            )
            FROM attendance_import_batches
            WHERE id = ?1
            ",
            [batch_id],
            |row| {
                let notes: String = row.get(3)?;
                Ok(AttendanceImportBatch {
                    id: row.get(0)?,
                    source_file_name: row.get(1)?,
                    imported_at: row.get(2)?,
                    imported_by: extract_imported_by(&notes),
                    total_rows: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(AppError::from)
}

fn extract_imported_by(notes: &str) -> String {
    notes
        .split(';')
        .find_map(|part| part.trim().strip_prefix("imported_by="))
        .unwrap_or("")
        .trim()
        .to_string()
}

fn validate_actor(actor: &AttendanceImportActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh menyimpan import absensi".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}

fn validate_required(label: &str, value: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Database(format!("{label} wajib diisi")));
    }

    Ok(())
}

fn validate_iso_date(label: &str, value: &str) -> Result<(), AppError> {
    let bytes = value.as_bytes();
    let valid = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit());

    if valid {
        Ok(())
    } else {
        Err(AppError::Database(format!(
            "{label} harus memakai format YYYY-MM-DD"
        )))
    }
}

fn validate_time(label: &str, value: Option<&str>) -> Result<(), AppError> {
    match value {
        Some(value) if is_time(value) => Ok(()),
        _ => Err(AppError::Database(format!(
            "{label} harus memakai format HH:mm"
        ))),
    }
}

fn validate_optional_time(label: &str, value: Option<&str>) -> Result<(), AppError> {
    match value {
        Some(value) if !value.is_empty() && !is_time(value) => Err(AppError::Database(format!(
            "{label} harus memakai format HH:mm"
        ))),
        _ => Ok(()),
    }
}

fn is_time(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 5
        && bytes[2] == b':'
        && bytes[0].is_ascii_digit()
        && bytes[1].is_ascii_digit()
        && bytes[3].is_ascii_digit()
        && bytes[4].is_ascii_digit()
        && &value[0..2] <= "23"
        && &value[3..5] <= "59"
}

fn create_id(prefix: &str) -> Result<String, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Database(error.to_string()))?
        .as_millis();

    Ok(format!("{prefix}-{timestamp}"))
}
