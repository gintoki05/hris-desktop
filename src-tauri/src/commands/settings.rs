use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::settings_service;

#[derive(Serialize)]
pub struct CompanySettingsDto {
    company_name: String,
    address: String,
    contact_phone: String,
    contact_email: String,
    treasurer_name: String,
}

#[derive(Serialize)]
pub struct PayrollSettingsDto {
    current_year: i32,
    payday_type: String,
    payday_day_of_month: Option<i32>,
    payday_weekday: Option<String>,
    working_days_per_week: i32,
    late_tolerance_minutes: i32,
    late_penalty_amount: i64,
    early_leave_tolerance_minutes: i32,
    early_leave_penalty_amount: i64,
}

#[derive(Serialize)]
pub struct SettingsAuditEventDto {
    id: String,
    actor_display_name: String,
    actor_role: String,
    change_summary: String,
    created_at: String,
}

#[derive(Serialize)]
pub struct MasterSettingsDto {
    company: CompanySettingsDto,
    payroll: PayrollSettingsDto,
    recent_audit_events: Vec<SettingsAuditEventDto>,
}

#[derive(Deserialize)]
pub struct CompanySettingsInputDto {
    company_name: String,
    address: String,
    contact_phone: String,
    contact_email: String,
    treasurer_name: String,
}

#[derive(Deserialize)]
pub struct PayrollSettingsInputDto {
    current_year: i32,
    payday_type: String,
    payday_day_of_month: Option<i32>,
    payday_weekday: Option<String>,
    working_days_per_week: i32,
    late_tolerance_minutes: i32,
    late_penalty_amount: i64,
    early_leave_tolerance_minutes: i32,
    early_leave_penalty_amount: i64,
}

#[derive(Deserialize)]
pub struct SettingsActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct MasterSettingsInputDto {
    company: CompanySettingsInputDto,
    payroll: PayrollSettingsInputDto,
    actor: SettingsActorDto,
}

#[tauri::command]
pub fn get_master_settings(app: AppHandle) -> Result<MasterSettingsDto, String> {
    settings_service::get_master_settings(&app)
        .map(to_master_settings_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn update_master_settings(
    app: AppHandle,
    input: MasterSettingsInputDto,
) -> Result<MasterSettingsDto, String> {
    settings_service::update_master_settings(&app, to_master_settings_input(input))
        .map(to_master_settings_dto)
        .map_err(|error| error.user_message())
}

fn to_master_settings_dto(settings: settings_service::MasterSettings) -> MasterSettingsDto {
    MasterSettingsDto {
        company: CompanySettingsDto {
            company_name: settings.company.company_name,
            address: settings.company.address,
            contact_phone: settings.company.contact_phone,
            contact_email: settings.company.contact_email,
            treasurer_name: settings.company.treasurer_name,
        },
        payroll: PayrollSettingsDto {
            current_year: settings.payroll.current_year,
            payday_type: settings.payroll.payday_type,
            payday_day_of_month: settings.payroll.payday_day_of_month,
            payday_weekday: settings.payroll.payday_weekday,
            working_days_per_week: settings.payroll.working_days_per_week,
            late_tolerance_minutes: settings.payroll.late_tolerance_minutes,
            late_penalty_amount: settings.payroll.late_penalty_amount,
            early_leave_tolerance_minutes: settings.payroll.early_leave_tolerance_minutes,
            early_leave_penalty_amount: settings.payroll.early_leave_penalty_amount,
        },
        recent_audit_events: settings
            .recent_audit_events
            .into_iter()
            .map(|event| SettingsAuditEventDto {
                id: event.id,
                actor_display_name: event.actor_display_name,
                actor_role: event.actor_role,
                change_summary: event.change_summary,
                created_at: event.created_at,
            })
            .collect(),
    }
}

fn to_master_settings_input(
    input: MasterSettingsInputDto,
) -> settings_service::MasterSettingsInput {
    settings_service::MasterSettingsInput {
        company: settings_service::CompanySettingsInput {
            company_name: input.company.company_name,
            address: input.company.address,
            contact_phone: input.company.contact_phone,
            contact_email: input.company.contact_email,
            treasurer_name: input.company.treasurer_name,
        },
        payroll: settings_service::PayrollSettingsInput {
            current_year: input.payroll.current_year,
            payday_type: input.payroll.payday_type,
            payday_day_of_month: input.payroll.payday_day_of_month,
            payday_weekday: input.payroll.payday_weekday,
            working_days_per_week: input.payroll.working_days_per_week,
            late_tolerance_minutes: input.payroll.late_tolerance_minutes,
            late_penalty_amount: input.payroll.late_penalty_amount,
            early_leave_tolerance_minutes: input.payroll.early_leave_tolerance_minutes,
            early_leave_penalty_amount: input.payroll.early_leave_penalty_amount,
        },
        actor: settings_service::SettingsActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}
