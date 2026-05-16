use std::{fs, path::PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use reqwest::blocking::Client;
use reqwest::StatusCode;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{
    error::AppError,
    services::{database_service, settings_service},
};

const EMAIL_DELIVERY_DISABLED_MESSAGE: &str =
    "pengiriman email Resend sedang dinonaktifkan sementara. Gunakan pengiriman WhatsApp manual.";

#[derive(Deserialize)]
pub struct DeliveryActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Serialize)]
pub struct PayslipDeliveryQueueItem {
    pub payslip_snapshot_id: String,
    pub payroll_run_id: String,
    pub employee_id: String,
    pub employee_nik: String,
    pub employee_name: String,
    pub employee_position: String,
    pub whatsapp_number: String,
    pub employee_email: String,
    pub period_label: String,
    pub net_pay: i64,
    pub pdf_file_path: String,
    pub whatsapp_status: String,
    pub email_status: String,
    pub whatsapp_opened_at: Option<String>,
    pub whatsapp_sent_at: Option<String>,
    pub whatsapp_failed_at: Option<String>,
    pub email_sent_at: Option<String>,
    pub email_failed_at: Option<String>,
    pub email_provider_message_id: String,
    pub whatsapp_error_message: String,
    pub email_error_message: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct UpdateDeliveryStatusInput {
    pub payslip_snapshot_id: String,
    pub status: String,
    pub actor: DeliveryActor,
}

#[derive(Deserialize)]
struct StoredPayslipSnapshot {
    employee: StoredEmployeeSnapshot,
    payroll: StoredPayrollSnapshot,
}

#[derive(Deserialize)]
struct StoredEmployeeSnapshot {
    nik: String,
    name: String,
    position: String,
    #[serde(default)]
    email: String,
    #[serde(rename = "whatsappNumber")]
    whatsapp_number: String,
}

#[derive(Deserialize)]
struct StoredPayrollSnapshot {
    period: StoredPayrollPeriod,
}

#[derive(Deserialize)]
struct StoredPayrollPeriod {
    label: String,
}

pub fn list_delivery_queue(app: &AppHandle) -> Result<Vec<PayslipDeliveryQueueItem>, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    let mut statement = connection.prepare(
        "
        SELECT
            snapshots.id,
            snapshots.payroll_run_id,
            snapshots.employee_id,
            snapshots.snapshot_json,
            snapshots.net_pay,
            snapshots.pdf_file_path,
            COALESCE(statuses.whatsapp_status, 'not_opened') AS whatsapp_status,
            COALESCE(statuses.email_status, 'not_sent') AS email_status,
            statuses.whatsapp_opened_at,
            statuses.whatsapp_sent_at,
            statuses.whatsapp_failed_at,
            statuses.email_sent_at,
            statuses.email_failed_at,
            COALESCE(statuses.updated_at, snapshots.created_at) AS updated_at,
            COALESCE(statuses.email_provider_message_id, '') AS email_provider_message_id,
            COALESCE(statuses.whatsapp_error_message, '') AS whatsapp_error_message,
            COALESCE(statuses.email_error_message, '') AS email_error_message,
            COALESCE(employees.email, '') AS current_employee_email
        FROM payroll_payslip_snapshots snapshots
        LEFT JOIN payroll_payslip_delivery_statuses statuses
            ON statuses.payslip_snapshot_id = snapshots.id
        LEFT JOIN employees
            ON employees.id = snapshots.employee_id
        JOIN payroll_runs runs
            ON runs.id = snapshots.payroll_run_id
        WHERE runs.status = 'finalized'
        ORDER BY runs.finalized_at DESC, snapshots.created_at DESC
        ",
    )?;

    let rows = statement.query_map([], queue_item_from_row)?;

    let mut queue = Vec::new();
    for row in rows {
        queue.push(row?);
    }

    Ok(queue)
}

