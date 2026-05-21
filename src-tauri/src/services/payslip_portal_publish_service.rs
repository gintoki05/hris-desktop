use std::{collections::BTreeMap, fs, path::PathBuf};

use reqwest::blocking::{Client, Response};
use reqwest::StatusCode;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use crate::{
    error::AppError,
    services::{database_service, settings_service},
};

const PAYSLIP_BUCKET: &str = "payslips";

#[derive(Deserialize)]
pub struct PayslipPortalPublishInput {
    pub period_id: String,
    pub actor: PayslipPortalPublishActor,
}

#[derive(Deserialize)]
pub struct PayslipPortalStatusInput {
    pub period_id: String,
    pub actor: PayslipPortalPublishActor,
}

#[derive(Deserialize)]
pub struct EmployeePortalLinkInput {
    pub employee_id: String,
    pub actor: PayslipPortalPublishActor,
}

#[derive(Deserialize)]
pub struct EmployeePortalCreateAccountInput {
    pub employee_id: String,
    pub temporary_password: String,
    pub actor: PayslipPortalPublishActor,
}

#[derive(Deserialize)]
pub struct OwnerPortalCreateAccountInput {
    pub auth_user_id: String,
    pub temporary_password: String,
    pub actor: PayslipPortalPublishActor,
}

#[derive(Deserialize)]
pub struct PayslipPortalPublishActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Serialize)]
pub struct PayslipPortalPublishResult {
    pub period_id: String,
    pub attempted_count: usize,
    pub published_count: usize,
    pub failed_count: usize,
    pub skipped_count: usize,
    pub owner_summary_status: String,
    pub owner_summary_id: String,
    pub owner_summary_error_message: String,
    pub items: Vec<PayslipPortalPublishItemResult>,
}

#[derive(Serialize)]
pub struct PayslipPortalPublishItemResult {
    pub snapshot_id: String,
    pub employee_name: String,
    pub status: String,
    pub storage_path: String,
    pub error_message: String,
}

#[derive(Serialize)]
pub struct PayslipPortalStatusResult {
    pub period_id: String,
    pub items: Vec<PayslipPortalStatusItem>,
}

#[derive(Serialize)]
pub struct PayslipPortalStatusItem {
    pub snapshot_id: String,
    pub employee_name: String,
    pub employee_email: String,
    pub auth_user_status: String,
    pub employee_profile_status: String,
    pub payslip_status: String,
    pub portal_user_id: String,
    pub employee_profile_id: String,
    pub portal_payslip_id: String,
    pub published_at: Option<String>,
    pub error_message: String,
}

#[derive(Serialize)]
pub struct EmployeePortalLinkResult {
    pub employee_id: String,
    pub employee_name: String,
    pub employee_email: String,
    pub portal_user_id: String,
    pub employee_profile_id: String,
}

#[derive(Serialize)]
pub struct EmployeePortalStatusResult {
    pub items: Vec<EmployeePortalStatusItem>,
}

#[derive(Serialize)]
pub struct EmployeePortalStatusItem {
    pub employee_id: String,
    pub employee_name: String,
    pub employee_code_masked: String,
    pub employee_email: String,
    pub employee_status: String,
    pub auth_user_status: String,
    pub employee_profile_status: String,
    pub payslip_count: usize,
    pub latest_payroll_period: String,
    pub latest_published_at: Option<String>,
    pub portal_user_id: String,
    pub employee_profile_id: String,
    pub issue_message: String,
}

#[derive(Serialize)]
pub struct EmployeePortalCreateAccountResult {
    pub employee_id: String,
    pub employee_name: String,
    pub employee_email: String,
    pub portal_user_id: String,
    pub employee_profile_id: String,
    pub account_status: String,
}

#[derive(Serialize)]
pub struct OwnerPortalCreateAccountResult {
    pub auth_user_id: String,
    pub display_name: String,
    pub portal_email: String,
    pub portal_user_id: String,
    pub account_status: String,
}

#[derive(Clone)]
struct PublishConfig {
    supabase_url: String,
    api_key: String,
    payslips_enabled: bool,
    owner_summary_enabled: bool,
}

