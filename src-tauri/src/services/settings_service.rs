use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

const DEFAULT_SETTINGS_ID: &str = "default";
const MAX_LOGO_DATA_URL_LENGTH: usize = 700_000;

#[derive(Clone, PartialEq, Serialize)]
pub struct CompanySettings {
    pub company_name: String,
    pub address: String,
    pub contact_phone: String,
    pub contact_email: String,
    pub treasurer_name: String,
    pub logo_data_url: String,
}

#[derive(Clone, PartialEq, Serialize)]
pub struct PayrollSettings {
    pub current_year: i32,
    pub payday_type: String,
    pub payday_day_of_month: Option<i32>,
    pub payday_weekday: Option<String>,
    pub working_days_per_week: i32,
    pub late_tolerance_minutes: i32,
    pub late_penalty_amount: i64,
    pub early_leave_tolerance_minutes: i32,
    pub early_leave_penalty_amount: i64,
}

#[derive(Clone, Serialize)]
pub struct SettingsAuditEvent {
    pub id: String,
    pub actor_display_name: String,
    pub actor_role: String,
    pub change_summary: String,
    pub created_at: String,
}

#[derive(Clone, PartialEq, Serialize)]
pub struct EmailDeliverySettings {
    pub provider: String,
    pub enabled: bool,
    pub resend_api_key_set: bool,
    pub from_name: String,
    pub from_email: String,
    pub reply_to_email: String,
}

#[derive(Clone, PartialEq, Serialize)]
pub struct PortalPublishSettings {
    pub enabled: bool,
    pub supabase_url: String,
    pub supabase_secret_key_set: bool,
}

#[derive(Clone)]
pub struct StoredEmailDeliverySettings {
    pub provider: String,
    pub enabled: bool,
    pub resend_api_key: String,
    pub from_name: String,
    pub from_email: String,
    pub reply_to_email: String,
}

#[derive(Clone)]
pub struct StoredPortalPublishSettings {
    pub enabled: bool,
    pub supabase_url: String,
    pub supabase_secret_key: String,
}

#[derive(Serialize)]
pub struct MasterSettings {
    pub company: CompanySettings,
    pub payroll: PayrollSettings,
    pub email_delivery: EmailDeliverySettings,
    pub portal_publish: PortalPublishSettings,
    pub recent_audit_events: Vec<SettingsAuditEvent>,
}

#[derive(Deserialize)]
pub struct CompanySettingsInput {
    pub company_name: String,
    pub address: String,
    pub contact_phone: String,
    pub contact_email: String,
    pub treasurer_name: String,
    pub logo_data_url: String,
}

#[derive(Deserialize)]
pub struct PayrollSettingsInput {
    pub current_year: i32,
    pub payday_type: String,
    pub payday_day_of_month: Option<i32>,
    pub payday_weekday: Option<String>,
    pub working_days_per_week: i32,
    pub late_tolerance_minutes: i32,
    pub late_penalty_amount: i64,
    pub early_leave_tolerance_minutes: i32,
    pub early_leave_penalty_amount: i64,
}

#[derive(Deserialize)]
pub struct SettingsActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct EmailDeliverySettingsInput {
    pub provider: String,
    pub enabled: bool,
    pub resend_api_key: String,
    pub from_name: String,
    pub from_email: String,
    pub reply_to_email: String,
}

#[derive(Deserialize)]
pub struct PortalPublishSettingsInput {
    pub enabled: bool,
    pub supabase_url: String,
    pub supabase_secret_key: String,
}

#[derive(Deserialize)]
pub struct MasterSettingsInput {
    pub company: CompanySettingsInput,
    pub payroll: PayrollSettingsInput,
    pub email_delivery: EmailDeliverySettingsInput,
    pub portal_publish: PortalPublishSettingsInput,
    pub actor: SettingsActor,
}

