use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

#[derive(Clone, Serialize, Deserialize)]
pub struct WorkShift {
    pub id: String,
    pub code: String,
    pub name: String,
    pub start_time: String,
    pub end_time: String,
    pub break_minutes: i32,
    pub is_off: bool,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AttendanceCode {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category: String,
    pub counts_as_workday: bool,
    pub is_paid: bool,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct OvertimeRule {
    pub id: String,
    pub code: String,
    pub name: String,
    pub applies_to: String,
    pub multiplier: f64,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Serialize)]
pub struct AttendanceMasterData {
    pub shifts: Vec<WorkShift>,
    pub attendance_codes: Vec<AttendanceCode>,
    pub overtime_rules: Vec<OvertimeRule>,
}

#[derive(Deserialize)]
pub struct AttendanceMasterInput {
    pub shifts: Vec<WorkShift>,
    pub attendance_codes: Vec<AttendanceCode>,
    pub overtime_rules: Vec<OvertimeRule>,
    pub actor: AttendanceMasterActor,
}

#[derive(Deserialize)]
pub struct AttendanceMasterActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

pub fn get_attendance_master_data(app: &AppHandle) -> Result<AttendanceMasterData, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;

    Ok(AttendanceMasterData {
        shifts: list_work_shifts(&connection)?,
        attendance_codes: list_attendance_codes(&connection)?,
        overtime_rules: list_overtime_rules(&connection)?,
    })
}

pub fn save_attendance_master_data(
    app: &AppHandle,
    input: AttendanceMasterInput,
) -> Result<AttendanceMasterData, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;

    let shifts = normalize_shifts(input.shifts)?;
    let attendance_codes = normalize_attendance_codes(input.attendance_codes)?;
    let overtime_rules = normalize_overtime_rules(input.overtime_rules)?;

    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;

    for shift in &shifts {
        transaction.execute(
            "
            INSERT INTO work_shifts (
                id, code, name, start_time, end_time, break_minutes, is_off,
                is_active, sort_order, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                code = excluded.code,
                name = excluded.name,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                break_minutes = excluded.break_minutes,
                is_off = excluded.is_off,
                is_active = excluded.is_active,
                sort_order = excluded.sort_order,
                updated_at = datetime('now')
            ",
            params![
                &shift.id,
                &shift.code,
                &shift.name,
                &shift.start_time,
                &shift.end_time,
                shift.break_minutes,
                to_db_bool(shift.is_off),
                to_db_bool(shift.is_active),
                shift.sort_order,
            ],
        )?;
    }

    for code in &attendance_codes {
        transaction.execute(
            "
            INSERT INTO attendance_codes (
                id, code, name, category, counts_as_workday, is_paid,
                is_active, sort_order, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                code = excluded.code,
                name = excluded.name,
                category = excluded.category,
                counts_as_workday = excluded.counts_as_workday,
                is_paid = excluded.is_paid,
                is_active = excluded.is_active,
                sort_order = excluded.sort_order,
                updated_at = datetime('now')
            ",
            params![
                &code.id,
                &code.code,
                &code.name,
                &code.category,
                to_db_bool(code.counts_as_workday),
                to_db_bool(code.is_paid),
                to_db_bool(code.is_active),
                code.sort_order,
            ],
        )?;
    }

    for rule in &overtime_rules {
        transaction.execute(
            "
            INSERT INTO overtime_rules (
                id, code, name, applies_to, multiplier, is_active,
                sort_order, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                code = excluded.code,
                name = excluded.name,
                applies_to = excluded.applies_to,
                multiplier = excluded.multiplier,
                is_active = excluded.is_active,
                sort_order = excluded.sort_order,
                updated_at = datetime('now')
            ",
            params![
                &rule.id,
                &rule.code,
                &rule.name,
                &rule.applies_to,
                rule.multiplier,
                to_db_bool(rule.is_active),
                rule.sort_order,
            ],
        )?;
    }

    transaction.commit()?;
    get_attendance_master_data(app)
}

fn list_work_shifts(connection: &rusqlite::Connection) -> Result<Vec<WorkShift>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, code, name, start_time, end_time, break_minutes, is_off, is_active, sort_order
        FROM work_shifts
        ORDER BY sort_order ASC, name ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(WorkShift {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            start_time: row.get(3)?,
            end_time: row.get(4)?,
            break_minutes: row.get(5)?,
            is_off: read_db_bool(row, 6)?,
            is_active: read_db_bool(row, 7)?,
            sort_order: row.get(8)?,
        })
    })?;

    collect_rows(rows)
}

fn list_attendance_codes(
    connection: &rusqlite::Connection,
) -> Result<Vec<AttendanceCode>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, code, name, category, counts_as_workday, is_paid, is_active, sort_order
        FROM attendance_codes
        ORDER BY sort_order ASC, name ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(AttendanceCode {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            category: row.get(3)?,
            counts_as_workday: read_db_bool(row, 4)?,
            is_paid: read_db_bool(row, 5)?,
            is_active: read_db_bool(row, 6)?,
            sort_order: row.get(7)?,
        })
    })?;

    collect_rows(rows)
}

fn list_overtime_rules(connection: &rusqlite::Connection) -> Result<Vec<OvertimeRule>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, code, name, applies_to, multiplier, is_active, sort_order
        FROM overtime_rules
        ORDER BY sort_order ASC, name ASC
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(OvertimeRule {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            applies_to: row.get(3)?,
            multiplier: row.get(4)?,
            is_active: read_db_bool(row, 5)?,
            sort_order: row.get(6)?,
        })
    })?;

    collect_rows(rows)
}