struct FinalPayslipSnapshot {
    id: String,
    employee_code: String,
    employee_name: String,
    employee_position: String,
    employee_department: String,
    employee_email: String,
    portal_user_id: String,
    payroll_period: String,
    period_start: String,
    period_end: String,
    net_pay: i64,
    pdf_file_path: String,
    snapshot_json: String,
    portal_publish_status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SafePayslipSnapshot {
    payroll: SafePayrollSnapshot,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SafePayrollSnapshot {
    gross_pay: i64,
    total_deductions: i64,
    net_pay: i64,
    income_components: Vec<SafePayrollComponent>,
    deduction_components: Vec<SafePayrollComponent>,
}

#[derive(Deserialize)]
struct SafePayrollComponent {
    name: String,
    amount: i64,
}

#[derive(Deserialize)]
struct OwnerPayrollSummaryRow {
    id: String,
}

#[derive(Deserialize)]
struct EmployeeProfileRow {
    id: String,
}

#[derive(Deserialize)]
struct PayslipRow {
    id: String,
}

#[derive(Deserialize, Clone)]
struct EmployeeProfileStatusRow {
    id: String,
    user_id: String,
    employee_code: String,
}

#[derive(Deserialize, Clone)]
struct PayslipStatusRow {
    id: String,
    employee_profile_id: String,
    payroll_period: Option<String>,
    period_start: Option<String>,
    period_end: Option<String>,
    published_at: String,
}

#[derive(Deserialize)]
struct AuthUsersResponse {
    users: Vec<AuthUserRow>,
}

#[derive(Deserialize)]
struct AuthUserRow {
    id: String,
    email: Option<String>,
}

struct LocalEmployeePortalStatus {
    employee_id: String,
    employee_code: String,
    employee_name: String,
    employee_email: String,
    employee_status: String,
    portal_user_id: String,
}

struct LocalOwnerPortalUser {
    auth_user_id: String,
    display_name: String,
    portal_email: String,
    portal_user_id: String,
}

pub fn publish_final_payslips_to_portal(
    app: &AppHandle,
    input: PayslipPortalPublishInput,
) -> Result<PayslipPortalPublishResult, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    let period_id = input.period_id.trim().to_string();
    if period_id.is_empty() {
        return Err(AppError::Database("periode slip wajib dipilih".to_string()));
    }

    let config = read_publish_config(app)?;
    let connection = database_service::open_local_connection(app)?;
    ensure_period_is_finalized_payroll(&connection, &period_id)?;
    let snapshots = list_final_snapshots(&connection, &period_id)?;
    if snapshots.is_empty() {
        return Err(AppError::Database(
            "periode payroll final belum memiliki snapshot slip".to_string(),
        ));
    }

    let client = Client::new();
    let mut items = Vec::new();
    let mut published_count = 0usize;
    let mut skipped_count = 0usize;

    if config.payslips_enabled {
        for snapshot in &snapshots {
            if snapshot.portal_publish_status == "published" {
                skipped_count += 1;
                continue;
            }

            let result = publish_one_snapshot(&client, &config, snapshot);
            match result {
                Ok((storage_path, payslip_id)) => {
                    update_local_publish_success(&connection, &snapshot.id, &storage_path, &payslip_id)?;
                    published_count += 1;
                    items.push(PayslipPortalPublishItemResult {
                        snapshot_id: snapshot.id.clone(),
                        employee_name: snapshot.employee_name.clone(),
                        status: "published".to_string(),
                        storage_path,
                        error_message: String::new(),
                    });
                }
                Err(error) => {
                    let message = sanitize_error_message(&error.user_message());
                    update_local_publish_failure(&connection, &snapshot.id, &message)?;
                    items.push(PayslipPortalPublishItemResult {
                        snapshot_id: snapshot.id.clone(),
                        employee_name: snapshot.employee_name.clone(),
                        status: "failed".to_string(),
                        storage_path: String::new(),
                        error_message: message,
                    });
                }
            }
        }
    }
    let failed_count = items.len().saturating_sub(published_count);
    let (owner_summary_status, owner_summary_id, owner_summary_error_message) =
        if config.owner_summary_enabled {
            match publish_owner_payroll_summary(
                &client,
                &config,
                &period_id,
                &snapshots,
                published_count + skipped_count,
                failed_count,
            ) {
                Ok(summary_id) => ("published".to_string(), summary_id, String::new()),
                Err(error) => (
                    "failed".to_string(),
                    String::new(),
                    sanitize_error_message(&error.user_message()),
                ),
            }
        } else {
            ("disabled".to_string(), String::new(), String::new())
        };

    Ok(PayslipPortalPublishResult {
        period_id,
        attempted_count: items.len(),
        published_count,
        failed_count,
        skipped_count,
        owner_summary_status,
        owner_summary_id,
        owner_summary_error_message,
        items,
    })
}

pub fn list_payslip_portal_status(
    app: &AppHandle,
    input: PayslipPortalStatusInput,
) -> Result<PayslipPortalStatusResult, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    let period_id = input.period_id.trim().to_string();
    if period_id.is_empty() {
        return Err(AppError::Database("periode slip wajib dipilih".to_string()));
    }

    let config = read_publish_config(app)?;
    let connection = database_service::open_local_connection(app)?;
    ensure_period_is_finalized_payroll(&connection, &period_id)?;
    let snapshots = list_final_snapshots(&connection, &period_id)?;
    let client = Client::new();
    let auth_users = list_auth_users(&client, &config)?;
    let profiles = list_employee_profiles(&client, &config)?;
    let remote_payslips = list_remote_payslips(&client, &config)?;

    let items = snapshots
        .into_iter()
        .map(|snapshot| {
            let email = snapshot.employee_email.trim().to_lowercase();
            let local_portal_user_id = snapshot.portal_user_id.trim();
            let auth_user = if local_portal_user_id.is_empty() {
                auth_users.iter().find(|user| {
                    user.email
                        .as_deref()
                        .map(|value| value.trim().eq_ignore_ascii_case(&email))
                        .unwrap_or(false)
                })
            } else {
                auth_users.iter().find(|user| user.id == local_portal_user_id)
            };
            let profile = profiles
                .iter()
                .find(|profile| profile.employee_code == snapshot.employee_code)
                .or_else(|| {
                    auth_user.and_then(|user| {
                        profiles.iter().find(|profile| profile.user_id == user.id)
                    })
                });
            let remote_payslip = profile.and_then(|profile| {
                remote_payslips.iter().find(|payslip| {
                    payslip.employee_profile_id == profile.id
                        && payslip.period_start.as_deref() == Some(snapshot.period_start.as_str())
                        && payslip.period_end.as_deref() == Some(snapshot.period_end.as_str())
                })
            });

            let mut error_message = String::new();
            if email.is_empty() && local_portal_user_id.is_empty() {
                error_message = "email karyawan kosong dan Portal user ID belum diisi".to_string();
            } else if auth_user.is_none() {
                error_message = "akun portal belum ditemukan".to_string();
            } else if profile.is_none() {
                error_message = "employee profile belum dibuat di portal".to_string();
            } else if remote_payslip.is_none() {
                error_message = "slip periode ini belum publish di portal".to_string();
            }

            PayslipPortalStatusItem {
                snapshot_id: snapshot.id,
                employee_name: snapshot.employee_name,
                employee_email: mask_email_for_ui(&email),
                auth_user_status: if auth_user.is_some() { "found" } else { "missing" }.to_string(),
                employee_profile_status: if profile.is_some() { "found" } else { "missing" }.to_string(),
                payslip_status: if remote_payslip.is_some() { "published" } else { "missing" }.to_string(),
                portal_user_id: auth_user
                    .map(|user| user.id.clone())
                    .unwrap_or_else(|| local_portal_user_id.to_string()),
                employee_profile_id: profile.map(|profile| profile.id.clone()).unwrap_or_default(),
                portal_payslip_id: remote_payslip.map(|payslip| payslip.id.clone()).unwrap_or_default(),
                published_at: remote_payslip.map(|payslip| payslip.published_at.clone()),
                error_message,
            }
        })
        .collect();