pub fn update_delivery_status(
    app: &AppHandle,
    input: UpdateDeliveryStatusInput,
) -> Result<PayslipDeliveryQueueItem, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    validate_status(&input.status)?;

    let connection = database_service::open_local_connection(app)?;
    ensure_snapshot_exists(&connection, &input.payslip_snapshot_id)?;

    let existing: Option<String> = connection
        .query_row(
            "
            SELECT payslip_snapshot_id
            FROM payroll_payslip_delivery_statuses
            WHERE payslip_snapshot_id = ?1
            ",
            [&input.payslip_snapshot_id],
            |row| row.get(0),
        )
        .optional()?;

    if existing.is_some() {
        connection.execute(
            "
            UPDATE payroll_payslip_delivery_statuses
            SET
                whatsapp_status = ?1,
                whatsapp_opened_at = CASE WHEN ?1 = 'opened' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE whatsapp_opened_at END,
                whatsapp_sent_at = CASE WHEN ?1 = 'sent_manual' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE whatsapp_sent_at END,
                whatsapp_failed_at = CASE WHEN ?1 IN ('failed', 'missing_number') THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE whatsapp_failed_at END,
                actor_user_id = ?2,
                actor_display_name = ?3,
                actor_role = ?4,
                whatsapp_error_message = '',
                updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE payslip_snapshot_id = ?5
            ",
            params![
                &input.status,
                &input.actor.user_id,
                &input.actor.display_name,
                &input.actor.role,
                &input.payslip_snapshot_id,
            ],
        )?;
    } else {
        connection.execute(
            "
            INSERT INTO payroll_payslip_delivery_statuses (
                payslip_snapshot_id, status, opened_at, sent_at, failed_at,
                whatsapp_status, email_status, whatsapp_opened_at, whatsapp_sent_at,
                whatsapp_failed_at, email_sent_at, email_failed_at,
                actor_user_id, actor_display_name, actor_role, updated_at,
                channel, provider_message_id, error_message,
                email_provider_message_id, whatsapp_error_message, email_error_message
            )
            VALUES (
                ?1,
                CASE WHEN ?2 = 'sent_manual' THEN 'sent' WHEN ?2 = 'missing_number' THEN 'failed' ELSE ?2 END,
                CASE WHEN ?2 = 'opened' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
                CASE WHEN ?2 = 'sent_manual' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
                CASE WHEN ?2 IN ('failed', 'missing_number') THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
                ?2, 'not_sent',
                CASE WHEN ?2 = 'opened' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
                CASE WHEN ?2 = 'sent_manual' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
                CASE WHEN ?2 IN ('failed', 'missing_number') THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
                NULL, NULL,
                ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                'whatsapp_manual', '', '', '', '', ''
            )
            ",
            params![
                &input.payslip_snapshot_id,
                &input.status,
                &input.actor.user_id,
                &input.actor.display_name,
                &input.actor.role,
            ],
        )?;
    }

    get_queue_item(&connection, &input.payslip_snapshot_id)?
        .ok_or_else(|| AppError::Database("status slip tersimpan tetapi gagal dibaca ulang".to_string()))
}

pub fn send_payslip_email(
    app: &AppHandle,
    input: UpdateDeliveryStatusInput,
) -> Result<PayslipDeliveryQueueItem, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    if is_resend_email_delivery_disabled() {
        return Err(AppError::Database(
            EMAIL_DELIVERY_DISABLED_MESSAGE.to_string(),
        ));
    }

    let connection = database_service::open_local_connection(app)?;
    let item = get_queue_item(&connection, &input.payslip_snapshot_id)?
        .ok_or_else(|| AppError::Database("snapshot slip tidak ditemukan".to_string()))?;
    let settings = settings_service::get_resend_delivery_settings(app)?;

    if !settings.enabled {
        return Err(AppError::Database("pengiriman email belum diaktifkan di Settings".to_string()));
    }

    if item.employee_email.trim().is_empty() {
        mark_email_missing(
            &connection,
            &input,
            "email karyawan belum diisi",
        )?;
        return Err(AppError::Database("email karyawan belum diisi".to_string()));
    }

    let pdf_path = PathBuf::from(&item.pdf_file_path);
    if !pdf_path.exists() {
        mark_email_failed(&connection, &input, "file PDF slip tidak ditemukan")?;
        return Err(AppError::Database("file PDF slip tidak ditemukan".to_string()));
    }

    match send_resend_email(&settings, &item, &pdf_path) {
        Ok(message_id) => {
            mark_email_sent(&connection, &input, &message_id)?;
        }
        Err(error) => {
            mark_email_failed(&connection, &input, &error)?;
            return Err(AppError::Database(format!("email slip gagal dikirim: {error}")));
        }
    }

    get_queue_item(&connection, &input.payslip_snapshot_id)?
        .ok_or_else(|| AppError::Database("status slip tersimpan tetapi gagal dibaca ulang".to_string()))
}

