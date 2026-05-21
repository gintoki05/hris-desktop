use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::attendance_summary_service;

#[derive(Deserialize)]
pub struct AttendanceSummaryQueryDto {
    period_start: String,
    period_end: String,
}

#[derive(Serialize)]
pub struct AttendanceSummaryDto {
    employee_id: String,
    absence_days: i32,
    leave_days: i32,
    sick_days: i32,
    total_late_minutes: i32,
    total_early_leave_minutes: i32,
    total_overtime_minutes: i32,
}

#[tauri::command]
pub fn list_attendance_summaries_by_period(
    app: AppHandle,
    query: AttendanceSummaryQueryDto,
) -> Result<Vec<AttendanceSummaryDto>, String> {
    attendance_summary_service::list_attendance_summaries_by_period(
        &app,
        attendance_summary_service::AttendanceSummaryQuery {
            period_start: query.period_start,
            period_end: query.period_end,
        },
    )
    .map(|summaries| summaries.into_iter().map(to_summary_dto).collect())
    .map_err(|error| error.user_message())
}

fn to_summary_dto(summary: attendance_summary_service::AttendanceSummary) -> AttendanceSummaryDto {
    AttendanceSummaryDto {
        employee_id: summary.employee_id,
        absence_days: summary.absence_days,
        leave_days: summary.leave_days,
        sick_days: summary.sick_days,
        total_late_minutes: summary.total_late_minutes,
        total_early_leave_minutes: summary.total_early_leave_minutes,
        total_overtime_minutes: summary.total_overtime_minutes,
    }
}