    Ok(PayslipPortalStatusResult { period_id, items })
}

pub fn link_employee_portal_user(
    app: &AppHandle,
    input: EmployeePortalLinkInput,
) -> Result<EmployeePortalLinkResult, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    let employee_id = input.employee_id.trim().to_string();
    if employee_id.is_empty() {
        return Err(AppError::Database("karyawan wajib dipilih".to_string()));
    }

    let config = read_publish_config(app)?;
    let connection = database_service::open_local_connection(app)?;
    let employee = get_local_employee_for_portal_link(&connection, &employee_id)?;
    if employee.employee_email.trim().is_empty() {
        return Err(AppError::Supabase(
            "email karyawan wajib diisi sebelum menautkan akun portal".to_string(),
        ));
    }

    let client = Client::new();
    let portal_user_id = find_auth_user_id_by_email(
        &client,
        &config,
        &employee.employee_email.trim().to_lowercase(),
    )?
    .ok_or_else(|| {
        AppError::Supabase("akun portal belum ditemukan untuk email karyawan".to_string())
    })?;
    let profile_id = upsert_employee_profile(&client, &config, &employee, &portal_user_id)?;

    connection.execute(
        "
        UPDATE employees
        SET portal_user_id = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?2
        ",
        params![&portal_user_id, &employee.employee_id],
    )?;

    Ok(EmployeePortalLinkResult {
        employee_id: employee.employee_id,
        employee_name: employee.employee_name,
        employee_email: mask_email_for_ui(&employee.employee_email),
        portal_user_id,
        employee_profile_id: profile_id,
    })
}

pub fn list_employee_portal_status(
    app: &AppHandle,
    actor: PayslipPortalPublishActor,
) -> Result<EmployeePortalStatusResult, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&actor)?;

    let config = read_publish_config(app)?;
    let connection = database_service::open_local_connection(app)?;
    let employees = list_local_employees_for_portal_status(&connection)?;
    let client = Client::new();
    let auth_users = list_auth_users(&client, &config)?;
    let profiles = list_employee_profiles(&client, &config)?;
    let remote_payslips = list_remote_payslips(&client, &config)?;

    let items = employees
        .into_iter()
        .map(|employee| {
            let normalized_email = employee.employee_email.trim().to_lowercase();
            let local_portal_user_id = employee.portal_user_id.trim();
            let auth_user = if local_portal_user_id.is_empty() {
                auth_users.iter().find(|user| {
                    user.email
                        .as_deref()
                        .map(|value| value.trim().eq_ignore_ascii_case(&normalized_email))
                        .unwrap_or(false)
                })
            } else {
                auth_users.iter().find(|user| user.id == local_portal_user_id)
            };
            let profile = profiles
                .iter()
                .find(|profile| profile.employee_code == employee.employee_code)
                .or_else(|| {
                    auth_user.and_then(|user| {
                        profiles.iter().find(|profile| profile.user_id == user.id)
                    })
                });
            let profile_payslips: Vec<&PayslipStatusRow> = profile
                .map(|profile| {
                    remote_payslips
                        .iter()
                        .filter(|payslip| payslip.employee_profile_id == profile.id)
                        .collect()
                })
                .unwrap_or_default();
            let latest_payslip = profile_payslips
                .iter()
                .max_by(|first, second| first.published_at.cmp(&second.published_at));

            let issue_message = if normalized_email.is_empty() {
                "email master karyawan kosong".to_string()
            } else if auth_user.is_none() {
                "akun portal belum dibuat".to_string()
            } else if profile.is_none() {
                "employee profile belum tersinkron".to_string()
            } else {
                String::new()
            };

            EmployeePortalStatusItem {
                employee_id: employee.employee_id,
                employee_name: employee.employee_name,
                employee_code_masked: mask_identifier(&employee.employee_code),
                employee_email: mask_email_for_ui(&normalized_email),
                employee_status: employee.employee_status,
                auth_user_status: if auth_user.is_some() { "found" } else { "missing" }.to_string(),
                employee_profile_status: if profile.is_some() { "found" } else { "missing" }.to_string(),
                payslip_count: profile_payslips.len(),
                latest_payroll_period: latest_payslip
                    .and_then(|payslip| payslip.payroll_period.clone())
                    .unwrap_or_default(),
                latest_published_at: latest_payslip.map(|payslip| payslip.published_at.clone()),
                portal_user_id: auth_user
                    .map(|user| user.id.clone())
                    .unwrap_or_else(|| local_portal_user_id.to_string()),
                employee_profile_id: profile.map(|profile| profile.id.clone()).unwrap_or_default(),
                issue_message,
            }
        })
        .collect();

    Ok(EmployeePortalStatusResult { items })
}

pub fn create_employee_portal_account(
    app: &AppHandle,
    input: EmployeePortalCreateAccountInput,
) -> Result<EmployeePortalCreateAccountResult, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    let employee_id = input.employee_id.trim().to_string();
    let temporary_password = input.temporary_password.trim().to_string();
    if employee_id.is_empty() {
        return Err(AppError::Database("karyawan wajib dipilih".to_string()));
    }
    if temporary_password.len() < 8 {
        return Err(AppError::Supabase(
            "password sementara minimal 8 karakter".to_string(),
        ));
    }

    let config = read_publish_config(app)?;
    let connection = database_service::open_local_connection(app)?;
    let employee = get_local_employee_for_portal_link(&connection, &employee_id)?;
    let email = employee.employee_email.trim().to_lowercase();
    if email.is_empty() {
        return Err(AppError::Supabase(
            "email karyawan wajib diisi sebelum membuat akun portal".to_string(),
        ));
    }

    let client = Client::new();
    let existing_user_id = find_auth_user_id_by_email(&client, &config, &email)?;
    let (portal_user_id, account_status) = if let Some(user_id) = existing_user_id {
        (user_id, "existing".to_string())
    } else {
        (
            create_auth_user(&client, &config, &email, &temporary_password, &employee.employee_name)?,
            "created".to_string(),
        )
    };
    let profile_id = upsert_employee_profile(&client, &config, &employee, &portal_user_id)?;

    connection.execute(
        "
        UPDATE employees
        SET portal_user_id = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?2
        ",
        params![&portal_user_id, &employee.employee_id],
    )?;

    Ok(EmployeePortalCreateAccountResult {
        employee_id: employee.employee_id,
        employee_name: employee.employee_name,
        employee_email: mask_email_for_ui(&employee.employee_email),
        portal_user_id,
        employee_profile_id: profile_id,
        account_status,
    })
}

