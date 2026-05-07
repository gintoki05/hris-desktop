use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::attendance_import_service;

#[derive(Serialize)]
pub struct AttendanceImportBatchDto {
    id: String,
    source_file_name: String,
    imported_at: String,
    imported_by: String,
    total_rows: i32,
}

#[derive(Deserialize)]
pub struct AttendanceImportInputDto {
    source_file_name: String,
    sheet_name: String,
    rows: Vec<AttendanceImportRowInputDto>,
    actor: AttendanceImportActorDto,
}

#[derive(Deserialize)]
pub struct AttendanceImportActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct AttendanceImportRowInputDto {
    source_row_number: i32,
    employee_id: Option<String>,
    employee_nik: String,
    employee_name: String,
    work_date: String,
    clock_in: Option<String>,
    clock_out: Option<String>,
    raw_payload_json: String,
    status: String,
    error_message: String,
}

#[tauri::command]
pub fn save_attendance_import_batch(
    app: AppHandle,
    input: AttendanceImportInputDto,
) -> Result<AttendanceImportBatchDto, String> {
    attendance_import_service::save_attendance_import_batch(&app, to_input(input))
        .map(to_batch_dto)
        .map_err(|error| error.user_message())
}

fn to_input(input: AttendanceImportInputDto) -> attendance_import_service::AttendanceImportInput {
    attendance_import_service::AttendanceImportInput {
        source_file_name: input.source_file_name,
        sheet_name: input.sheet_name,
        rows: input.rows.into_iter().map(to_row_input).collect(),
        actor: attendance_import_service::AttendanceImportActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}

fn to_row_input(
    row: AttendanceImportRowInputDto,
) -> attendance_import_service::AttendanceImportRowInput {
    attendance_import_service::AttendanceImportRowInput {
        source_row_number: row.source_row_number,
        employee_id: row.employee_id,
        employee_nik: row.employee_nik,
        employee_name: row.employee_name,
        work_date: row.work_date,
        clock_in: row.clock_in,
        clock_out: row.clock_out,
        raw_payload_json: row.raw_payload_json,
        status: row.status,
        error_message: row.error_message,
    }
}

fn to_batch_dto(
    batch: attendance_import_service::AttendanceImportBatch,
) -> AttendanceImportBatchDto {
    AttendanceImportBatchDto {
        id: batch.id,
        source_file_name: batch.source_file_name,
        imported_at: batch.imported_at,
        imported_by: batch.imported_by,
        total_rows: batch.total_rows,
    }
}
