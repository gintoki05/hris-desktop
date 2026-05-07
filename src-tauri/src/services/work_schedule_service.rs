use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

#[derive(Clone, Serialize)]
pub struct WorkScheduleEntry {
    pub id: String,
    pub period_id: String,
    pub employee_id: String,
    pub work_date: String,
    pub shift_id: String,
    pub notes: String,
    pub is_locked: bool,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct WorkSchedulePeriod {
    pub id: String,
    pub label: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub is_locked: bool,
    pub entries: Vec<WorkScheduleEntry>,
}

#[derive(Deserialize)]
pub struct WorkScheduleActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct WorkSchedulePeriodInput {
    pub id: Option<String>,
    pub label: String,
    pub start_date: String,
    pub end_date: String,
    pub entries: Vec<WorkScheduleEntryInput>,
    pub actor: WorkScheduleActor,
}

#[derive(Deserialize)]
pub struct WorkScheduleEntryInput {
    pub id: Option<String>,
    pub employee_id: String,
    pub work_date: String,
    pub shift_id: String,
    pub notes: String,
}

pub fn get_work_schedule_period(
    app: &AppHandle,
    start_date: String,
    end_date: String,
) -> Result<Option<WorkSchedulePeriod>, AppError> {
    database_service::initialize_local_database(app)?;
    validate_date_range(&start_date, &end_date)?;

    let connection = database_service::open_local_connection(app)?;
    let period = connection
        .query_row(
            "
            SELECT id, label, start_date, end_date, status, locked_payroll_run_id
            FROM work_schedule_periods
            WHERE start_date = ?1 AND end_date = ?2
                OR (start_date <= ?2 AND end_date >= ?1)
            ORDER BY
                CASE WHEN start_date = ?1 AND end_date = ?2 THEN 0 ELSE 1 END,
                start_date ASC
            LIMIT 1
            ",
            params![&start_date, &end_date],
            |row| {
                let id: String = row.get(0)?;
                let locked_payroll_run_id: Option<String> = row.get(5)?;
                Ok(WorkSchedulePeriod {
                    id,
                    label: row.get(1)?,
                    start_date: row.get(2)?,
                    end_date: row.get(3)?,
                    status: row.get(4)?,
                    is_locked: locked_payroll_run_id.is_some(),
                    entries: Vec::new(),
                })
            },
        )
        .optional()?;

    match period {
        Some(mut value) => {
            value.entries = list_entries(&connection, &value.id)?;
            Ok(Some(value))
        }
        None => Ok(None),
    }
}

pub fn save_work_schedule_period(
    app: &AppHandle,
    input: WorkSchedulePeriodInput,
) -> Result<WorkSchedulePeriod, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;

    let period_id = input
        .id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or(create_id("work-schedule-period")?);
    let label = input.label.trim().to_string();
    let start_date = input.start_date.trim().to_string();
    let end_date = input.end_date.trim().to_string();
    validate_required("label periode jadwal", &label)?;
    validate_date_range(&start_date, &end_date)?;

    let entries = normalize_entries(&start_date, &end_date, input.entries)?;
    let mut connection = database_service::open_local_connection(app)?;
    ensure_period_is_editable(&connection, &period_id, &start_date, &end_date)?;

