use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::payslip_portal_publish_service;

#[derive(Deserialize)]
pub struct PayslipPortalPublishActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct PayslipPortalPublishInputDto {
    period_id: String,
    actor: PayslipPortalPublishActorDto,
}

#[derive(Serialize)]
pub struct PayslipPortalPublishResultDto {
    period_id: String,
    attempted_count: usize,
    published_count: usize,
    failed_count: usize,
    items: Vec<PayslipPortalPublishItemResultDto>,
}

#[derive(Serialize)]
pub struct PayslipPortalPublishItemResultDto {
    snapshot_id: String,
    employee_name: String,
    status: String,
    storage_path: String,
    error_message: String,
}

#[tauri::command]
pub fn publish_final_payslips_to_portal(
    app: AppHandle,
    input: PayslipPortalPublishInputDto,
) -> Result<PayslipPortalPublishResultDto, String> {
    payslip_portal_publish_service::publish_final_payslips_to_portal(
        &app,
        payslip_portal_publish_service::PayslipPortalPublishInput {
            period_id: input.period_id,
            actor: payslip_portal_publish_service::PayslipPortalPublishActor {
                user_id: input.actor.user_id,
                display_name: input.actor.display_name,
                role: input.actor.role,
            },
        },
    )
    .map(to_result_dto)
    .map_err(|error| error.user_message())
}

fn to_result_dto(
    result: payslip_portal_publish_service::PayslipPortalPublishResult,
) -> PayslipPortalPublishResultDto {
    PayslipPortalPublishResultDto {
        period_id: result.period_id,
        attempted_count: result.attempted_count,
        published_count: result.published_count,
        failed_count: result.failed_count,
        items: result.items.into_iter().map(to_item_dto).collect(),
    }
}

fn to_item_dto(
    item: payslip_portal_publish_service::PayslipPortalPublishItemResult,
) -> PayslipPortalPublishItemResultDto {
    PayslipPortalPublishItemResultDto {
        snapshot_id: item.snapshot_id,
        employee_name: item.employee_name,
        status: item.status,
        storage_path: item.storage_path,
        error_message: item.error_message,
    }
}