pub fn create_owner_portal_account(
    app: &AppHandle,
    input: OwnerPortalCreateAccountInput,
) -> Result<OwnerPortalCreateAccountResult, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    let auth_user_id = input.auth_user_id.trim().to_string();
    let temporary_password = input.temporary_password.trim().to_string();
    if auth_user_id.is_empty() {
        return Err(AppError::Database("user owner wajib dipilih".to_string()));
    }
    if temporary_password.len() < 8 {
        return Err(AppError::Supabase(
            "password sementara minimal 8 karakter".to_string(),
        ));
    }

    let config = read_publish_config(app)?;
    let connection = database_service::open_local_connection(app)?;
    let owner = get_local_owner_for_portal(&connection, &auth_user_id)?;
    if owner.portal_email.trim().is_empty() {
        return Err(AppError::Supabase(
            "email portal owner wajib diisi di Manajemen User".to_string(),
        ));
    }

    let client = Client::new();
    let existing_user_id = if owner.portal_user_id.trim().is_empty() {
        find_auth_user_id_by_email(&client, &config, &owner.portal_email)?
    } else {
        Some(owner.portal_user_id.clone())
    };
    let (portal_user_id, account_status) = if let Some(user_id) = existing_user_id {
        set_auth_user_app_role(&client, &config, &user_id, "owner_management")?;
        (user_id, "existing".to_string())
    } else {
        (
            create_auth_user_with_app_role(
                &client,
                &config,
                &owner.portal_email,
                &temporary_password,
                &owner.display_name,
                "owner_management",
            )?,
            "created".to_string(),
        )
    };

    connection.execute(
        "
        UPDATE auth_users
        SET portal_user_id = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?2
        ",
        params![&portal_user_id, &owner.auth_user_id],
    )?;

    Ok(OwnerPortalCreateAccountResult {
        auth_user_id: owner.auth_user_id,
        display_name: owner.display_name,
        portal_email: mask_email_for_ui(&owner.portal_email),
        portal_user_id,
        account_status,
    })
}

fn publish_one_snapshot(
    client: &Client,
    config: &PublishConfig,
    snapshot: &FinalPayslipSnapshot,
) -> Result<(String, String), AppError> {
    validate_snapshot_ready(snapshot)?;
    let portal_user_id = resolve_portal_user_id(client, config, snapshot)?;
    let profile_id = upsert_employee_profile(client, config, snapshot, &portal_user_id)?;
    let storage_path = stable_storage_path(snapshot);
    upload_pdf(client, config, &storage_path, &snapshot.pdf_file_path)?;
    let payslip_id = upsert_payslip_row(client, config, snapshot, &profile_id, &storage_path)?;
    Ok((storage_path, payslip_id))
}

trait EmployeeProfilePublishSource {
    fn employee_code(&self) -> &str;
    fn employee_name(&self) -> &str;
    fn employee_position(&self) -> &str;
    fn employee_department(&self) -> &str;
}

impl EmployeeProfilePublishSource for FinalPayslipSnapshot {
    fn employee_code(&self) -> &str {
        &self.employee_code
    }

    fn employee_name(&self) -> &str {
        &self.employee_name
    }

    fn employee_position(&self) -> &str {
        &self.employee_position
    }

    fn employee_department(&self) -> &str {
        &self.employee_department
    }
}

fn upsert_employee_profile<T: EmployeeProfilePublishSource>(
    client: &Client,
    config: &PublishConfig,
    source: &T,
    portal_user_id: &str,
) -> Result<String, AppError> {
    let existing = get_employee_profile(client, config, source.employee_code())?;
    if let Some(profile) = existing {
        patch_employee_profile_by_employee_code(client, config, source.employee_code(), source, portal_user_id)?;
        return Ok(profile.id);
    }

    let existing_by_user = get_employee_profile_by_user_id(client, config, portal_user_id)?;
    if let Some(profile) = existing_by_user {
        patch_employee_profile_by_id(client, config, &profile.id, source, portal_user_id)?;
        return Ok(profile.id);
    }

    let body = json!({
        "user_id": portal_user_id,
        "employee_code": source.employee_code(),
        "full_name": source.employee_name(),
        "position": empty_string_as_null(source.employee_position()),
        "department": empty_string_as_null(source.employee_department())
    });
    let response = authed_request(
        client
            .post(rest_url(config, "employee_profiles"))
            .query(&[("select", "id")])
            .header("Prefer", "return=representation")
            .json(&body),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("tidak bisa terhubung ke Supabase".to_string()))?;
    let rows: Vec<EmployeeProfileRow> = parse_json_response(response, "upsert employee profile")?;
    rows.into_iter()
        .next()
        .map(|row| row.id)
        .ok_or_else(|| AppError::Supabase("employee profile tersimpan tetapi ID tidak dikembalikan".to_string()))
}

fn get_employee_profile(
    client: &Client,
    config: &PublishConfig,
    employee_code: &str,
) -> Result<Option<EmployeeProfileRow>, AppError> {
    let response = authed_request(
        client
            .get(rest_url(config, "employee_profiles"))
            .query(&[
                ("employee_code", format!("eq.{employee_code}")),
                ("select", "id".to_string()),
                ("limit", "1".to_string()),
            ]),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("tidak bisa terhubung ke Supabase".to_string()))?;
    let rows: Vec<EmployeeProfileRow> = parse_json_response(response, "lookup employee profile")?;
    Ok(rows.into_iter().next())
}

