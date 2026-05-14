use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::payslip_delivery_service;

#[derive(Serialize)]
pub struct PayslipDeliveryQueueItemDto {
    payslip_snapshot_id: String,
    payroll_run_id: String,
    employee_id: String,
    employee_nik: String,
    employee_name: String,
    employee_position: String,
    whatsapp_number: String,
    employee_email: String,
    period_label: String,
    net_pay: i64,
    pdf_file_path: String,
    whatsapp_status: String,
    email_status: String,
    whatsapp_opened_at: Option<String>,
    whatsapp_sent_at: Option<String>,
    whatsapp_failed_at: Option<String>,
    email_sent_at: Option<String>,
    email_failed_at: Option<String>,
    email_provider_message_id: String,
    whatsapp_error_message: String,
    email_error_message: String,
    updated_at: String,
}

#[derive(Deserialize)]
pub struct DeliveryActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct UpdateDeliveryStatusInputDto {
    payslip_snapshot_id: String,
    status: String,
    actor: DeliveryActorDto,
}

#[tauri::command]
pub fn list_payslip_delivery_queue(
    app: AppHandle,
) -> Result<Vec<PayslipDeliveryQueueItemDto>, String> {
    payslip_delivery_service::list_delivery_queue(&app)
        .map(|items| items.into_iter().map(to_queue_item_dto).collect())
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn update_payslip_delivery_status(
    app: AppHandle,
    input: UpdateDeliveryStatusInputDto,
) -> Result<PayslipDeliveryQueueItemDto, String> {
    payslip_delivery_service::update_delivery_status(&app, to_update_input(input))
        .map(to_queue_item_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn send_payslip_email(
    app: AppHandle,
    input: UpdateDeliveryStatusInputDto,
) -> Result<PayslipDeliveryQueueItemDto, String> {
    payslip_delivery_service::send_payslip_email(&app, to_update_input(input))
        .map(to_queue_item_dto)
        .map_err(|error| error.user_message())
}

fn to_update_input(
    input: UpdateDeliveryStatusInputDto,
) -> payslip_delivery_service::UpdateDeliveryStatusInput {
    payslip_delivery_service::UpdateDeliveryStatusInput {
        payslip_snapshot_id: input.payslip_snapshot_id,
        status: input.status,
        actor: payslip_delivery_service::DeliveryActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}

fn to_queue_item_dto(
    item: payslip_delivery_service::PayslipDeliveryQueueItem,
) -> PayslipDeliveryQueueItemDto {
    PayslipDeliveryQueueItemDto {
        payslip_snapshot_id: item.payslip_snapshot_id,
        payroll_run_id: item.payroll_run_id,
        employee_id: item.employee_id,
        employee_nik: item.employee_nik,
        employee_name: item.employee_name,
        employee_position: item.employee_position,
        whatsapp_number: item.whatsapp_number,
        employee_email: item.employee_email,
        period_label: item.period_label,
        net_pay: item.net_pay,
        pdf_file_path: item.pdf_file_path,
        whatsapp_status: item.whatsapp_status,
        email_status: item.email_status,
        whatsapp_opened_at: item.whatsapp_opened_at,
        whatsapp_sent_at: item.whatsapp_sent_at,
        whatsapp_failed_at: item.whatsapp_failed_at,
        email_sent_at: item.email_sent_at,
        email_failed_at: item.email_failed_at,
        email_provider_message_id: item.email_provider_message_id,
        whatsapp_error_message: item.whatsapp_error_message,
        email_error_message: item.email_error_message,
        updated_at: item.updated_at,
    }
}
