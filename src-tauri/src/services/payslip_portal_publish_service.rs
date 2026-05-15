use std::{env, fs, path::PathBuf};

use reqwest::blocking::{Client, Response};
use reqwest::StatusCode;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

const PAYSLIP_BUCKET: &str = "payslips";

#[derive(Deserialize)]
pub struct PayslipPortalPublishInput {
    pub period_id: String,
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

#[derive(Clone)]
struct PublishConfig {
    supabase_url: String,
    service_role_key: String,
}

struct FinalPayslipSnapshot {
    id: String,
    employee_code: String,
    employee_name: String,
    employee_position: String,
    employee_department: String,
    portal_user_id: String,
    payroll_period: String,
    period_start: String,
    period_end: String,
    net_pay: i64,
    pdf_file_path: String,
}

#[derive(Deserialize)]
struct EmployeeProfileRow {
    id: String,
}

#[derive(Deserialize)]
struct PayslipRow {
    id: String,
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

    let config = read_publish_config()?;
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

    for snapshot in snapshots {
        let result = publish_one_snapshot(&client, &config, &snapshot);
        match result {
            Ok((storage_path, payslip_id)) => {
                update_local_publish_success(&connection, &snapshot.id, &storage_path, &payslip_id)?;
                published_count += 1;
                items.push(PayslipPortalPublishItemResult {
                    snapshot_id: snapshot.id,
                    employee_name: snapshot.employee_name,
                    status: "published".to_string(),
                    storage_path,
                    error_message: String::new(),
                });
            }
            Err(error) => {
                let message = sanitize_error_message(&error.user_message());
                update_local_publish_failure(&connection, &snapshot.id, &message)?;
                items.push(PayslipPortalPublishItemResult {
                    snapshot_id: snapshot.id,
                    employee_name: snapshot.employee_name,
                    status: "failed".to_string(),
                    storage_path: String::new(),
                    error_message: message,
                });
            }
        }
    }

    Ok(PayslipPortalPublishResult {
        period_id,
        attempted_count: items.len(),
        published_count,
        failed_count: items.len().saturating_sub(published_count),
        items,
    })
}

fn publish_one_snapshot(
    client: &Client,
    config: &PublishConfig,
    snapshot: &FinalPayslipSnapshot,
) -> Result<(String, String), AppError> {
    validate_snapshot_ready(snapshot)?;
    let profile_id = upsert_employee_profile(client, config, snapshot)?;
    let storage_path = stable_storage_path(snapshot);
    upload_pdf(client, config, &storage_path, &snapshot.pdf_file_path)?;
    let payslip_id = upsert_payslip_row(client, config, snapshot, &profile_id, &storage_path)?;
    Ok((storage_path, payslip_id))
}

fn upsert_employee_profile(
    client: &Client,
    config: &PublishConfig,
    snapshot: &FinalPayslipSnapshot,
) -> Result<String, AppError> {
    let existing = get_employee_profile(client, config, &snapshot.employee_code)?;
    if let Some(profile) = existing {
        patch_employee_profile(client, config, &snapshot.employee_code, snapshot)?;
        return Ok(profile.id);
    }

    let body = json!({
        "user_id": snapshot.portal_user_id,
        "employee_code": snapshot.employee_code,
        "full_name": snapshot.employee_name,
        "position": empty_string_as_null(&snapshot.employee_position),
        "department": empty_string_as_null(&snapshot.employee_department)
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

fn patch_employee_profile(
    client: &Client,
    config: &PublishConfig,
    employee_code: &str,
    snapshot: &FinalPayslipSnapshot,
) -> Result<(), AppError> {
    let body = json!({
        "full_name": snapshot.employee_name,
        "position": empty_string_as_null(&snapshot.employee_position),
        "department": empty_string_as_null(&snapshot.employee_department)
    });
    let response = authed_request(
        client
            .patch(rest_url(config, "employee_profiles"))
            .query(&[("employee_code", format!("eq.{employee_code}"))])
            .header("Prefer", "return=minimal")
            .json(&body),
        config,
    )
    .send()
    .map_err(|_| AppError::Supabase("tidak bisa terhubung ke Supabase".to_string()))?;
    ensure_success_response(response, "update employee profile")
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
            COALESCE(e.portal_user_id, ''),
            pp.label,
            pp.start_date,
            pp.end_date,
            ps.net_pay,
            ps.pdf_file_path
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
            portal_user_id: row.get(5)?,
            payroll_period: row.get(6)?,
            period_start: row.get(7)?,
            period_end: row.get(8)?,
            net_pay: row.get(9)?,
            pdf_file_path: row.get(10)?,
        })
    })?;

    let mut snapshots = Vec::new();
    for row in rows {
        snapshots.push(row?);
    }

    Ok(snapshots)
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
    if snapshot.portal_user_id.trim().is_empty() {
        return Err(AppError::Supabase(
            "karyawan belum punya user portal di master data".to_string(),
        ));
    }

    if !looks_like_uuid(&snapshot.portal_user_id) {
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

fn read_publish_config() -> Result<PublishConfig, AppError> {
    let supabase_url = read_secret_config("SUPABASE_URL")?
        .trim_end_matches('/')
        .to_string();
    let service_role_key = read_secret_config("SUPABASE_SERVICE_ROLE_KEY")
        .or_else(|_| read_secret_config("SUPABASE_SECRET_KEY"))?;

    if supabase_url.is_empty() || service_role_key.is_empty() {
        return Err(AppError::Supabase(
            "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib dikonfigurasi untuk proses desktop admin".to_string(),
        ));
    }

    Ok(PublishConfig {
        supabase_url,
        service_role_key,
    })
}

fn read_secret_config(key: &str) -> Result<String, AppError> {
    if let Ok(value) = env::var(key) {
        let trimmed = value.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }

    for file_name in [".env.local", ".env"] {
        let path = env::current_dir()
            .map_err(|error| AppError::Path(error.to_string()))?
            .join(file_name);
        let Ok(content) = fs::read_to_string(path) else {
            continue;
        };

        if let Some(value) = read_key_from_env_file(&content, key) {
            return Ok(value);
        }
    }

    Err(AppError::Supabase(format!("{key} belum dikonfigurasi")))
}

fn read_key_from_env_file(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let Some((candidate_key, candidate_value)) = trimmed.split_once('=') else {
            continue;
        };

        if candidate_key.trim() == key {
            return Some(candidate_value.trim().trim_matches('"').trim_matches('\'').to_string());
        }
    }

    None
}

fn authed_request(
    builder: reqwest::blocking::RequestBuilder,
    config: &PublishConfig,
) -> reqwest::blocking::RequestBuilder {
    builder
        .header("apikey", &config.service_role_key)
        .bearer_auth(&config.service_role_key)
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
