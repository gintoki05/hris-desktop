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
    logo_data_url: String,
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
pub struct EmailDeliverySettingsDto {
    provider: String,
    enabled: bool,
    resend_api_key_set: bool,
    from_name: String,
    from_email: String,
    reply_to_email: String,
}

#[derive(Serialize)]
pub struct PortalPublishSettingsDto {
    enabled: bool,
    payslips_enabled: bool,
    owner_summary_enabled: bool,
    supabase_url: String,
    supabase_secret_key_set: bool,
}

#[derive(Serialize)]
pub struct MasterSettingsDto {
    company: CompanySettingsDto,
    payroll: PayrollSettingsDto,
    email_delivery: EmailDeliverySettingsDto,
    portal_publish: PortalPublishSettingsDto,
    recent_audit_events: Vec<SettingsAuditEventDto>,
}

#[derive(Deserialize)]
pub struct CompanySettingsInputDto {
    company_name: String,
    address: String,
    contact_phone: String,
    contact_email: String,
    treasurer_name: String,
    logo_data_url: String,
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
pub struct EmailDeliverySettingsInputDto {
    provider: String,
    enabled: bool,
    resend_api_key: String,
    from_name: String,
    from_email: String,
    reply_to_email: String,
}

#[derive(Deserialize)]
pub struct PortalPublishSettingsInputDto {
    enabled: bool,
    payslips_enabled: bool,
    owner_summary_enabled: bool,
    supabase_url: String,
    supabase_secret_key: String,
}

#[derive(Deserialize)]
pub struct MasterSettingsInputDto {
    company: CompanySettingsInputDto,
    payroll: PayrollSettingsInputDto,
    email_delivery: EmailDeliverySettingsInputDto,
    portal_publish: PortalPublishSettingsInputDto,
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
            logo_data_url: settings.company.logo_data_url,
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
        email_delivery: EmailDeliverySettingsDto {
            provider: settings.email_delivery.provider,
            enabled: settings.email_delivery.enabled,
            resend_api_key_set: settings.email_delivery.resend_api_key_set,
            from_name: settings.email_delivery.from_name,
            from_email: settings.email_delivery.from_email,
            reply_to_email: settings.email_delivery.reply_to_email,
        },
        portal_publish: PortalPublishSettingsDto {
            enabled: settings.portal_publish.enabled,
            payslips_enabled: settings.portal_publish.payslips_enabled,
            owner_summary_enabled: settings.portal_publish.owner_summary_enabled,
            supabase_url: settings.portal_publish.supabase_url,
            supabase_secret_key_set: settings.portal_publish.supabase_secret_key_set,
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
            logo_data_url: input.company.logo_data_url,
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
        email_delivery: settings_service::EmailDeliverySettingsInput {
            provider: input.email_delivery.provider,
            enabled: input.email_delivery.enabled,
            resend_api_key: input.email_delivery.resend_api_key,
            from_name: input.email_delivery.from_name,
            from_email: input.email_delivery.from_email,
            reply_to_email: input.email_delivery.reply_to_email,
        },
        portal_publish: settings_service::PortalPublishSettingsInput {
            enabled: input.portal_publish.enabled,
            payslips_enabled: input.portal_publish.payslips_enabled,
            owner_summary_enabled: input.portal_publish.owner_summary_enabled,
            supabase_url: input.portal_publish.supabase_url,
            supabase_secret_key: input.portal_publish.supabase_secret_key,
        },
        actor: settings_service::SettingsActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}
