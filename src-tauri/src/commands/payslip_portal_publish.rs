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

#[derive(Deserialize)]
pub struct PayslipPortalStatusInputDto {
    period_id: String,
    actor: PayslipPortalPublishActorDto,
}

#[derive(Deserialize)]
pub struct EmployeePortalLinkInputDto {
    employee_id: String,
    actor: PayslipPortalPublishActorDto,
}

#[derive(Deserialize)]
pub struct EmployeePortalCreateAccountInputDto {
    employee_id: String,
    temporary_password: String,
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

#[derive(Serialize)]
pub struct PayslipPortalStatusResultDto {
    period_id: String,
    items: Vec<PayslipPortalStatusItemDto>,
}

#[derive(Serialize)]
pub struct PayslipPortalStatusItemDto {
    snapshot_id: String,
    employee_name: String,
    employee_email: String,
    auth_user_status: String,
    employee_profile_status: String,
    payslip_status: String,
    portal_user_id: String,
    employee_profile_id: String,
    portal_payslip_id: String,
    published_at: Option<String>,
    error_message: String,
}

#[derive(Serialize)]
pub struct EmployeePortalLinkResultDto {
    employee_id: String,
    employee_name: String,
    employee_email: String,
    portal_user_id: String,
    employee_profile_id: String,
}

#[derive(Serialize)]
pub struct EmployeePortalStatusResultDto {
    items: Vec<EmployeePortalStatusItemDto>,
}

#[derive(Serialize)]
pub struct EmployeePortalStatusItemDto {
    employee_id: String,
    employee_name: String,
    employee_code_masked: String,
    employee_email: String,
    employee_status: String,
    auth_user_status: String,
    employee_profile_status: String,
    payslip_count: usize,
    latest_payroll_period: String,
    latest_published_at: Option<String>,
    portal_user_id: String,
    employee_profile_id: String,
    issue_message: String,
}

#[derive(Serialize)]
pub struct EmployeePortalCreateAccountResultDto {
    employee_id: String,
    employee_name: String,
    employee_email: String,
    portal_user_id: String,
    employee_profile_id: String,
    account_status: String,
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

#[tauri::command]
pub fn list_payslip_portal_status(
    app: AppHandle,
    input: PayslipPortalStatusInputDto,
) -> Result<PayslipPortalStatusResultDto, String> {
    payslip_portal_publish_service::list_payslip_portal_status(
        &app,
        payslip_portal_publish_service::PayslipPortalStatusInput {
            period_id: input.period_id,
            actor: payslip_portal_publish_service::PayslipPortalPublishActor {
                user_id: input.actor.user_id,
                display_name: input.actor.display_name,
                role: input.actor.role,
            },
        },
    )
    .map(to_status_result_dto)
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn link_employee_portal_user(
    app: AppHandle,
    input: EmployeePortalLinkInputDto,
) -> Result<EmployeePortalLinkResultDto, String> {
    payslip_portal_publish_service::link_employee_portal_user(
        &app,
        payslip_portal_publish_service::EmployeePortalLinkInput {
            employee_id: input.employee_id,
            actor: payslip_portal_publish_service::PayslipPortalPublishActor {
                user_id: input.actor.user_id,
                display_name: input.actor.display_name,
                role: input.actor.role,
            },
        },
    )
    .map(to_link_result_dto)
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn list_employee_portal_status(
    app: AppHandle,
    actor: PayslipPortalPublishActorDto,
) -> Result<EmployeePortalStatusResultDto, String> {
    payslip_portal_publish_service::list_employee_portal_status(
        &app,
        payslip_portal_publish_service::PayslipPortalPublishActor {
            user_id: actor.user_id,
            display_name: actor.display_name,
            role: actor.role,
        },
    )
    .map(to_employee_status_result_dto)
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn create_employee_portal_account(
    app: AppHandle,
    input: EmployeePortalCreateAccountInputDto,
) -> Result<EmployeePortalCreateAccountResultDto, String> {
    payslip_portal_publish_service::create_employee_portal_account(
        &app,
        payslip_portal_publish_service::EmployeePortalCreateAccountInput {
            employee_id: input.employee_id,
            temporary_password: input.temporary_password,
            actor: payslip_portal_publish_service::PayslipPortalPublishActor {
                user_id: input.actor.user_id,
                display_name: input.actor.display_name,
                role: input.actor.role,
            },
        },
    )
    .map(to_create_account_result_dto)
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

fn to_status_result_dto(
    result: payslip_portal_publish_service::PayslipPortalStatusResult,
) -> PayslipPortalStatusResultDto {
    PayslipPortalStatusResultDto {
        period_id: result.period_id,
        items: result.items.into_iter().map(to_status_item_dto).collect(),
    }
}

fn to_status_item_dto(
    item: payslip_portal_publish_service::PayslipPortalStatusItem,
) -> PayslipPortalStatusItemDto {
    PayslipPortalStatusItemDto {
        snapshot_id: item.snapshot_id,
        employee_name: item.employee_name,
        employee_email: item.employee_email,
        auth_user_status: item.auth_user_status,
        employee_profile_status: item.employee_profile_status,
        payslip_status: item.payslip_status,
        portal_user_id: item.portal_user_id,
        employee_profile_id: item.employee_profile_id,
        portal_payslip_id: item.portal_payslip_id,
        published_at: item.published_at,
        error_message: item.error_message,
    }
}

fn to_link_result_dto(
    result: payslip_portal_publish_service::EmployeePortalLinkResult,
) -> EmployeePortalLinkResultDto {
    EmployeePortalLinkResultDto {
        employee_id: result.employee_id,
        employee_name: result.employee_name,
        employee_email: result.employee_email,
        portal_user_id: result.portal_user_id,
        employee_profile_id: result.employee_profile_id,
    }
}

fn to_employee_status_result_dto(
    result: payslip_portal_publish_service::EmployeePortalStatusResult,
) -> EmployeePortalStatusResultDto {
    EmployeePortalStatusResultDto {
        items: result.items.into_iter().map(to_employee_status_item_dto).collect(),
    }
}

fn to_employee_status_item_dto(
    item: payslip_portal_publish_service::EmployeePortalStatusItem,
) -> EmployeePortalStatusItemDto {
    EmployeePortalStatusItemDto {
        employee_id: item.employee_id,
        employee_name: item.employee_name,
        employee_code_masked: item.employee_code_masked,
        employee_email: item.employee_email,
        employee_status: item.employee_status,
        auth_user_status: item.auth_user_status,
        employee_profile_status: item.employee_profile_status,
        payslip_count: item.payslip_count,
        latest_payroll_period: item.latest_payroll_period,
        latest_published_at: item.latest_published_at,
        portal_user_id: item.portal_user_id,
        employee_profile_id: item.employee_profile_id,
        issue_message: item.issue_message,
    }
}

fn to_create_account_result_dto(
    result: payslip_portal_publish_service::EmployeePortalCreateAccountResult,
) -> EmployeePortalCreateAccountResultDto {
    EmployeePortalCreateAccountResultDto {
        employee_id: result.employee_id,
        employee_name: result.employee_name,
        employee_email: result.employee_email,
        portal_user_id: result.portal_user_id,
        employee_profile_id: result.employee_profile_id,
        account_status: result.account_status,
    }
}