pub fn get_master_settings(app: &AppHandle) -> Result<MasterSettings, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;

    Ok(MasterSettings {
        company: get_company_settings(&connection)?,
        payroll: get_payroll_settings(&connection)?,
        email_delivery: public_email_delivery_settings(&get_stored_email_delivery_settings(&connection)?),
        portal_publish: public_portal_publish_settings(&get_stored_portal_publish_settings(&connection)?),
        recent_audit_events: list_recent_audit_events(&connection)?,
    })
}

pub fn update_master_settings(
    app: &AppHandle,
    input: MasterSettingsInput,
) -> Result<MasterSettings, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;

    let company = normalize_company_input(input.company)?;
    let payroll = normalize_payroll_input(input.payroll)?;

    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;

    let previous_company = get_company_settings(&transaction)?;
    let previous_payroll = get_payroll_settings(&transaction)?;
    let previous_email_delivery = get_stored_email_delivery_settings(&transaction)?;
    let previous_portal_publish = get_stored_portal_publish_settings(&transaction)?;
    let email_delivery = normalize_email_delivery_input(input.email_delivery, &previous_email_delivery)?;
    let portal_publish =
        normalize_portal_publish_input(input.portal_publish, &previous_portal_publish)?;
    let changed_fields = changed_field_names(
        &previous_company,
        &company,
        &previous_payroll,
        &payroll,
        &public_email_delivery_settings(&previous_email_delivery),
        &public_email_delivery_settings(&email_delivery),
        &previous_portal_publish,
        &portal_publish,
    );

    transaction.execute(
        "
        UPDATE company_settings
        SET
            company_name = ?1,
            address = ?2,
            contact_phone = ?3,
            contact_email = ?4,
            treasurer_name = ?5,
            logo_data_url = ?6,
            updated_at = datetime('now')
        WHERE id = ?7
        ",
        (
            &company.company_name,
            &company.address,
            &company.contact_phone,
            &company.contact_email,
            &company.treasurer_name,
            &company.logo_data_url,
            DEFAULT_SETTINGS_ID,
        ),
    )?;

    transaction.execute(
        "
        UPDATE payroll_settings
        SET
            current_year = ?1,
            payday_type = ?2,
            payday_day_of_month = ?3,
            payday_weekday = ?4,
            working_days_per_week = ?5,
            late_tolerance_minutes = ?6,
            late_penalty_amount = ?7,
            early_leave_tolerance_minutes = ?8,
            early_leave_penalty_amount = ?9,
            updated_at = datetime('now')
        WHERE id = ?10
        ",
        (
            payroll.current_year,
            &payroll.payday_type,
            payroll.payday_day_of_month,
            payroll.payday_weekday.as_deref(),
            payroll.working_days_per_week,
            payroll.late_tolerance_minutes,
            payroll.late_penalty_amount,
            payroll.early_leave_tolerance_minutes,
            payroll.early_leave_penalty_amount,
            DEFAULT_SETTINGS_ID,
        ),
    )?;

    transaction.execute(
        "
        UPDATE email_delivery_settings
        SET
            provider = ?1,
            enabled = ?2,
            resend_api_key = ?3,
            from_name = ?4,
            from_email = ?5,
            reply_to_email = ?6,
            updated_at = datetime('now')
        WHERE id = ?7
        ",
        (
            &email_delivery.provider,
            if email_delivery.enabled { 1 } else { 0 },
            &email_delivery.resend_api_key,
            &email_delivery.from_name,
            &email_delivery.from_email,
            &email_delivery.reply_to_email,
            DEFAULT_SETTINGS_ID,
        ),
    )?;

    transaction.execute(
        "
        UPDATE portal_publish_settings
        SET
            enabled = ?1,
            supabase_url = ?2,
            supabase_secret_key = ?3,
            updated_at = datetime('now')
        WHERE id = ?4
        ",
        (
            if portal_publish.enabled { 1 } else { 0 },
            &portal_publish.supabase_url,
            &portal_publish.supabase_secret_key,
            DEFAULT_SETTINGS_ID,
        ),
    )?;

    let change_summary = if changed_fields.is_empty() {
        "Tidak ada perubahan nilai setting.".to_string()
    } else {
        format!("Field diperbarui: {}.", changed_fields.join(", "))
    };

    transaction.execute(
        "
        INSERT INTO settings_audit_events (
            id,
            setting_scope,
            actor_user_id,
            actor_display_name,
            actor_role,
            change_summary,
            created_at
        )
        VALUES (?1, 'master_settings', ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        ",
        (
            create_audit_id()?,
            &input.actor.user_id,
            &input.actor.display_name,
            &input.actor.role,
            &change_summary,
        ),
    )?;

    transaction.commit()?;
    get_master_settings(app)
}