fn get_employee_profile_by_user_id(
    client: &Client,
    config: &PublishConfig,
    portal_user_id: &str,
) -> Result<Option<EmployeeProfileRow>, AppError> {
    let response = authed_request(
        client
            .get(rest_url(config, "employee_profiles"))
            .query(&[
                ("user_id", format!("eq.{portal_user_id}")),
                ("select", "id".to_string()),
                ("limit", "1".to_string()),
            ]),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("tidak bisa terhubung ke Supabase".to_string()))?;
    let rows: Vec<EmployeeProfileRow> = parse_json_response(response, "lookup employee profile by user")?;
    Ok(rows.into_iter().next())
}

fn patch_employee_profile_by_employee_code<T: EmployeeProfilePublishSource>(
    client: &Client,
    config: &PublishConfig,
    employee_code: &str,
    source: &T,
    portal_user_id: &str,
) -> Result<(), AppError> {
    let response = authed_request(
        client
            .patch(rest_url(config, "employee_profiles"))
            .query(&[("employee_code", format!("eq.{employee_code}"))])
            .header("Prefer", "return=minimal")
            .json(&employee_profile_body(source, portal_user_id)),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("tidak bisa terhubung ke Supabase".to_string()))?;
    ensure_success_response(response, "update employee profile")
}

fn patch_employee_profile_by_id<T: EmployeeProfilePublishSource>(
    client: &Client,
    config: &PublishConfig,
    employee_profile_id: &str,
    source: &T,
    portal_user_id: &str,
) -> Result<(), AppError> {
    let response = authed_request(
        client
            .patch(rest_url(config, "employee_profiles"))
            .query(&[("id", format!("eq.{employee_profile_id}"))])
            .header("Prefer", "return=minimal")
            .json(&employee_profile_body(source, portal_user_id)),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("tidak bisa terhubung ke Supabase".to_string()))?;
    ensure_success_response(response, "update employee profile")
}

fn employee_profile_body<T: EmployeeProfilePublishSource>(
    source: &T,
    portal_user_id: &str,
) -> serde_json::Value {
    json!({
        "user_id": portal_user_id,
        "employee_code": source.employee_code(),
        "full_name": source.employee_name(),
        "position": empty_string_as_null(source.employee_position()),
        "department": empty_string_as_null(source.employee_department())
    })
}

fn upload_pdf(
    client: &Client,
    config: &PublishConfig,
    storage_path: &str,
    pdf_file_path: &str,
) -> Result<(), AppError> {
    let pdf_bytes = fs::read(pdf_file_path)
        .map_err(|_| AppError::FileSystem("file PDF slip final tidak bisa dibaca".to_string()))?;
    let url = format!(
        "{}/storage/v1/object/{}/{}",
        config.supabase_url, PAYSLIP_BUCKET, storage_path
    );
    let response = authed_request(
        client
            .post(url)
            .header("Content-Type", "application/pdf")
            .header("x-upsert", "true")
            .body(pdf_bytes),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("upload PDF gagal terhubung ke Supabase Storage".to_string()))?;
    ensure_success_response(response, "upload PDF")
}

fn upsert_payslip_row(
    client: &Client,
    config: &PublishConfig,
    snapshot: &FinalPayslipSnapshot,
    employee_profile_id: &str,
    storage_path: &str,
) -> Result<String, AppError> {
    let body = json!({
        "employee_profile_id": employee_profile_id,
        "payroll_period": snapshot.payroll_period,
        "period_start": snapshot.period_start,
        "period_end": snapshot.period_end,
        "net_pay": snapshot.net_pay,
        "storage_path": storage_path
    });
    let response = authed_request(
        client
            .post(rest_url(config, "payslips"))
            .query(&[("on_conflict", "storage_path"), ("select", "id")])
            .header("Prefer", "resolution=merge-duplicates,return=representation")
            .json(&body),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("insert payslip gagal terhubung ke Supabase".to_string()))?;
    let rows: Vec<PayslipRow> = parse_json_response(response, "insert payslip")?;
    rows.into_iter()
        .next()
        .map(|row| row.id)
        .ok_or_else(|| AppError::Supabase("payslip tersimpan tetapi ID tidak dikembalikan".to_string()))
}

fn publish_owner_payroll_summary(
    client: &Client,
    config: &PublishConfig,
    period_id: &str,
    snapshots: &[FinalPayslipSnapshot],
    published_count: usize,
    failed_count: usize,
) -> Result<String, AppError> {
    let first_snapshot = snapshots.first().ok_or_else(|| {
        AppError::Database("periode payroll final belum memiliki snapshot slip".to_string())
    })?;
    let mut gross_pay = 0i64;
    let mut total_deductions = 0i64;
    let mut net_pay = 0i64;
    let mut income_components = BTreeMap::<String, i64>::new();
    let mut deduction_components = BTreeMap::<String, i64>::new();

    for snapshot in snapshots {
        let parsed: SafePayslipSnapshot = serde_json::from_str(&snapshot.snapshot_json).map_err(|_| {
            AppError::Database("snapshot payroll final tidak bisa dibaca untuk laporan owner".to_string())
        })?;
        gross_pay += parsed.payroll.gross_pay;
        total_deductions += parsed.payroll.total_deductions;
        net_pay += parsed.payroll.net_pay;

        for component in parsed.payroll.income_components {
            let name = component.name.trim();
            if !name.is_empty() {
                *income_components.entry(name.to_string()).or_default() += component.amount;
            }
        }

        for component in parsed.payroll.deduction_components {
            let name = component.name.trim();
            if !name.is_empty() {
                *deduction_components.entry(name.to_string()).or_default() += component.amount;
            }
        }
    }

    let previously_published_count = snapshots
        .iter()
        .filter(|snapshot| snapshot.portal_publish_status == "published")
        .count();
    let current_published_count = if config.payslips_enabled {
        published_count
    } else {
        previously_published_count
    };
    let body = json!({
        "desktop_period_id": period_id,
        "payroll_period": first_snapshot.payroll_period,
        "period_start": first_snapshot.period_start,
        "period_end": first_snapshot.period_end,
        "employee_count": snapshots.len(),
        "gross_pay": gross_pay,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
        "income_components": to_component_summary_json(income_components),
        "deduction_components": to_component_summary_json(deduction_components),
        "payslip_published_count": current_published_count,
        "payslip_failed_count": failed_count
    });
    let response = authed_request(
        client
            .post(rest_url(config, "payroll_report_summaries"))
            .query(&[("on_conflict", "desktop_period_id"), ("select", "id")])
            .header("Prefer", "resolution=merge-duplicates,return=representation")
            .json(&body),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("publish laporan owner gagal terhubung ke Supabase".to_string()))?;
    let rows: Vec<OwnerPayrollSummaryRow> = parse_json_response(response, "publish laporan owner")?;
    rows.into_iter()
        .next()
        .map(|row| row.id)
        .ok_or_else(|| AppError::Supabase("laporan owner tersimpan tetapi ID tidak dikembalikan".to_string()))
}