fn collect_rows<T, F>(rows: rusqlite::MappedRows<'_, F>) -> Result<Vec<T>, AppError>
where
    F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
{
    let mut values = Vec::new();
    for row in rows {
        values.push(row?);
    }

    Ok(values)
}

fn normalize_shifts(shifts: Vec<WorkShift>) -> Result<Vec<WorkShift>, AppError> {
    if shifts.is_empty() {
        return Err(AppError::Database("minimal satu master shift wajib tersedia".to_string()));
    }

    shifts
        .into_iter()
        .map(|shift| {
            let normalized = WorkShift {
                id: shift.id.trim().to_string(),
                code: normalize_code(&shift.code),
                name: shift.name.trim().to_string(),
                start_time: shift.start_time.trim().to_string(),
                end_time: shift.end_time.trim().to_string(),
                break_minutes: shift.break_minutes,
                is_off: shift.is_off,
                is_active: shift.is_active,
                sort_order: shift.sort_order,
            };

            validate_required("ID shift", &normalized.id)?;
            validate_required("kode shift", &normalized.code)?;
            validate_required("nama shift", &normalized.name)?;
            validate_time("jam mulai shift", &normalized.start_time)?;
            validate_time("jam selesai shift", &normalized.end_time)?;
            validate_non_negative("istirahat shift", normalized.break_minutes)?;
            Ok(normalized)
        })
        .collect()
}

fn normalize_attendance_codes(
    codes: Vec<AttendanceCode>,
) -> Result<Vec<AttendanceCode>, AppError> {
    if codes.is_empty() {
        return Err(AppError::Database("minimal satu kode absensi wajib tersedia".to_string()));
    }

    codes
        .into_iter()
        .map(|code| {
            let normalized = AttendanceCode {
                id: code.id.trim().to_string(),
                code: normalize_code(&code.code),
                name: code.name.trim().to_string(),
                category: code.category.trim().to_string(),
                counts_as_workday: code.counts_as_workday,
                is_paid: code.is_paid,
                is_active: code.is_active,
                sort_order: code.sort_order,
            };

            validate_required("ID kode absensi", &normalized.id)?;
            validate_required("kode absensi", &normalized.code)?;
            validate_required("nama kode absensi", &normalized.name)?;
            if !matches!(
                normalized.category.as_str(),
                "present" | "sick" | "leave" | "absence" | "off"
            ) {
                return Err(AppError::Database("kategori absensi tidak valid".to_string()));
            }
            Ok(normalized)
        })
        .collect()
}

fn normalize_overtime_rules(rules: Vec<OvertimeRule>) -> Result<Vec<OvertimeRule>, AppError> {
    if rules.is_empty() {
        return Err(AppError::Database("minimal satu aturan lembur wajib tersedia".to_string()));
    }

    rules
        .into_iter()
        .map(|rule| {
            let normalized = OvertimeRule {
                id: rule.id.trim().to_string(),
                code: normalize_code(&rule.code),
                name: rule.name.trim().to_string(),
                applies_to: rule.applies_to.trim().to_string(),
                multiplier: rule.multiplier,
                is_active: rule.is_active,
                sort_order: rule.sort_order,
            };

            validate_required("ID aturan lembur", &normalized.id)?;
            validate_required("kode lembur", &normalized.code)?;
            validate_required("nama aturan lembur", &normalized.name)?;
            if !matches!(normalized.applies_to.as_str(), "workday" | "holiday") {
                return Err(AppError::Database("cakupan lembur tidak valid".to_string()));
            }
            if normalized.multiplier < 0.0 {
                return Err(AppError::Database("multiplier lembur tidak boleh negatif".to_string()));
            }
            Ok(normalized)
        })
        .collect()
}

fn validate_actor(actor: &AttendanceMasterActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh mengubah master absensi".to_string(),
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

fn validate_time(label: &str, value: &str) -> Result<(), AppError> {
    let bytes = value.as_bytes();
    let has_time_shape = bytes.len() == 5
        && bytes[2] == b':'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 2 || byte.is_ascii_digit());

    if !has_time_shape {
        return Err(AppError::Database(format!("{label} harus memakai format HH:MM")));
    }

    let hour = value[0..2]
        .parse::<u8>()
        .map_err(|_| AppError::Database(format!("{label} tidak valid")))?;
    let minute = value[3..5]
        .parse::<u8>()
        .map_err(|_| AppError::Database(format!("{label} tidak valid")))?;

    if hour > 23 || minute > 59 {
        return Err(AppError::Database(format!("{label} tidak valid")));
    }

    Ok(())
}

fn validate_non_negative(label: &str, value: i32) -> Result<(), AppError> {
    if value < 0 {
        return Err(AppError::Database(format!("{label} tidak boleh negatif")));
    }

    Ok(())
}

fn normalize_code(value: &str) -> String {
    value.trim().to_uppercase().replace(' ', "_")
}

fn read_db_bool(row: &rusqlite::Row<'_>, index: usize) -> rusqlite::Result<bool> {
    let value: i32 = row.get(index)?;
    Ok(value == 1)
}

fn to_db_bool(value: bool) -> i32 {
    if value {
        1
    } else {
        0
    }
}