pub fn get_resend_delivery_settings(app: &AppHandle) -> Result<StoredEmailDeliverySettings, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    get_stored_email_delivery_settings(&connection)
}

pub fn get_portal_publish_settings(app: &AppHandle) -> Result<StoredPortalPublishSettings, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    get_stored_portal_publish_settings(&connection)
}

fn get_company_settings(connection: &rusqlite::Connection) -> Result<CompanySettings, AppError> {
    connection
        .query_row(
            "
            SELECT company_name, address, contact_phone, contact_email, treasurer_name, logo_data_url
            FROM company_settings
            WHERE id = ?1
            ",
            [DEFAULT_SETTINGS_ID],
            |row| {
                Ok(CompanySettings {
                    company_name: row.get(0)?,
                    address: row.get(1)?,
                    contact_phone: row.get(2)?,
                    contact_email: row.get(3)?,
                    treasurer_name: row.get(4)?,
                    logo_data_url: row.get(5)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Database("setting perusahaan default tidak ditemukan".to_string()))
}

fn get_payroll_settings(connection: &rusqlite::Connection) -> Result<PayrollSettings, AppError> {
    connection
        .query_row(
            "
            SELECT
                current_year,
                payday_type,
                payday_day_of_month,
                payday_weekday,
                working_days_per_week,
                late_tolerance_minutes,
                late_penalty_amount,
                early_leave_tolerance_minutes,
                early_leave_penalty_amount
            FROM payroll_settings
            WHERE id = ?1
            ",
            [DEFAULT_SETTINGS_ID],
            |row| {
                Ok(PayrollSettings {
                    current_year: row.get(0)?,
                    payday_type: row.get(1)?,
                    payday_day_of_month: row.get(2)?,
                    payday_weekday: row.get(3)?,
                    working_days_per_week: row.get(4)?,
                    late_tolerance_minutes: row.get(5)?,
                    late_penalty_amount: row.get(6)?,
                    early_leave_tolerance_minutes: row.get(7)?,
                    early_leave_penalty_amount: row.get(8)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Database("aturan payroll default tidak ditemukan".to_string()))
}

fn get_stored_email_delivery_settings(
    connection: &rusqlite::Connection,
) -> Result<StoredEmailDeliverySettings, AppError> {
    connection
        .query_row(
            "
            SELECT provider, enabled, resend_api_key, from_name, from_email, reply_to_email
            FROM email_delivery_settings
            WHERE id = ?1
            ",
            [DEFAULT_SETTINGS_ID],
            |row| {
                let enabled: i32 = row.get(1)?;
                Ok(StoredEmailDeliverySettings {
                    provider: row.get(0)?,
                    enabled: enabled == 1,
                    resend_api_key: row.get(2)?,
                    from_name: row.get(3)?,
                    from_email: row.get(4)?,
                    reply_to_email: row.get(5)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Database("setting email delivery default tidak ditemukan".to_string()))
}

fn get_stored_portal_publish_settings(
    connection: &rusqlite::Connection,
) -> Result<StoredPortalPublishSettings, AppError> {
    connection
        .query_row(
            "
            SELECT enabled, supabase_url, supabase_secret_key
            FROM portal_publish_settings
            WHERE id = ?1
            ",
            [DEFAULT_SETTINGS_ID],
            |row| {
                let enabled: i32 = row.get(0)?;
                Ok(StoredPortalPublishSettings {
                    enabled: enabled == 1,
                    supabase_url: row.get(1)?,
                    supabase_secret_key: row.get(2)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Database("setting Portal ESS default tidak ditemukan".to_string()))
}

fn public_email_delivery_settings(settings: &StoredEmailDeliverySettings) -> EmailDeliverySettings {
    EmailDeliverySettings {
        provider: settings.provider.clone(),
        enabled: settings.enabled,
        resend_api_key_set: !settings.resend_api_key.trim().is_empty(),
        from_name: settings.from_name.clone(),
        from_email: settings.from_email.clone(),
        reply_to_email: settings.reply_to_email.clone(),
    }
}

fn public_portal_publish_settings(settings: &StoredPortalPublishSettings) -> PortalPublishSettings {
    PortalPublishSettings {
        enabled: settings.enabled,
        supabase_url: settings.supabase_url.clone(),
        supabase_secret_key_set: !settings.supabase_secret_key.trim().is_empty(),
    }
}

fn list_recent_audit_events(
    connection: &rusqlite::Connection,
) -> Result<Vec<SettingsAuditEvent>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, actor_display_name, actor_role, change_summary, created_at
        FROM settings_audit_events
        WHERE setting_scope = 'master_settings'
        ORDER BY created_at DESC
        LIMIT 5
        ",
    )?;

    let rows = statement.query_map([], |row| {
        Ok(SettingsAuditEvent {
            id: row.get(0)?,
            actor_display_name: row.get(1)?,
            actor_role: row.get(2)?,
            change_summary: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row?);
    }

    Ok(events)
}

fn normalize_company_input(input: CompanySettingsInput) -> Result<CompanySettings, AppError> {
    let company = CompanySettings {
        company_name: input.company_name.trim().to_string(),
        address: input.address.trim().to_string(),
        contact_phone: input.contact_phone.trim().to_string(),
        contact_email: input.contact_email.trim().to_string(),
        treasurer_name: input.treasurer_name.trim().to_string(),
        logo_data_url: input.logo_data_url.trim().to_string(),
    };

    if company.company_name.is_empty() {
        return Err(AppError::Database(
            "nama perusahaan wajib diisi sebelum setting disimpan".to_string(),
        ));
    }

    validate_logo_data_url(&company.logo_data_url)?;

    Ok(company)
}

fn validate_logo_data_url(value: &str) -> Result<(), AppError> {
    if value.is_empty() {
        return Ok(());
    }

    if value.len() > MAX_LOGO_DATA_URL_LENGTH {
        return Err(AppError::Database(
            "ukuran logo terlalu besar untuk disimpan di database lokal".to_string(),
        ));
    }

    if value.starts_with("data:image/png;base64,")
        || value.starts_with("data:image/jpeg;base64,")
        || value.starts_with("data:image/webp;base64,")
    {
        return Ok(());
    }

    Err(AppError::Database(
        "format logo harus PNG, JPG, atau WebP".to_string(),
    ))
}

fn normalize_payroll_input(input: PayrollSettingsInput) -> Result<PayrollSettings, AppError> {
    if input.current_year < 2020 || input.current_year > 2100 {
        return Err(AppError::Database(
            "tahun berjalan harus berada di rentang 2020 sampai 2100".to_string(),
        ));
    }

    if input.working_days_per_week < 1 || input.working_days_per_week > 7 {
        return Err(AppError::Database(
            "aturan hari kerja harus berada di rentang 1 sampai 7 hari per minggu".to_string(),
        ));
    }

    let payday_weekday = input.payday_weekday.map(|value| value.trim().to_string());
    let payroll = PayrollSettings {
        current_year: input.current_year,
        payday_type: input.payday_type.trim().to_string(),
        payday_day_of_month: input.payday_day_of_month,
        payday_weekday,
        working_days_per_week: input.working_days_per_week,
        late_tolerance_minutes: input.late_tolerance_minutes,
        late_penalty_amount: input.late_penalty_amount,
        early_leave_tolerance_minutes: input.early_leave_tolerance_minutes,
        early_leave_penalty_amount: input.early_leave_penalty_amount,
    };

    validate_payday(&payroll)?;
    validate_non_negative("toleransi telat", payroll.late_tolerance_minutes)?;
    validate_non_negative("denda telat", payroll.late_penalty_amount)?;
    validate_non_negative(
        "toleransi pulang cepat",
        payroll.early_leave_tolerance_minutes,
    )?;
    validate_non_negative("denda pulang cepat", payroll.early_leave_penalty_amount)?;

    Ok(payroll)
}

fn normalize_email_delivery_input(
    input: EmailDeliverySettingsInput,
    previous: &StoredEmailDeliverySettings,
) -> Result<StoredEmailDeliverySettings, AppError> {
    let _requested_enabled = input.enabled;
    let api_key = if input.resend_api_key.trim().is_empty() {
        previous.resend_api_key.clone()
    } else {
        input.resend_api_key.trim().to_string()
    };
    let settings = StoredEmailDeliverySettings {
        provider: input.provider.trim().to_string(),
        enabled: false,
        resend_api_key: api_key,
        from_name: input.from_name.trim().to_string(),
        from_email: input.from_email.trim().to_lowercase(),
        reply_to_email: input.reply_to_email.trim().to_lowercase(),
    };

    if settings.provider != "resend" {
        return Err(AppError::Database("provider email delivery tidak valid".to_string()));
    }

    if settings.enabled {
        if settings.resend_api_key.is_empty() {
            return Err(AppError::Database("API key Resend wajib diisi".to_string()));
        }
        validate_required("nama pengirim email", &settings.from_name)?;
        validate_required("email pengirim", &settings.from_email)?;
        validate_optional_email("email pengirim", &settings.from_email)?;
        validate_optional_email("reply-to email", &settings.reply_to_email)?;
    }

    Ok(settings)
}

fn normalize_portal_publish_input(
    input: PortalPublishSettingsInput,
    previous: &StoredPortalPublishSettings,
) -> Result<StoredPortalPublishSettings, AppError> {
    let secret_key = if input.supabase_secret_key.trim().is_empty() {
        previous.supabase_secret_key.clone()
    } else {
        input.supabase_secret_key.trim().to_string()
    };
    let settings = StoredPortalPublishSettings {
        enabled: input.enabled,
        supabase_url: input.supabase_url.trim().trim_end_matches('/').to_string(),
        supabase_secret_key: secret_key,
    };

    if settings.enabled {
        validate_required("Supabase URL Portal ESS", &settings.supabase_url)?;
        validate_required("Supabase Secret Key Portal ESS", &settings.supabase_secret_key)?;
    }

    if !settings.supabase_url.is_empty()
        && !(settings.supabase_url.starts_with("https://") || settings.supabase_url.starts_with("http://"))
    {
        return Err(AppError::Database(
            "Supabase URL Portal ESS harus diawali http:// atau https://".to_string(),
        ));
    }

    Ok(settings)
}

fn validate_payday(payroll: &PayrollSettings) -> Result<(), AppError> {
    match payroll.payday_type.as_str() {
        "day_of_month" => {
            let day = payroll.payday_day_of_month.ok_or_else(|| {
                AppError::Database("tanggal gajian wajib diisi".to_string())
            })?;

            if !(1..=31).contains(&day) {
                return Err(AppError::Database(
                    "tanggal gajian harus berada di rentang 1 sampai 31".to_string(),
                ));
            }
        }
        "weekday" => {
            let weekday = payroll.payday_weekday.as_deref().ok_or_else(|| {
                AppError::Database("hari gajian wajib dipilih".to_string())
            })?;

            if !matches!(
                weekday,
                "monday"
                    | "tuesday"
                    | "wednesday"
                    | "thursday"
                    | "friday"
                    | "saturday"
                    | "sunday"
            ) {
                return Err(AppError::Database("hari gajian tidak valid".to_string()));
            }
        }
        _ => {
            return Err(AppError::Database(
                "tipe jadwal gajian tidak valid".to_string(),
            ));
        }
    }

    Ok(())
}

fn validate_non_negative<T>(label: &str, value: T) -> Result<(), AppError>
where
    T: PartialOrd + From<i32>,
{
    if value < T::from(0) {
        return Err(AppError::Database(format!("{label} tidak boleh negatif")));
    }

    Ok(())
}

fn validate_required(label: &str, value: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Database(format!("{label} wajib diisi")));
    }

    Ok(())
}

fn validate_optional_email(label: &str, value: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Ok(());
    }

    if value.contains('@') && value.rsplit('@').next().is_some_and(|domain| domain.contains('.')) {
        return Ok(());
    }

    Err(AppError::Database(format!("{label} tidak valid")))
}

fn validate_actor(actor: &SettingsActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh mengubah setting".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}

fn changed_field_names(
    previous_company: &CompanySettings,
    company: &CompanySettings,
    previous_payroll: &PayrollSettings,
    payroll: &PayrollSettings,
    previous_email_delivery: &EmailDeliverySettings,
    email_delivery: &EmailDeliverySettings,
    previous_portal_publish: &StoredPortalPublishSettings,
    portal_publish: &StoredPortalPublishSettings,
) -> Vec<&'static str> {
    let mut fields = Vec::new();

    push_if_changed(
        &mut fields,
        previous_company.company_name != company.company_name,
        "nama perusahaan",
    );
    push_if_changed(
        &mut fields,
        previous_company.address != company.address,
        "alamat perusahaan",
    );
    push_if_changed(
        &mut fields,
        previous_company.contact_phone != company.contact_phone,
        "kontak telepon",
    );
    push_if_changed(
        &mut fields,
        previous_company.contact_email != company.contact_email,
        "kontak email",
    );
    push_if_changed(
        &mut fields,
        previous_company.treasurer_name != company.treasurer_name,
        "bendahara",
    );
    push_if_changed(
        &mut fields,
        previous_company.logo_data_url != company.logo_data_url,
        "logo perusahaan",
    );
    push_if_changed(
        &mut fields,
        previous_payroll.current_year != payroll.current_year,
        "tahun berjalan",
    );
    push_if_changed(
        &mut fields,
        previous_payroll.payday_type != payroll.payday_type
            || previous_payroll.payday_day_of_month != payroll.payday_day_of_month
            || previous_payroll.payday_weekday != payroll.payday_weekday,
        "jadwal gajian",
    );
    push_if_changed(
        &mut fields,
        previous_payroll.working_days_per_week != payroll.working_days_per_week,
        "hari kerja",
    );
    push_if_changed(
        &mut fields,
        previous_payroll.late_tolerance_minutes != payroll.late_tolerance_minutes
            || previous_payroll.late_penalty_amount != payroll.late_penalty_amount,
        "aturan telat",
    );
    push_if_changed(
        &mut fields,
        previous_payroll.early_leave_tolerance_minutes != payroll.early_leave_tolerance_minutes
            || previous_payroll.early_leave_penalty_amount != payroll.early_leave_penalty_amount,
        "aturan pulang cepat",
    );
    push_if_changed(
        &mut fields,
        previous_email_delivery != email_delivery,
        "pengiriman email",
    );
    push_if_changed(
        &mut fields,
        previous_portal_publish.enabled != portal_publish.enabled
            || previous_portal_publish.supabase_url != portal_publish.supabase_url
            || previous_portal_publish.supabase_secret_key != portal_publish.supabase_secret_key,
        "Portal ESS Supabase",
    );

    fields
}

fn push_if_changed(fields: &mut Vec<&'static str>, changed: bool, field: &'static str) {
    if changed {
        fields.push(field);
    }
}

fn create_audit_id() -> Result<String, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Database(error.to_string()))?
        .as_millis();

    Ok(format!("settings-audit-{timestamp}"))
}