fn to_component_summary_json(components: BTreeMap<String, i64>) -> Vec<serde_json::Value> {
    components
        .into_iter()
        .map(|(name, amount)| json!({ "name": name, "amount": amount }))
        .collect()
}

fn list_final_snapshots(
    connection: &rusqlite::Connection,
    period_id: &str,
) -> Result<Vec<FinalPayslipSnapshot>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT
            ps.id,
            ps.employee_nik,
            ps.employee_name,
            ps.employee_position,
            COALESCE(e.department, ''),
            COALESCE(e.email, ''),
            COALESCE(e.portal_user_id, ''),
            pp.label,
            pp.start_date,
            pp.end_date,
            ps.net_pay,
            ps.pdf_file_path,
            ps.snapshot_json,
            ps.portal_publish_status
        FROM payslip_snapshots ps
        JOIN payslip_periods pp ON pp.id = ps.period_id
        LEFT JOIN employees e ON e.id = ps.employee_id
        WHERE ps.period_id = ?1
        ORDER BY ps.employee_name ASC, ps.employee_nik ASC
        ",
    )?;
    let rows = statement.query_map([period_id], |row| {
        Ok(FinalPayslipSnapshot {
            id: row.get(0)?,
            employee_code: row.get(1)?,
            employee_name: row.get(2)?,
            employee_position: row.get(3)?,
            employee_department: row.get(4)?,
            employee_email: row.get(5)?,
            portal_user_id: row.get(6)?,
            payroll_period: row.get(7)?,
            period_start: row.get(8)?,
            period_end: row.get(9)?,
            net_pay: row.get(10)?,
            pdf_file_path: row.get(11)?,
            snapshot_json: row.get(12)?,
            portal_publish_status: row.get(13)?,
        })
    })?;

    let mut snapshots = Vec::new();
    for row in rows {
        snapshots.push(row?);
    }

    Ok(snapshots)
}

fn get_local_employee_for_portal_link(
    connection: &rusqlite::Connection,
    employee_id: &str,
) -> Result<LocalEmployeePortalLink, AppError> {
    connection
        .query_row(
            "
            SELECT id, nik, name, position, department, email
            FROM employees
            WHERE id = ?1
            ",
            [employee_id],
            |row| {
                Ok(LocalEmployeePortalLink {
                    employee_id: row.get(0)?,
                    employee_code: row.get(1)?,
                    employee_name: row.get(2)?,
                    employee_position: row.get(3)?,
                    employee_department: row.get(4)?,
                    employee_email: row.get(5)?,
                })
            },
        )
        .map_err(AppError::from)
}

fn list_local_employees_for_portal_status(
    connection: &rusqlite::Connection,
) -> Result<Vec<LocalEmployeePortalStatus>, AppError> {
    let mut statement = connection.prepare(
        "
        SELECT id, nik, name, email, status, COALESCE(portal_user_id, '')
        FROM employees
        ORDER BY status ASC, name ASC, nik ASC
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(LocalEmployeePortalStatus {
            employee_id: row.get(0)?,
            employee_code: row.get(1)?,
            employee_name: row.get(2)?,
            employee_email: row.get(3)?,
            employee_status: row.get(4)?,
            portal_user_id: row.get(5)?,
        })
    })?;

    let mut employees = Vec::new();
    for row in rows {
        employees.push(row?);
    }

    Ok(employees)
}

fn get_local_owner_for_portal(
    connection: &rusqlite::Connection,
    auth_user_id: &str,
) -> Result<LocalOwnerPortalUser, AppError> {
    connection
        .query_row(
            "
            SELECT id, display_name, portal_email, portal_user_id
            FROM auth_users
            WHERE id = ?1
                AND role_id = 'owner_management'
                AND is_active = 1
            ",
            [auth_user_id],
            |row| {
                Ok(LocalOwnerPortalUser {
                    auth_user_id: row.get(0)?,
                    display_name: row.get(1)?,
                    portal_email: row.get(2)?,
                    portal_user_id: row.get(3)?,
                })
            },
        )
        .map_err(|_| {
            AppError::Database(
                "user Owner/Manajemen aktif tidak ditemukan di Manajemen User".to_string(),
            )
        })
}

struct LocalEmployeePortalLink {
    employee_id: String,
    employee_code: String,
    employee_name: String,
    employee_position: String,
    employee_department: String,
    employee_email: String,
}

impl EmployeeProfilePublishSource for LocalEmployeePortalLink {
    fn employee_code(&self) -> &str {
        &self.employee_code
    }

    fn employee_name(&self) -> &str {
        &self.employee_name
    }

    fn employee_position(&self) -> &str {
        &self.employee_position
    }

    fn employee_department(&self) -> &str {
        &self.employee_department
    }
}