fn get_queue_item(
    connection: &rusqlite::Connection,
    payslip_snapshot_id: &str,
) -> Result<Option<PayslipDeliveryQueueItem>, AppError> {
    connection
        .query_row(
            "
            SELECT
                snapshots.id,
                snapshots.payroll_run_id,
                snapshots.employee_id,
                snapshots.snapshot_json,
                snapshots.net_pay,
                snapshots.pdf_file_path,
            COALESCE(statuses.whatsapp_status, 'not_opened') AS whatsapp_status,
            COALESCE(statuses.email_status, 'not_sent') AS email_status,
            statuses.whatsapp_opened_at,
            statuses.whatsapp_sent_at,
            statuses.whatsapp_failed_at,
            statuses.email_sent_at,
            statuses.email_failed_at,
            COALESCE(statuses.updated_at, snapshots.created_at) AS updated_at,
            COALESCE(statuses.email_provider_message_id, '') AS email_provider_message_id,
            COALESCE(statuses.whatsapp_error_message, '') AS whatsapp_error_message,
            COALESCE(statuses.email_error_message, '') AS email_error_message,
            COALESCE(employees.email, '') AS current_employee_email
            FROM payroll_payslip_snapshots snapshots
            LEFT JOIN payroll_payslip_delivery_statuses statuses
                ON statuses.payslip_snapshot_id = snapshots.id
            LEFT JOIN employees
                ON employees.id = snapshots.employee_id
            WHERE snapshots.id = ?1
            ",
            [payslip_snapshot_id],
            queue_item_from_row,
        )
        .optional()
        .map_err(AppError::from)
}

fn queue_item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PayslipDeliveryQueueItem> {
    let snapshot_json: String = row.get(3)?;
    let snapshot: StoredPayslipSnapshot = serde_json::from_str(&snapshot_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            3,
            rusqlite::types::Type::Text,
            Box::new(error),
        )
    })?;

    let current_employee_email: String = row.get(17)?;
    let employee_email = if snapshot.employee.email.trim().is_empty() {
        current_employee_email
    } else {
        snapshot.employee.email
    };

    Ok(PayslipDeliveryQueueItem {
        payslip_snapshot_id: row.get(0)?,
        payroll_run_id: row.get(1)?,
        employee_id: row.get(2)?,
        employee_nik: snapshot.employee.nik,
        employee_name: snapshot.employee.name,
        employee_position: snapshot.employee.position,
        whatsapp_number: snapshot.employee.whatsapp_number,
        employee_email,
        period_label: snapshot.payroll.period.label,
        net_pay: row.get(4)?,
        pdf_file_path: row.get(5)?,
        whatsapp_status: row.get(6)?,
        email_status: row.get(7)?,
        whatsapp_opened_at: row.get(8)?,
        whatsapp_sent_at: row.get(9)?,
        whatsapp_failed_at: row.get(10)?,
        email_sent_at: row.get(11)?,
        email_failed_at: row.get(12)?,
        updated_at: row.get(13)?,
        email_provider_message_id: row.get(14)?,
        whatsapp_error_message: row.get(15)?,
        email_error_message: row.get(16)?,
    })
}

fn send_resend_email(
    settings: &settings_service::StoredEmailDeliverySettings,
    item: &PayslipDeliveryQueueItem,
    pdf_path: &PathBuf,
) -> Result<String, String> {
    let pdf_bytes = fs::read(pdf_path).map_err(|_| "file PDF slip tidak bisa dibaca".to_string())?;
    let attachment = BASE64_STANDARD.encode(pdf_bytes);
    let filename = pdf_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("slip-gaji.pdf")
        .to_string();
    let from = format!("{} <{}>", settings.from_name, settings.from_email);
    let subject = format!("Slip Gaji {}", item.period_label);
    let text = format!(
        "Halo {},\n\nTerlampir slip gaji periode {}.\n\nMohon dicek kembali. Jika ada pertanyaan, silakan hubungi bagian payroll.\n\nTerima kasih.",
        item.employee_name, item.period_label
    );
    let html = format!(
        "<p>Halo {},</p><p>Terlampir slip gaji periode <strong>{}</strong>.</p><p>Mohon dicek kembali. Jika ada pertanyaan, silakan hubungi bagian payroll.</p><p>Terima kasih.</p>",
        escape_html(&item.employee_name),
        escape_html(&item.period_label)
    );
    let mut payload = serde_json::json!({
        "from": from,
        "to": [&item.employee_email],
        "subject": subject,
        "html": html,
        "text": text,
        "attachments": [{
            "filename": filename,
            "content": attachment
        }]
    });

    if !settings.reply_to_email.trim().is_empty() {
        payload["reply_to"] = serde_json::json!(&settings.reply_to_email);
    }

    let client = Client::new();
    let response = client
        .post("https://api.resend.com/emails")
        .bearer_auth(&settings.resend_api_key)
        .header("Idempotency-Key", format!("payslip-email-{}", item.payslip_snapshot_id))
        .json(&payload)
        .send()
        .map_err(|_| "tidak bisa terhubung ke Resend".to_string())?;
    let status = response.status();
    let body = response.text().unwrap_or_default();

    if status == StatusCode::OK || status == StatusCode::CREATED {
        let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
        return Ok(parsed
            .get("id")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string());
    }

    let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
    let message = parsed
        .get("message")
        .and_then(|value| value.as_str())
        .unwrap_or("Resend menolak request");
    Err(format!("Resend HTTP {}: {message}", status.as_u16()))
}

