use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::payslip_manager_service;

#[derive(Deserialize)]
pub struct PayslipManagerActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct PayslipPeriodInputDto {
    id: Option<String>,
    label: String,
    start_date: String,
    end_date: String,
    actor: PayslipManagerActorDto,
}

#[derive(Serialize)]
pub struct PayslipPeriodDto {
    id: String,
    label: String,
    start_date: String,
    end_date: String,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
pub struct PayslipSnapshotInputDto {
    id: Option<String>,
    employee_id: Option<String>,
    employee_nik: String,
    employee_name: String,
    employee_position: String,
    whatsapp_number: String,
    snapshot_json: String,
    net_pay: i64,
}

#[derive(Deserialize)]
pub struct PayslipImportBatchInputDto {
    period_id: String,
    source_file_name: String,
    total_rows: i64,
    valid_rows: i64,
    error_rows: i64,
    notes: String,
    snapshots: Vec<PayslipSnapshotInputDto>,
    actor: PayslipManagerActorDto,
}

#[derive(Serialize)]
pub struct PayslipImportBatchDto {
    id: String,
    period_id: String,
    source_file_name: String,
    imported_by_display_name: String,
    total_rows: i64,
    valid_rows: i64,
    error_rows: i64,
    notes: String,
    imported_at: String,
}

#[derive(Serialize)]
pub struct PayslipSnapshotDto {
    id: String,
    period_id: String,
    import_batch_id: String,
    employee_id: Option<String>,
    employee_nik: String,
    employee_name: String,
    employee_position: String,
    whatsapp_number: String,
    snapshot_json: String,
    net_pay: i64,
    pdf_file_path: String,
    send_status: String,
    whatsapp_status: String,
    email_status: String,
    whatsapp_opened_at: Option<String>,
    whatsapp_sent_at: Option<String>,
    whatsapp_failed_at: Option<String>,
    email_sent_at: Option<String>,
    email_failed_at: Option<String>,
    email_error_message: String,
    portal_publish_status: String,
    portal_published_at: Option<String>,
    portal_storage_path: String,
    portal_payslip_id: String,
    portal_error_message: String,
    status_updated_at: String,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
pub struct PayslipSnapshotQueryDto {
    period_id: String,
}

#[derive(Deserialize)]
pub struct PayslipSnapshotStatusInputDto {
    snapshot_id: String,
    send_status: String,
    pdf_file_path: Option<String>,
    actor: PayslipManagerActorDto,
}

#[derive(Deserialize)]
pub struct PayslipTemplateExportInputDto {
    target_path: String,
    bytes: Vec<u8>,
    actor: PayslipManagerActorDto,
}

#[derive(Deserialize)]
pub struct PayslipPdfGenerationInputDto {
    period_id: String,
    actor: PayslipManagerActorDto,
}

#[derive(Deserialize)]
pub struct PayslipEmailInputDto {
    snapshot_id: String,
    actor: PayslipManagerActorDto,
}

#[derive(Deserialize)]
pub struct PayslipPeriodDeleteInputDto {
    period_id: String,
    actor: PayslipManagerActorDto,
}

#[derive(Serialize)]
pub struct DeletedPayslipPeriodDto {
    period_id: String,
    deleted_payroll_run_count: i64,
    safety_backup_path: String,
}

#[tauri::command]
pub fn list_payslip_periods(app: AppHandle) -> Result<Vec<PayslipPeriodDto>, String> {
    payslip_manager_service::list_payslip_periods(&app)
        .map(|periods| periods.into_iter().map(to_period_dto).collect())
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn save_payslip_period(
    app: AppHandle,
    input: PayslipPeriodInputDto,
) -> Result<PayslipPeriodDto, String> {
    let actor = to_actor(input.actor);
    let period = payslip_manager_service::PayslipPeriodInput {
        id: input.id,
        label: input.label,
        start_date: input.start_date,
        end_date: input.end_date,
    };

    payslip_manager_service::save_payslip_period(&app, period, actor)
        .map(to_period_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn save_payslip_import_batch(
    app: AppHandle,
    input: PayslipImportBatchInputDto,
) -> Result<PayslipImportBatchDto, String> {
    payslip_manager_service::save_payslip_import_batch(&app, to_import_batch_input(input))
        .map(to_import_batch_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn list_payslip_snapshots(
    app: AppHandle,
    query: PayslipSnapshotQueryDto,
) -> Result<Vec<PayslipSnapshotDto>, String> {
    payslip_manager_service::list_payslip_snapshots(&app, &query.period_id)
        .map(|snapshots| snapshots.into_iter().map(to_snapshot_dto).collect())
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn update_payslip_snapshot_send_status(
    app: AppHandle,
    input: PayslipSnapshotStatusInputDto,
) -> Result<PayslipSnapshotDto, String> {
    payslip_manager_service::update_payslip_snapshot_status(
        &app,
        payslip_manager_service::PayslipSnapshotStatusInput {
            snapshot_id: input.snapshot_id,
            send_status: input.send_status,
            pdf_file_path: input.pdf_file_path,
            actor: to_actor(input.actor),
        },
    )
    .map(to_snapshot_dto)
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn export_payslip_template_file(
    app: AppHandle,
    input: PayslipTemplateExportInputDto,
) -> Result<String, String> {
    payslip_manager_service::export_payslip_template_file(
        &app,
        payslip_manager_service::PayslipTemplateExportInput {
            target_path: input.target_path,
            bytes: input.bytes,
            actor: to_actor(input.actor),
        },
    )
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn generate_payslip_pdfs(
    app: AppHandle,
    input: PayslipPdfGenerationInputDto,
) -> Result<Vec<PayslipSnapshotDto>, String> {
    payslip_manager_service::generate_payslip_pdfs(
        &app,
        payslip_manager_service::PayslipPdfGenerationInput {
            period_id: input.period_id,
            actor: to_actor(input.actor),
        },
    )
    .map(|snapshots| snapshots.into_iter().map(to_snapshot_dto).collect())
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn send_payslip_manager_email(
    app: AppHandle,
    input: PayslipEmailInputDto,
) -> Result<PayslipSnapshotDto, String> {
    payslip_manager_service::send_payslip_email(
        &app,
        payslip_manager_service::PayslipEmailInput {
            snapshot_id: input.snapshot_id,
            actor: to_actor(input.actor),
        },
    )
    .map(to_snapshot_dto)
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn delete_payslip_period(
    app: AppHandle,
    input: PayslipPeriodDeleteInputDto,
) -> Result<DeletedPayslipPeriodDto, String> {
    payslip_manager_service::delete_payslip_period(
        &app,
        payslip_manager_service::PayslipPeriodDeleteInput {
            period_id: input.period_id,
            actor: to_actor(input.actor),
        },
    )
    .map(to_deleted_period_dto)
    .map_err(|error| error.user_message())
}

fn to_import_batch_input(
    input: PayslipImportBatchInputDto,
) -> payslip_manager_service::PayslipImportBatchInput {
    payslip_manager_service::PayslipImportBatchInput {
        period_id: input.period_id,
        source_file_name: input.source_file_name,
        total_rows: input.total_rows,
        valid_rows: input.valid_rows,
        error_rows: input.error_rows,
        notes: input.notes,
        snapshots: input.snapshots.into_iter().map(to_snapshot_input).collect(),
        actor: to_actor(input.actor),
    }
}

fn to_snapshot_input(
    input: PayslipSnapshotInputDto,
) -> payslip_manager_service::PayslipSnapshotInput {
    payslip_manager_service::PayslipSnapshotInput {
        id: input.id,
        employee_id: input.employee_id,
        employee_nik: input.employee_nik,
        employee_name: input.employee_name,
        employee_position: input.employee_position,
        whatsapp_number: input.whatsapp_number,
        snapshot_json: input.snapshot_json,
        net_pay: input.net_pay,
    }
}

fn to_actor(input: PayslipManagerActorDto) -> payslip_manager_service::PayslipManagerActor {
    payslip_manager_service::PayslipManagerActor {
        user_id: input.user_id,
        display_name: input.display_name,
        role: input.role,
    }
}

fn to_period_dto(period: payslip_manager_service::PayslipPeriod) -> PayslipPeriodDto {
    PayslipPeriodDto {
        id: period.id,
        label: period.label,
        start_date: period.start_date,
        end_date: period.end_date,
        status: period.status,
        created_at: period.created_at,
        updated_at: period.updated_at,
    }
}

fn to_import_batch_dto(
    batch: payslip_manager_service::PayslipImportBatch,
) -> PayslipImportBatchDto {
    PayslipImportBatchDto {
        id: batch.id,
        period_id: batch.period_id,
        source_file_name: batch.source_file_name,
        imported_by_display_name: batch.imported_by_display_name,
        total_rows: batch.total_rows,
        valid_rows: batch.valid_rows,
        error_rows: batch.error_rows,
        notes: batch.notes,
        imported_at: batch.imported_at,
    }
}

fn to_snapshot_dto(snapshot: payslip_manager_service::PayslipSnapshot) -> PayslipSnapshotDto {
    PayslipSnapshotDto {
        id: snapshot.id,
        period_id: snapshot.period_id,
        import_batch_id: snapshot.import_batch_id,
        employee_id: snapshot.employee_id,
        employee_nik: snapshot.employee_nik,
        employee_name: snapshot.employee_name,
        employee_position: snapshot.employee_position,
        whatsapp_number: snapshot.whatsapp_number,
        snapshot_json: snapshot.snapshot_json,
        net_pay: snapshot.net_pay,
        pdf_file_path: snapshot.pdf_file_path,
        send_status: snapshot.send_status,
        whatsapp_status: snapshot.whatsapp_status,
        email_status: snapshot.email_status,
        whatsapp_opened_at: snapshot.whatsapp_opened_at,
        whatsapp_sent_at: snapshot.whatsapp_sent_at,
        whatsapp_failed_at: snapshot.whatsapp_failed_at,
        email_sent_at: snapshot.email_sent_at,
        email_failed_at: snapshot.email_failed_at,
        email_error_message: snapshot.email_error_message,
        portal_publish_status: snapshot.portal_publish_status,
        portal_published_at: snapshot.portal_published_at,
        portal_storage_path: snapshot.portal_storage_path,
        portal_payslip_id: snapshot.portal_payslip_id,
        portal_error_message: snapshot.portal_error_message,
        status_updated_at: snapshot.status_updated_at,
        created_at: snapshot.created_at,
        updated_at: snapshot.updated_at,
    }
}

fn to_deleted_period_dto(
    period: payslip_manager_service::DeletedPayslipPeriod,
) -> DeletedPayslipPeriodDto {
    DeletedPayslipPeriodDto {
        period_id: period.period_id,
        deleted_payroll_run_count: period.deleted_payroll_run_count,
        safety_backup_path: period.safety_backup_path,
    }
}