fn ensure_period_is_finalized_payroll(
    connection: &rusqlite::Connection,
    period_id: &str,
) -> Result<(), AppError> {
    let is_finalized: bool = connection.query_row(
        "
        SELECT EXISTS(
            SELECT 1
            FROM payslip_import_batches batch
            JOIN payroll_runs run ON batch.id = run.id || '-payroll-final'
            WHERE batch.period_id = ?1
                AND run.status = 'finalized'
        )
        ",
        [period_id],
        |row| row.get(0),
    )?;

    if is_finalized {
        Ok(())
    } else {
        Err(AppError::Database(
            "hanya slip dari payroll yang sudah difinalisasi yang boleh dipublish ke portal".to_string(),
        ))
    }
}

fn update_local_publish_success(
    connection: &rusqlite::Connection,
    snapshot_id: &str,
    storage_path: &str,
    payslip_id: &str,
) -> Result<(), AppError> {
    connection.execute(
        "
        UPDATE payslip_snapshots
        SET
            portal_publish_status = 'published',
            portal_published_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
            portal_storage_path = ?1,
            portal_payslip_id = ?2,
            portal_error_message = '',
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?3
        ",
        params![storage_path, payslip_id, snapshot_id],
    )?;
    Ok(())
}

fn update_local_publish_failure(
    connection: &rusqlite::Connection,
    snapshot_id: &str,
    error_message: &str,
) -> Result<(), AppError> {
    connection.execute(
        "
        UPDATE payslip_snapshots
        SET
            portal_publish_status = 'failed',
            portal_error_message = ?1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?2
        ",
        params![error_message, snapshot_id],
    )?;
    Ok(())
}

fn validate_snapshot_ready(snapshot: &FinalPayslipSnapshot) -> Result<(), AppError> {
    if !snapshot.portal_user_id.trim().is_empty() && !looks_like_uuid(&snapshot.portal_user_id) {
        return Err(AppError::Supabase(
            "portal user ID karyawan tidak valid".to_string(),
        ));
    }

    if snapshot.pdf_file_path.trim().is_empty() {
        return Err(AppError::Supabase("PDF final belum tersedia".to_string()));
    }

    if !PathBuf::from(&snapshot.pdf_file_path).exists() {
        return Err(AppError::Supabase(
            "file PDF final tidak ditemukan di komputer lokal".to_string(),
        ));
    }

    Ok(())
}

fn resolve_portal_user_id(
    client: &Client,
    config: &PublishConfig,
    snapshot: &FinalPayslipSnapshot,
) -> Result<String, AppError> {
    let configured_user_id = snapshot.portal_user_id.trim();
    if !configured_user_id.is_empty() {
        return Ok(configured_user_id.to_string());
    }

    let email = snapshot.employee_email.trim().to_lowercase();
    if email.is_empty() {
        return Err(AppError::Supabase(
            "karyawan belum punya user portal dan email master data kosong".to_string(),
        ));
    }

    find_auth_user_id_by_email(client, config, &email)?.ok_or_else(|| {
        AppError::Supabase("akun portal belum ditemukan untuk email karyawan".to_string())
    })
}

fn find_auth_user_id_by_email(
    client: &Client,
    config: &PublishConfig,
    email: &str,
) -> Result<Option<String>, AppError> {
    let users = list_auth_users(client, config)?;
    Ok(users
        .into_iter()
        .find(|user| {
            user.email
                .as_deref()
                .map(|value| value.trim().eq_ignore_ascii_case(email))
                .unwrap_or(false)
        })
        .map(|user| user.id))
}

fn create_auth_user(
    client: &Client,
    config: &PublishConfig,
    email: &str,
    temporary_password: &str,
    employee_name: &str,
) -> Result<String, AppError> {
    create_auth_user_with_app_role(client, config, email, temporary_password, employee_name, "employee")
}

fn create_auth_user_with_app_role(
    client: &Client,
    config: &PublishConfig,
    email: &str,
    temporary_password: &str,
    display_name: &str,
    app_role: &str,
) -> Result<String, AppError> {
    let body = json!({
        "email": email,
        "password": temporary_password,
        "email_confirm": true,
        "app_metadata": {
            "role": app_role
        },
        "user_metadata": {
            "display_name": display_name
        }
    });
    let response = authed_request(
        client
            .post(format!("{}/auth/v1/admin/users", config.supabase_url))
            .json(&body),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("buat akun portal gagal terhubung ke Supabase Auth".to_string()))?;
    let value: serde_json::Value = parse_json_response(response, "buat akun portal")?;
    value
        .get("id")
        .and_then(|item| item.as_str())
        .or_else(|| {
            value
                .get("user")
                .and_then(|user| user.get("id"))
                .and_then(|item| item.as_str())
        })
        .map(|id| id.to_string())
        .ok_or_else(|| AppError::Supabase("akun portal dibuat tetapi user ID tidak dikembalikan".to_string()))
}

fn set_auth_user_app_role(
    client: &Client,
    config: &PublishConfig,
    user_id: &str,
    app_role: &str,
) -> Result<(), AppError> {
    let body = json!({
        "app_metadata": {
            "role": app_role
        }
    });
    let response = authed_request(
        client
            .put(format!("{}/auth/v1/admin/users/{user_id}", config.supabase_url))
            .json(&body),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("set role akun portal gagal terhubung ke Supabase Auth".to_string()))?;
    ensure_success_response(response, "set role akun portal")
}

fn list_auth_users(client: &Client, config: &PublishConfig) -> Result<Vec<AuthUserRow>, AppError> {
    let mut users = Vec::new();
    for page in 1..=20 {
        let response = authed_request(
            client
                .get(format!("{}/auth/v1/admin/users", config.supabase_url))
                .query(&[("page", page.to_string()), ("per_page", "100".to_string())]),
            config,
        )
        .send()
        .map_err(|_| AppError::Supabase("lookup akun portal gagal terhubung ke Supabase Auth".to_string()))?;
        let users_response: AuthUsersResponse = parse_json_response(response, "lookup akun portal")?;

        let is_last_page = users_response.users.len() < 100;
        users.extend(users_response.users);

        if is_last_page {
            return Ok(users);
        }
    }

    Err(AppError::Supabase(
        "lookup akun portal terlalu banyak halaman".to_string(),
    ))
}