fn mark_email_sent(
    connection: &rusqlite::Connection,
    input: &UpdateDeliveryStatusInput,
    provider_message_id: &str,
) -> Result<(), AppError> {
    upsert_email_status(connection, input, "sent", Some(provider_message_id), "")
}

fn mark_email_failed(
    connection: &rusqlite::Connection,
    input: &UpdateDeliveryStatusInput,
    error_message: &str,
) -> Result<(), AppError> {
    upsert_email_status(connection, input, "failed", None, error_message)
}

fn mark_email_missing(
    connection: &rusqlite::Connection,
    input: &UpdateDeliveryStatusInput,
    error_message: &str,
) -> Result<(), AppError> {
    upsert_email_status(connection, input, "missing_email", None, error_message)
}

fn upsert_email_status(
    connection: &rusqlite::Connection,
    input: &UpdateDeliveryStatusInput,
    status: &str,
    provider_message_id: Option<&str>,
    error_message: &str,
) -> Result<(), AppError> {
    connection.execute(
        "
        INSERT INTO payroll_payslip_delivery_statuses (
            payslip_snapshot_id, status, opened_at, sent_at, failed_at,
            whatsapp_status, email_status, whatsapp_opened_at, whatsapp_sent_at,
            whatsapp_failed_at, email_sent_at, email_failed_at,
            actor_user_id, actor_display_name, actor_role, updated_at,
            channel, provider_message_id, error_message,
            email_provider_message_id, whatsapp_error_message, email_error_message
        )
        VALUES (
            ?1,
            CASE WHEN ?2 IN ('missing_email', 'failed') THEN 'failed' WHEN ?2 = 'sent' THEN 'sent' ELSE 'not_opened' END,
            NULL, NULL, NULL,
            'not_opened', ?2, NULL, NULL, NULL,
            CASE WHEN ?2 = 'sent' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
            CASE WHEN ?2 IN ('failed', 'missing_email') THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
            ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
            'email_resend', ?6, ?7, ?6, '', ?7
        )
        ON CONFLICT(payslip_snapshot_id) DO UPDATE SET
            email_status = excluded.email_status,
            email_sent_at = excluded.email_sent_at,
            email_failed_at = excluded.email_failed_at,
            actor_user_id = excluded.actor_user_id,
            actor_display_name = excluded.actor_display_name,
            actor_role = excluded.actor_role,
            updated_at = excluded.updated_at,
            channel = excluded.channel,
            provider_message_id = excluded.provider_message_id,
            error_message = excluded.error_message,
            email_provider_message_id = excluded.email_provider_message_id,
            email_error_message = excluded.email_error_message
        ",
        params![
            &input.payslip_snapshot_id,
            status,
            &input.actor.user_id,
            &input.actor.display_name,
            &input.actor.role,
            provider_message_id.unwrap_or(""),
            error_message,
        ],
    )?;

    Ok(())
}

fn ensure_snapshot_exists(
    connection: &rusqlite::Connection,
    payslip_snapshot_id: &str,
) -> Result<(), AppError> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM payroll_payslip_snapshots WHERE id = ?1)",
        [payslip_snapshot_id],
        |row| row.get(0),
    )?;

    if exists {
        Ok(())
    } else {
        Err(AppError::Database("snapshot slip tidak ditemukan".to_string()))
    }
}

fn validate_actor(actor: &DeliveryActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh mengubah status pengiriman slip".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}

fn validate_status(status: &str) -> Result<(), AppError> {
    if matches!(status, "not_opened" | "opened" | "sent_manual" | "failed" | "missing_number") {
        Ok(())
    } else {
        Err(AppError::Database("status pengiriman slip tidak valid".to_string()))
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#039;")
}

fn is_resend_email_delivery_disabled() -> bool {
    true
}