    let transaction = connection.transaction()?;
    transaction.execute(
        "
        INSERT INTO work_schedule_periods (
            id, label, start_date, end_date, status, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, 'draft', datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            updated_at = datetime('now')
        ",
        params![&period_id, &label, &start_date, &end_date],
    )?;

    for entry in &entries {
        ensure_active_employee(&transaction, &entry.employee_id)?;
        ensure_active_shift(&transaction, &entry.shift_id)?;
        ensure_entry_unlocked(&transaction, entry.id.as_deref())?;

        let entry_id = entry
            .id
            .as_deref()
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or(create_id("work-schedule-entry")?);

        transaction.execute(
            "
            INSERT INTO employee_work_schedules (
                id, period_id, employee_id, work_date, shift_id, notes, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
            ON CONFLICT(period_id, employee_id, work_date) DO UPDATE SET
                shift_id = excluded.shift_id,
                notes = excluded.notes,
                updated_at = datetime('now')
            ",
            params![
                &entry_id,
                &period_id,
                &entry.employee_id,
                &entry.work_date,
                &entry.shift_id,
                &entry.notes,
            ],
        )?;
    }

    transaction.commit()?;
    get_period_by_id(app, &period_id)?.ok_or_else(|| {
        AppError::Database("jadwal tersimpan tetapi gagal dibaca ulang".to_string())
    })
}

fn get_period_by_id(
    app: &AppHandle,
    period_id: &str,
) -> Result<Option<WorkSchedulePeriod>, AppError> {
    let connection = database_service::open_local_connection(app)?;
    let period = connection
        .query_row(
            "
            SELECT id, label, start_date, end_date, status, locked_payroll_run_id
            FROM work_schedule_periods
            WHERE id = ?1
            ",
            [period_id],
            |row| {
                let id: String = row.get(0)?;
                let locked_payroll_run_id: Option<String> = row.get(5)?;
                Ok(WorkSchedulePeriod {
                    id,
                    label: row.get(1)?,
                    start_date: row.get(2)?,
                    end_date: row.get(3)?,
                    status: row.get(4)?,
                    is_locked: locked_payroll_run_id.is_some(),
                    entries: Vec::new(),
                })
            },
        )
        .optional()?;

    match period {
        Some(mut value) => {
            value.entries = list_entries(&connection, &value.id)?;
            Ok(Some(value))
        }
        None => Ok(None),
    }
}

fn list_entries(
    connection: &rusqlite::Connection,
    period_id: &str,
) -> Result<Vec<WorkScheduleEntry>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, period_id, employee_id, work_date, shift_id, notes, locked_payroll_run_id, updated_at
        FROM employee_work_schedules
        WHERE period_id = ?1
        ORDER BY work_date ASC, employee_id ASC
        ",
    )?;
    let rows = statement.query_map([period_id], |row| {
        let locked_payroll_run_id: Option<String> = row.get(6)?;
        Ok(WorkScheduleEntry {
            id: row.get(0)?,
            period_id: row.get(1)?,
            employee_id: row.get(2)?,
            work_date: row.get(3)?,
            shift_id: row.get(4)?,
            notes: row.get(5)?,
            is_locked: locked_payroll_run_id.is_some(),
            updated_at: row.get(7)?,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }

    Ok(entries)
}

fn normalize_entries(
    start_date: &str,
    end_date: &str,
    entries: Vec<WorkScheduleEntryInput>,
) -> Result<Vec<WorkScheduleEntryInput>, AppError> {
    let mut normalized = Vec::new();

    for entry in entries {
        let next = WorkScheduleEntryInput {
            id: entry.id.map(|id| id.trim().to_string()),
            employee_id: entry.employee_id.trim().to_string(),
            work_date: entry.work_date.trim().to_string(),
            shift_id: entry.shift_id.trim().to_string(),
            notes: entry.notes.trim().to_string(),
        };

        validate_required("karyawan jadwal", &next.employee_id)?;
        validate_required("shift jadwal", &next.shift_id)?;
        validate_iso_date("tanggal jadwal", &next.work_date)?;
        if next.work_date.as_str() < start_date || next.work_date.as_str() > end_date {
            return Err(AppError::Database(
                "tanggal jadwal harus berada dalam periode yang dipilih".to_string(),
            ));
        }

        if normalized.iter().any(|existing: &WorkScheduleEntryInput| {
            existing.employee_id == next.employee_id && existing.work_date == next.work_date
        }) {
            return Err(AppError::Database(
                "satu karyawan hanya boleh punya satu jadwal per tanggal".to_string(),
            ));
        }

        normalized.push(WorkScheduleEntryInput {
            id: next.id,
            employee_id: next.employee_id,
            work_date: next.work_date,
            shift_id: next.shift_id,
            notes: next.notes,
        });
    }

    Ok(normalized)
}

fn ensure_period_is_editable(
    connection: &rusqlite::Connection,
    period_id: &str,
    start_date: &str,
    end_date: &str,
) -> Result<(), AppError> {
    let locked_period: bool = connection.query_row(
        "
        SELECT EXISTS(
            SELECT 1 FROM work_schedule_periods
            WHERE id = ?1 AND locked_payroll_run_id IS NOT NULL
        )
        ",
        [period_id],
        |row| row.get(0),
    )?;
    if locked_period {
        return Err(AppError::Database(
            "jadwal sudah terkunci oleh payroll final".to_string(),
        ));
    }

    let overlapping_period: bool = connection.query_row(
        "
        SELECT EXISTS(
            SELECT 1 FROM work_schedule_periods
            WHERE id <> ?1
                AND start_date <= ?3
                AND end_date >= ?2
        )
        ",
        params![period_id, start_date, end_date],
        |row| row.get(0),
    )?;
    if overlapping_period {
        return Err(AppError::Database(
            "periode jadwal tidak boleh tumpang tindih dengan periode jadwal lain".to_string(),
        ));
    }

    let finalized_overlap: bool = connection.query_row(
        "
        SELECT EXISTS(
            SELECT 1 FROM payroll_runs
            WHERE status = 'finalized'
                AND period_start <= ?2
                AND period_end >= ?1
        )
        ",
        params![start_date, end_date],
        |row| row.get(0),
    )?;
    if finalized_overlap {
        return Err(AppError::Database(
            "jadwal tidak bisa diubah karena periode payroll sudah final".to_string(),
        ));
    }

    Ok(())
}

fn ensure_entry_unlocked(
    connection: &rusqlite::Connection,
    entry_id: Option<&str>,
) -> Result<(), AppError> {
    if let Some(id) = entry_id {
        let locked: bool = connection.query_row(
            "
            SELECT EXISTS(
                SELECT 1 FROM employee_work_schedules
                WHERE id = ?1 AND locked_payroll_run_id IS NOT NULL
            )
            ",
            [id],
            |row| row.get(0),
        )?;
        if locked {
            return Err(AppError::Database(
                "baris jadwal sudah terkunci oleh payroll final".to_string(),
            ));
        }
    }

    Ok(())
}

fn ensure_active_employee(
    connection: &rusqlite::Connection,
    employee_id: &str,
) -> Result<(), AppError> {
    let active: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM employees WHERE id = ?1 AND status = 'active')",
        [employee_id],
        |row| row.get(0),
    )?;

    if active {
        Ok(())
    } else {
        Err(AppError::Database(
            "jadwal baru hanya boleh memilih karyawan aktif".to_string(),
        ))
    }
}

fn ensure_active_shift(
    connection: &rusqlite::Connection,
    shift_id: &str,
) -> Result<(), AppError> {
    let active: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM work_shifts WHERE id = ?1 AND is_active = 1)",
        [shift_id],
        |row| row.get(0),
    )?;

    if active {
        Ok(())
    } else {
        Err(AppError::Database(
            "jadwal harus memakai master shift aktif".to_string(),
        ))
    }
}

fn validate_actor(actor: &WorkScheduleActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh mengubah jadwal kerja".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}

fn validate_date_range(start_date: &str, end_date: &str) -> Result<(), AppError> {
    validate_iso_date("tanggal mulai periode", start_date)?;
    validate_iso_date("tanggal selesai periode", end_date)?;
    if start_date > end_date {
        return Err(AppError::Database(
            "tanggal selesai periode tidak boleh sebelum tanggal mulai".to_string(),
        ));
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

fn validate_required(label: &str, value: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Database(format!("{label} wajib diisi")));
    }

    Ok(())
}

fn create_id(prefix: &str) -> Result<String, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Database(error.to_string()))?
        .as_millis();

    Ok(format!("{prefix}-{timestamp}"))
}