fn list_employee_profiles(
    client: &Client,
    config: &PublishConfig,
) -> Result<Vec<EmployeeProfileStatusRow>, AppError> {
    let response = authed_request(
        client
            .get(rest_url(config, "employee_profiles"))
            .query(&[("select", "id,user_id,employee_code")]),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("lookup employee profiles gagal terhubung ke Supabase".to_string()))?;
    parse_json_response(response, "lookup employee profiles")
}

fn list_remote_payslips(
    client: &Client,
    config: &PublishConfig,
) -> Result<Vec<PayslipStatusRow>, AppError> {
    let response = authed_request(
        client
            .get(rest_url(config, "payslips"))
            .query(&[("select", "id,employee_profile_id,payroll_period,period_start,period_end,published_at")]),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("lookup payslips portal gagal terhubung ke Supabase".to_string()))?;
    parse_json_response(response, "lookup payslips portal")
}

fn mask_email_for_ui(email: &str) -> String {
    let Some((name, domain)) = email.split_once('@') else {
        return email.to_string();
    };
    let visible = name.chars().take(2).collect::<String>();
    if visible.is_empty() {
        format!("***@{domain}")
    } else {
        format!("{visible}***@{domain}")
    }
}

fn mask_identifier(value: &str) -> String {
    let trimmed = value.trim();
    let length = trimmed.chars().count();
    if length <= 4 {
        return "***".to_string();
    }

    let suffix = trimmed
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();
    format!("***{suffix}")
}

fn read_publish_config(app: &AppHandle) -> Result<PublishConfig, AppError> {
    let settings = settings_service::get_portal_publish_settings(app)?;
    let supabase_url = settings.supabase_url.trim().trim_end_matches('/').to_string();
    let api_key = settings.supabase_secret_key.trim().to_string();

    if !settings.enabled {
        return Err(AppError::Supabase(
            "Portal ESS belum diaktifkan. Aktifkan publish portal di Pengaturan sebelum publish.".to_string(),
        ));
    }

    if supabase_url.is_empty() || api_key.is_empty() {
        return Err(AppError::Supabase(portal_config_missing_message()));
    }

    if !settings.payslips_enabled && !settings.owner_summary_enabled {
        return Err(AppError::Supabase(
            "minimal satu jenis publish portal harus aktif".to_string(),
        ));
    }

    Ok(PublishConfig {
        supabase_url,
        api_key,
        payslips_enabled: settings.payslips_enabled,
        owner_summary_enabled: settings.owner_summary_enabled,
    })
}

fn portal_config_missing_message() -> String {
    "Konfigurasi Portal ESS belum lengkap. Isi Supabase URL dan Secret Key di Pengaturan.".to_string()
}

fn authed_request(
    builder: reqwest::blocking::RequestBuilder,
    config: &PublishConfig,
) -> reqwest::blocking::RequestBuilder {
    builder
        .header("apikey", &config.api_key)
        .bearer_auth(&config.api_key)
}

fn rest_url(config: &PublishConfig, table: &str) -> String {
    format!("{}/rest/v1/{table}", config.supabase_url)
}

fn parse_json_response<T>(response: Response, action: &str) -> Result<T, AppError>
where
    T: for<'de> Deserialize<'de>,
{
    let status = response.status();
    let body = response.text().unwrap_or_default();
    if status.is_success() {
        serde_json::from_str(&body).map_err(|_| {
            AppError::Supabase(format!("{action} berhasil tetapi response tidak bisa dibaca"))
        })
    } else {
        Err(AppError::Supabase(format!(
            "{action} ditolak Supabase HTTP {}: {}",
            status.as_u16(),
            safe_supabase_error_message(&body)
        )))
    }
}

fn ensure_success_response(response: Response, action: &str) -> Result<(), AppError> {
    let status = response.status();
    if status.is_success() || status == StatusCode::NO_CONTENT {
        Ok(())
    } else {
        let body = response.text().unwrap_or_default();
        Err(AppError::Supabase(format!(
            "{action} ditolak Supabase HTTP {}: {}",
            status.as_u16(),
            safe_supabase_error_message(&body)
        )))
    }
}

fn safe_supabase_error_message(body: &str) -> String {
    let parsed: serde_json::Value = serde_json::from_str(body).unwrap_or_default();
    parsed
        .get("message")
        .and_then(|value| value.as_str())
        .or_else(|| parsed.get("error").and_then(|value| value.as_str()))
        .map(sanitize_error_message)
        .unwrap_or_else(|| "request gagal".to_string())
}

fn sanitize_error_message(value: &str) -> String {
    let mut message = value.replace('\n', " ").replace('\r', " ");
    for marker in ["Bearer ", "eyJ", "sb_secret_", "service_role"] {
        if let Some(index) = message.find(marker) {
            message.truncate(index);
            message.push_str("[secret disembunyikan]");
        }
    }
    message.trim().to_string()
}

fn stable_storage_path(snapshot: &FinalPayslipSnapshot) -> String {
    format!(
        "payroll/{}/{}.pdf",
        sanitize_path_segment(&format!("{}_{}", snapshot.period_start, snapshot.period_end)),
        sanitize_path_segment(&snapshot.id)
    )
}

fn sanitize_path_segment(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    let trimmed = sanitized.trim_matches('-').to_lowercase();
    if trimmed.is_empty() {
        "payslip".to_string()
    } else {
        trimmed
    }
}

fn empty_string_as_null(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn looks_like_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && [8, 13, 18, 23].iter().all(|index| bytes[*index] == b'-')
        && bytes.iter().enumerate().all(|(index, byte)| {
            [8, 13, 18, 23].contains(&index) || byte.is_ascii_hexdigit()
        })
}

fn validate_actor(actor: &PayslipPortalPublishActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh publish slip ke portal".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}
