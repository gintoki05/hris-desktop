use rusqlite::params;
use serde::Serialize;
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

#[derive(Serialize)]
pub struct AttendanceSummary {
    pub employee_id: String,
    pub absence_days: i32,
    pub leave_days: i32,
    pub sick_days: i32,
    pub total_late_minutes: i32,
    pub total_early_leave_minutes: i32,
    pub total_overtime_minutes: i32,
}

pub struct AttendanceSummaryQuery {
    pub period_start: String,
    pub period_end: String,
}

pub fn list_attendance_summaries_by_period(
    app: &AppHandle,
    query: AttendanceSummaryQuery,
) -> Result<Vec<AttendanceSummary>, AppError> {
    database_service::initialize_local_database(app)?;
    validate_query(&query)?;

    let connection = database_service::open_local_connection(app)?;
    let mut statement = connection.prepare(
        "
        SELECT
            employee_id,
            SUM(CASE WHEN status = 'absence' THEN 1 ELSE 0 END) AS absence_days,
            SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) AS leave_days,
            SUM(CASE WHEN status = 'sick' THEN 1 ELSE 0 END) AS sick_days,
            SUM(minutes_late) AS total_late_minutes,
            SUM(minutes_early_leave) AS total_early_leave_minutes,
            SUM(overtime_minutes) AS total_overtime_minutes
        FROM attendance_entries
        WHERE work_date >= ?1 AND work_date <= ?2
        GROUP BY employee_id
        ORDER BY employee_id ASC
        ",
    )?;

    let rows = statement.query_map(
        params![query.period_start.trim(), query.period_end.trim()],
        |row| {
            Ok(AttendanceSummary {
                employee_id: row.get(0)?,
                absence_days: row.get(1)?,
                leave_days: row.get(2)?,
                sick_days: row.get(3)?,
                total_late_minutes: row.get(4)?,
                total_early_leave_minutes: row.get(5)?,
                total_overtime_minutes: row.get(6)?,
            })
        },
    )?;

    let mut summaries = Vec::new();
    for row in rows {
        summaries.push(row?);
    }

    Ok(summaries)
}

fn validate_query(query: &AttendanceSummaryQuery) -> Result<(), AppError> {
    let period_start = query.period_start.trim();
    let period_end = query.period_end.trim();

    if period_start.is_empty() || period_end.is_empty() {
        return Err(AppError::Database(
            "periode mulai dan selesai absensi wajib diisi".to_string(),
        ));
    }

    if period_start > period_end {
        return Err(AppError::Database(
            "periode mulai absensi tidak boleh setelah periode selesai".to_string(),
        ));
    }

    Ok(())
}
