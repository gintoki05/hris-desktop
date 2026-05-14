use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use reqwest::blocking::Client;
use reqwest::StatusCode;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{
    error::AppError,
    services::{database_service, settings_service},
};

#[derive(Clone, Deserialize)]
pub struct PayslipManagerActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct PayslipPeriodInput {
    pub id: Option<String>,
    pub label: String,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Serialize)]
pub struct PayslipPeriod {
    pub id: String,
    pub label: String,
    pub start_date: String,
    pub end_date: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct PayslipSnapshotInput {
    pub id: Option<String>,
    pub employee_id: Option<String>,
    pub employee_nik: String,
    pub employee_name: String,
    pub employee_position: String,
    pub whatsapp_number: String,
    pub snapshot_json: String,
    pub net_pay: i64,
}

#[derive(Deserialize)]
pub struct PayslipImportBatchInput {
    pub period_id: String,
    pub source_file_name: String,
    pub total_rows: i64,
    pub valid_rows: i64,
    pub error_rows: i64,
    pub notes: String,
    pub snapshots: Vec<PayslipSnapshotInput>,
    pub actor: PayslipManagerActor,
}

#[derive(Serialize)]
pub struct PayslipImportBatch {
    pub id: String,
    pub period_id: String,
    pub source_file_name: String,
    pub imported_by_display_name: String,
    pub total_rows: i64,
    pub valid_rows: i64,
    pub error_rows: i64,
    pub notes: String,
    pub imported_at: String,
}

#[derive(Serialize)]
pub struct PayslipSnapshot {
    pub id: String,
    pub period_id: String,
    pub import_batch_id: String,
    pub employee_id: Option<String>,
    pub employee_nik: String,
    pub employee_name: String,
    pub employee_position: String,
    pub whatsapp_number: String,
    pub snapshot_json: String,
    pub net_pay: i64,
    pub pdf_file_path: String,
    pub send_status: String,
    pub whatsapp_status: String,
    pub email_status: String,
    pub whatsapp_opened_at: Option<String>,
    pub whatsapp_sent_at: Option<String>,
    pub whatsapp_failed_at: Option<String>,
    pub email_sent_at: Option<String>,
    pub email_failed_at: Option<String>,
    pub email_error_message: String,
    pub status_updated_at: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct PayslipSnapshotStatusInput {
    pub snapshot_id: String,
    pub send_status: String,
    pub pdf_file_path: Option<String>,
    pub actor: PayslipManagerActor,
}

#[derive(Deserialize)]
pub struct PayslipTemplateExportInput {
    pub target_path: String,
    pub bytes: Vec<u8>,
    pub actor: PayslipManagerActor,
}

#[derive(Deserialize)]
pub struct PayslipPdfGenerationInput {
    pub period_id: String,
    pub actor: PayslipManagerActor,
}

#[derive(Deserialize)]
pub struct PayslipEmailInput {
    pub snapshot_id: String,
    pub actor: PayslipManagerActor,
}

#[derive(Deserialize, Serialize, Clone)]
struct PayrollComponentSnapshot {
    name: String,
    amount: i64,
}

#[derive(Deserialize, Serialize)]
struct CompanySnapshot {
    name: String,
    address: String,
    #[serde(rename = "treasurerName")]
    treasurer_name: String,
}

#[derive(Deserialize, Serialize)]
struct EmployeeSnapshot {
    #[serde(default)]
    id: String,
    nik: String,
    name: String,
    position: String,
    #[serde(default)]
    npwp: String,
    #[serde(default)]
    email: String,
    #[serde(rename = "whatsappNumber")]
    whatsapp_number: String,
}

#[derive(Deserialize, Serialize)]
struct PayrollPeriodSnapshot {
    id: String,
    label: String,
    #[serde(rename = "startDate")]
    start_date: String,
    #[serde(rename = "endDate")]
    end_date: String,
}

#[derive(Deserialize, Serialize)]
struct PayrollSnapshot {
    period: PayrollPeriodSnapshot,
    #[serde(rename = "incomeComponents")]
    income_components: Vec<PayrollComponentSnapshot>,
    #[serde(rename = "deductionComponents")]
    deduction_components: Vec<PayrollComponentSnapshot>,
    #[serde(rename = "grossPay")]
    gross_pay: i64,
    #[serde(rename = "totalDeductions")]
    total_deductions: i64,
    #[serde(rename = "netPay")]
    net_pay: i64,
}

#[derive(Deserialize, Serialize)]
struct ImportedPayslipSnapshot {
    employee: EmployeeSnapshot,
    payroll: PayrollSnapshot,
    #[serde(rename = "amountInWords", default)]
    amount_in_words: String,
    #[serde(default)]
    company: Option<CompanySnapshot>,
}

const INCOME_COMPONENT_NAMES: [&str; 6] = [
    "Gaji Pokok",
    "Tunjangan Kinerja",
    "Tunjangan Tidak Tetap",
    "Jasa Tindakan",
    "Uang Makan",
    "Lembur",
];

const DEDUCTION_COMPONENT_NAMES: [&str; 6] = [
    "Pajak PPh21",
    "BPJS Kesehatan",
    "BPJS TK",
    "Potongan Kasbon",
    "Potongan Absen",
    "Potongan Terlambat",
];

pub fn list_payslip_periods(app: &AppHandle) -> Result<Vec<PayslipPeriod>, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    let mut statement = connection.prepare(
        "
        SELECT id, label, start_date, end_date, status, created_at, updated_at
        FROM payslip_periods
        ORDER BY start_date DESC, created_at DESC
        ",
    )?;

    let rows = statement.query_map([], payslip_period_from_row)?;
    collect_rows(rows)
}

pub fn save_payslip_period(
    app: &AppHandle,
    input: PayslipPeriodInput,
    actor: PayslipManagerActor,
) -> Result<PayslipPeriod, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&actor)?;

    let period = normalize_period(input)?;
    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;
    let now = utc_now_string(&transaction)?;
    let period_id = match period.id {
        Some(id) => id,
        None => transaction
            .query_row(
                "
                SELECT id
                FROM payslip_periods
                WHERE start_date = ?1 AND end_date = ?2
                ",
                params![&period.start_date, &period.end_date],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or(create_id("payslip-period")?),
    };

    transaction.execute(
        "
        INSERT INTO payslip_periods (
            id, label, start_date, end_date, status, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?5)
        ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            updated_at = excluded.updated_at
        ",
        params![
            &period_id,
            &period.label,
            &period.start_date,
            &period.end_date,
            &now,
        ],
    )?;

    transaction.commit()?;
    get_payslip_period(app, &period_id)?
        .ok_or_else(|| AppError::Database("periode slip tersimpan tetapi gagal dibaca ulang".to_string()))
}

pub fn save_payslip_import_batch(
    app: &AppHandle,
    input: PayslipImportBatchInput,
) -> Result<PayslipImportBatch, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    validate_import_batch(&input)?;

    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;
    ensure_period_exists(&transaction, &input.period_id)?;

    let now = utc_now_string(&transaction)?;
    let batch_id = create_id("payslip-import")?;
    let period_id = input.period_id.trim().to_string();
    let source_file_name = input.source_file_name.trim().to_string();
    let notes = input.notes.trim().to_string();

    transaction.execute(
        "
        INSERT INTO payslip_import_batches (
            id, period_id, source_file_name, imported_by_user_id,
            imported_by_display_name, imported_by_role, total_rows, valid_rows,
            error_rows, notes, imported_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ",
        params![
            &batch_id,
            &period_id,
            &source_file_name,
            input.actor.user_id.trim(),
            input.actor.display_name.trim(),
            input.actor.role.trim(),
            input.total_rows,
            input.valid_rows,
            input.error_rows,
            &notes,
            &now,
        ],
    )?;

    for (index, snapshot) in input.snapshots.into_iter().enumerate() {
        let normalized = normalize_snapshot(snapshot)?;
        let snapshot_id = normalized
            .id
            .unwrap_or(format!("{}-{index}", create_id("payslip-snapshot")?));
        transaction.execute(
            "
            INSERT INTO payslip_snapshots (
                id, period_id, import_batch_id, employee_id, employee_nik,
                employee_name, employee_position, whatsapp_number, snapshot_json,
                net_pay, send_status, status_updated_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'not_generated', ?11, ?11, ?11)
            ",
            params![
                &snapshot_id,
                &period_id,
                &batch_id,
                normalized.employee_id.as_deref(),
                &normalized.employee_nik,
                &normalized.employee_name,
                &normalized.employee_position,
                &normalized.whatsapp_number,
                &normalized.snapshot_json,
                normalized.net_pay,
                &now,
            ],
        )?;
    }

    transaction.execute(
        "
        UPDATE payslip_periods
        SET status = 'imported', updated_at = ?1
        WHERE id = ?2 AND status = 'draft'
        ",
        params![&now, &period_id],
    )?;

    transaction.commit()?;
    get_payslip_import_batch(app, &batch_id)?
        .ok_or_else(|| AppError::Database("batch import slip tersimpan tetapi gagal dibaca ulang".to_string()))
}

pub fn list_payslip_snapshots(
    app: &AppHandle,
    period_id: &str,
) -> Result<Vec<PayslipSnapshot>, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    let mut statement = connection.prepare(
        "
        SELECT
            id, period_id, import_batch_id, employee_id, employee_nik,
            employee_name, employee_position, whatsapp_number, snapshot_json,
            net_pay, pdf_file_path, send_status, whatsapp_status, email_status,
            whatsapp_opened_at, whatsapp_sent_at, whatsapp_failed_at,
            email_sent_at, email_failed_at, email_error_message,
            status_updated_at, created_at, updated_at
        FROM payslip_snapshots
        WHERE period_id = ?1
        ORDER BY employee_name ASC, employee_nik ASC
        ",
    )?;

    let rows = statement.query_map([period_id.trim()], payslip_snapshot_from_row)?;
    collect_rows(rows)
}

pub fn update_payslip_snapshot_status(
    app: &AppHandle,
    input: PayslipSnapshotStatusInput,
) -> Result<PayslipSnapshot, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    validate_send_status(&input.send_status)?;

    let connection = database_service::open_local_connection(app)?;
    ensure_snapshot_exists(&connection, &input.snapshot_id)?;
    let pdf_file_path = input.pdf_file_path.unwrap_or_default().trim().to_string();

    connection.execute(
        "
        UPDATE payslip_snapshots
        SET
            send_status = ?1,
            pdf_file_path = CASE WHEN ?2 = '' THEN pdf_file_path ELSE ?2 END,
            whatsapp_status = CASE
                WHEN ?1 = 'whatsapp_opened' THEN 'opened'
                WHEN ?1 = 'sent' THEN 'sent_manual'
                WHEN ?1 = 'failed_missing_number' THEN 'missing_number'
                WHEN ?1 = 'failed' THEN 'failed'
                ELSE whatsapp_status
            END,
            whatsapp_opened_at = CASE WHEN ?1 = 'whatsapp_opened' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE whatsapp_opened_at END,
            whatsapp_sent_at = CASE WHEN ?1 = 'sent' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE whatsapp_sent_at END,
            whatsapp_failed_at = CASE WHEN ?1 IN ('failed_missing_number', 'failed') THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE whatsapp_failed_at END,
            status_updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?3
        ",
        params![input.send_status.trim(), &pdf_file_path, input.snapshot_id.trim()],
    )?;

    get_payslip_snapshot(&connection, &input.snapshot_id)?
        .ok_or_else(|| AppError::Database("status slip tersimpan tetapi gagal dibaca ulang".to_string()))
}

pub fn export_payslip_template_file(
    app: &AppHandle,
    input: PayslipTemplateExportInput,
) -> Result<String, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;

    if input.bytes.is_empty() {
        return Err(AppError::Database("template slip kosong dan tidak bisa disimpan".to_string()));
    }

    let target_path = normalize_template_target_path(&input.target_path)?;
    fs::write(&target_path, input.bytes)?;
    Ok(target_path.display().to_string())
}

pub fn generate_payslip_pdfs(
    app: &AppHandle,
    input: PayslipPdfGenerationInput,
) -> Result<Vec<PayslipSnapshot>, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;

    let mut connection = database_service::open_local_connection(app)?;
    let period_id = input.period_id.trim().to_string();
    ensure_period_exists(&connection, &period_id)?;

    let company = get_company_snapshot(&connection)?;
    let payslip_directory = resolve_payslip_directory(app)?.join(sanitize_file_name(&period_id));
    fs::create_dir_all(&payslip_directory)?;

    let snapshots = list_payslip_snapshots(app, &period_id)?;
    if snapshots.is_empty() {
        return Err(AppError::Database(
            "belum ada snapshot slip untuk dibuatkan PDF".to_string(),
        ));
    }

    let transaction = connection.transaction()?;
    let now = utc_now_string(&transaction)?;

    for snapshot in snapshots {
        let payslip = parse_imported_snapshot(&snapshot.snapshot_json)?;
        let pdf_path = payslip_directory.join(format!(
            "{}-{}.pdf",
            sanitize_file_name(&payslip.payroll.period.label),
            sanitize_file_name(&format!(
                "{}-{}-{}",
                snapshot.employee_nik, snapshot.employee_name, snapshot.id
            )),
        ));
        write_payslip_pdf(&pdf_path, &payslip, &company)?;

        let snapshot_json = enrich_imported_snapshot_json(&snapshot.snapshot_json, &company)?;
        transaction.execute(
            "
            UPDATE payslip_snapshots
            SET
                snapshot_json = ?1,
                pdf_file_path = ?2,
                send_status = 'pdf_ready',
                whatsapp_status = CASE WHEN whatsapp_status = 'not_opened' AND trim(whatsapp_number) = '' THEN 'missing_number' ELSE whatsapp_status END,
                status_updated_at = ?3,
                updated_at = ?3
            WHERE id = ?4
            ",
            params![
                &snapshot_json,
                pdf_path.display().to_string(),
                &now,
                &snapshot.id,
            ],
        )?;
    }

    transaction.execute(
        "
        UPDATE payslip_periods
        SET status = 'pdf_ready', updated_at = ?1
        WHERE id = ?2
        ",
        params![&now, &period_id],
    )?;
    transaction.commit()?;

    list_payslip_snapshots(app, &period_id)
}

pub fn send_payslip_email(
    app: &AppHandle,
    input: PayslipEmailInput,
) -> Result<PayslipSnapshot, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;

    let connection = database_service::open_local_connection(app)?;
    let snapshot = get_payslip_snapshot(&connection, &input.snapshot_id)?
        .ok_or_else(|| AppError::Database("snapshot slip tidak ditemukan".to_string()))?;
    let settings = settings_service::get_resend_delivery_settings(app)?;

    if !settings.enabled {
        return Err(AppError::Database("pengiriman email belum diaktifkan di Settings".to_string()));
    }

    if snapshot.pdf_file_path.trim().is_empty() {
        update_payslip_snapshot_email_status(app, &snapshot.id, "failed", "PDF slip belum dibuat")?;
        return Err(AppError::Database("PDF slip belum dibuat".to_string()));
    }

    let pdf_path = PathBuf::from(&snapshot.pdf_file_path);
    if !pdf_path.exists() {
        update_payslip_snapshot_email_status(app, &snapshot.id, "failed", "file PDF slip tidak ditemukan")?;
        return Err(AppError::Database("file PDF slip tidak ditemukan".to_string()));
    }

    let payslip = parse_imported_snapshot(&snapshot.snapshot_json)?;
    let employee_email = resolve_snapshot_email(&connection, &snapshot, &payslip)?;
    if employee_email.trim().is_empty() {
        update_payslip_snapshot_email_status(app, &snapshot.id, "missing_email", "email karyawan belum diisi")?;
        return Err(AppError::Database("email karyawan belum diisi".to_string()));
    }

    if let Err(error) = send_resend_email(&settings, &snapshot, &payslip, &employee_email, &pdf_path) {
        update_payslip_snapshot_email_status(app, &snapshot.id, "failed", &error)?;
        return Err(AppError::Database(format!("email slip gagal dikirim: {error}")));
    }

    update_payslip_snapshot_email_status(app, &snapshot.id, "sent", "")
}

fn update_payslip_snapshot_email_status(
    app: &AppHandle,
    snapshot_id: &str,
    email_status: &str,
    error_message: &str,
) -> Result<PayslipSnapshot, AppError> {
    let connection = database_service::open_local_connection(app)?;
    connection.execute(
        "
        UPDATE payslip_snapshots
        SET
            email_status = ?1,
            email_sent_at = CASE WHEN ?1 = 'sent' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE email_sent_at END,
            email_failed_at = CASE WHEN ?1 IN ('failed', 'missing_email') THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE email_failed_at END,
            email_error_message = ?2,
            status_updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?3
        ",
        params![email_status, error_message, snapshot_id],
    )?;

    get_payslip_snapshot(&connection, snapshot_id)?
        .ok_or_else(|| AppError::Database("status email slip tersimpan tetapi gagal dibaca ulang".to_string()))
}

fn get_payslip_period(
    app: &AppHandle,
    period_id: &str,
) -> Result<Option<PayslipPeriod>, AppError> {
    let connection = database_service::open_local_connection(app)?;
    connection
        .query_row(
            "
            SELECT id, label, start_date, end_date, status, created_at, updated_at
            FROM payslip_periods
            WHERE id = ?1
            ",
            [period_id],
            payslip_period_from_row,
        )
        .optional()
        .map_err(AppError::from)
}

fn get_payslip_import_batch(
    app: &AppHandle,
    batch_id: &str,
) -> Result<Option<PayslipImportBatch>, AppError> {
    let connection = database_service::open_local_connection(app)?;
    connection
        .query_row(
            "
            SELECT
                id, period_id, source_file_name, imported_by_display_name,
                total_rows, valid_rows, error_rows, notes, imported_at
            FROM payslip_import_batches
            WHERE id = ?1
            ",
            [batch_id],
            payslip_import_batch_from_row,
        )
        .optional()
        .map_err(AppError::from)
}

fn get_payslip_snapshot(
    connection: &rusqlite::Connection,
    snapshot_id: &str,
) -> Result<Option<PayslipSnapshot>, AppError> {
    connection
        .query_row(
            "
            SELECT
                id, period_id, import_batch_id, employee_id, employee_nik,
                employee_name, employee_position, whatsapp_number, snapshot_json,
                net_pay, pdf_file_path, send_status, whatsapp_status, email_status,
                whatsapp_opened_at, whatsapp_sent_at, whatsapp_failed_at,
                email_sent_at, email_failed_at, email_error_message,
                status_updated_at, created_at, updated_at
            FROM payslip_snapshots
            WHERE id = ?1
            ",
            [snapshot_id.trim()],
            payslip_snapshot_from_row,
        )
        .optional()
        .map_err(AppError::from)
}

fn payslip_period_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PayslipPeriod> {
    Ok(PayslipPeriod {
        id: row.get(0)?,
        label: row.get(1)?,
        start_date: row.get(2)?,
        end_date: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn payslip_import_batch_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PayslipImportBatch> {
    Ok(PayslipImportBatch {
        id: row.get(0)?,
        period_id: row.get(1)?,
        source_file_name: row.get(2)?,
        imported_by_display_name: row.get(3)?,
        total_rows: row.get(4)?,
        valid_rows: row.get(5)?,
        error_rows: row.get(6)?,
        notes: row.get(7)?,
        imported_at: row.get(8)?,
    })
}

fn payslip_snapshot_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PayslipSnapshot> {
    Ok(PayslipSnapshot {
        id: row.get(0)?,
        period_id: row.get(1)?,
        import_batch_id: row.get(2)?,
        employee_id: row.get(3)?,
        employee_nik: row.get(4)?,
        employee_name: row.get(5)?,
        employee_position: row.get(6)?,
        whatsapp_number: row.get(7)?,
        snapshot_json: row.get(8)?,
        net_pay: row.get(9)?,
        pdf_file_path: row.get(10)?,
        send_status: row.get(11)?,
        whatsapp_status: row.get(12)?,
        email_status: row.get(13)?,
        whatsapp_opened_at: row.get(14)?,
        whatsapp_sent_at: row.get(15)?,
        whatsapp_failed_at: row.get(16)?,
        email_sent_at: row.get(17)?,
        email_failed_at: row.get(18)?,
        email_error_message: row.get(19)?,
        status_updated_at: row.get(20)?,
        created_at: row.get(21)?,
        updated_at: row.get(22)?,
    })
}

fn collect_rows<T, F>(rows: rusqlite::MappedRows<'_, F>) -> Result<Vec<T>, AppError>
where
    F: FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
{
    let mut values = Vec::new();
    for row in rows {
        values.push(row?);
    }

    Ok(values)
}

fn normalize_period(input: PayslipPeriodInput) -> Result<PayslipPeriodInput, AppError> {
    let period = PayslipPeriodInput {
        id: input.id.map(|id| id.trim().to_string()).filter(|id| !id.is_empty()),
        label: input.label.trim().to_string(),
        start_date: input.start_date.trim().to_string(),
        end_date: input.end_date.trim().to_string(),
    };

    validate_required("label periode slip", &period.label)?;
    validate_required("tanggal mulai periode slip", &period.start_date)?;
    validate_required("tanggal selesai periode slip", &period.end_date)?;

    Ok(period)
}

fn normalize_snapshot(input: PayslipSnapshotInput) -> Result<PayslipSnapshotInput, AppError> {
    let snapshot = PayslipSnapshotInput {
        id: input.id.map(|id| id.trim().to_string()).filter(|id| !id.is_empty()),
        employee_id: input
            .employee_id
            .map(|id| id.trim().to_string())
            .filter(|id| !id.is_empty()),
        employee_nik: input.employee_nik.trim().to_string(),
        employee_name: input.employee_name.trim().to_string(),
        employee_position: input.employee_position.trim().to_string(),
        whatsapp_number: input.whatsapp_number.trim().to_string(),
        snapshot_json: input.snapshot_json.trim().to_string(),
        net_pay: input.net_pay,
    };

    validate_required("nama karyawan di snapshot slip", &snapshot.employee_name)?;
    validate_required("snapshot JSON slip", &snapshot.snapshot_json)?;
    if snapshot.net_pay < 0 {
        return Err(AppError::Database("gaji bersih snapshot tidak boleh negatif".to_string()));
    }

    let _: serde_json::Value = serde_json::from_str(&snapshot.snapshot_json)
        .map_err(|_| AppError::Database("snapshot JSON slip tidak valid".to_string()))?;

    Ok(snapshot)
}

fn validate_import_batch(input: &PayslipImportBatchInput) -> Result<(), AppError> {
    validate_required("periode import slip", &input.period_id)?;
    validate_required("nama file sumber slip", &input.source_file_name)?;

    if input.total_rows < 0 || input.valid_rows < 0 || input.error_rows < 0 {
        return Err(AppError::Database("jumlah baris import tidak boleh negatif".to_string()));
    }

    if input.valid_rows + input.error_rows > input.total_rows {
        return Err(AppError::Database(
            "jumlah baris valid dan error tidak boleh melebihi total baris".to_string(),
        ));
    }

    if input.snapshots.is_empty() {
        return Err(AppError::Database(
            "minimal satu snapshot slip valid diperlukan untuk menyimpan import".to_string(),
        ));
    }

    Ok(())
}

fn validate_actor(actor: &PayslipManagerActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh mengelola slip gaji".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}

fn validate_required(label: &str, value: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Database(format!("{label} wajib diisi")));
    }

    Ok(())
}

fn validate_send_status(status: &str) -> Result<(), AppError> {
    if matches!(
        status.trim(),
        "not_generated" | "pdf_ready" | "whatsapp_opened" | "sent" | "failed_missing_number" | "failed"
    ) {
        Ok(())
    } else {
        Err(AppError::Database("status kirim slip tidak valid".to_string()))
    }
}

fn ensure_period_exists(
    connection: &rusqlite::Connection,
    period_id: &str,
) -> Result<(), AppError> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM payslip_periods WHERE id = ?1)",
        [period_id.trim()],
        |row| row.get(0),
    )?;

    if exists {
        Ok(())
    } else {
        Err(AppError::Database("periode slip tidak ditemukan".to_string()))
    }
}

fn ensure_snapshot_exists(
    connection: &rusqlite::Connection,
    snapshot_id: &str,
) -> Result<(), AppError> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM payslip_snapshots WHERE id = ?1)",
        [snapshot_id.trim()],
        |row| row.get(0),
    )?;

    if exists {
        Ok(())
    } else {
        Err(AppError::Database("snapshot slip tidak ditemukan".to_string()))
    }
}

fn normalize_template_target_path(value: &str) -> Result<PathBuf, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Path("lokasi simpan template wajib dipilih".to_string()));
    }

    let mut target_path = PathBuf::from(trimmed);
    if target_path.extension().and_then(|extension| extension.to_str()) != Some("xlsx") {
        target_path.set_extension("xlsx");
    }

    let parent = target_path
        .parent()
        .ok_or_else(|| AppError::Path("folder tujuan template tidak valid".to_string()))?;
    ensure_parent_directory_exists(parent)?;

    Ok(target_path)
}

fn ensure_parent_directory_exists(parent: &Path) -> Result<(), AppError> {
    if parent.exists() && parent.is_dir() {
        Ok(())
    } else {
        Err(AppError::Path("folder tujuan template tidak ditemukan".to_string()))
    }
}

fn get_company_snapshot(connection: &rusqlite::Connection) -> Result<CompanySnapshot, AppError> {
    connection
        .query_row(
            "
            SELECT company_name, address, treasurer_name
            FROM company_settings
            WHERE id = 'default'
            ",
            [],
            |row| {
                Ok(CompanySnapshot {
                    name: row.get(0)?,
                    address: row.get(1)?,
                    treasurer_name: row.get(2)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Database("master perusahaan belum tersedia".to_string()))
}

fn parse_imported_snapshot(value: &str) -> Result<ImportedPayslipSnapshot, AppError> {
    serde_json::from_str(value)
        .map_err(|_| AppError::Database("snapshot slip tidak bisa dibaca untuk PDF".to_string()))
}

fn enrich_imported_snapshot_json(value: &str, company: &CompanySnapshot) -> Result<String, AppError> {
    let mut snapshot: serde_json::Value = serde_json::from_str(value)
        .map_err(|_| AppError::Database("snapshot slip tidak bisa dibaca untuk PDF".to_string()))?;
    let company_value = serde_json::to_value(company)
        .map_err(|error| AppError::Database(error.to_string()))?;

    match snapshot {
        serde_json::Value::Object(ref mut object) => {
            object.insert("company".to_string(), company_value);
            serde_json::to_string(&snapshot).map_err(|error| AppError::Database(error.to_string()))
        }
        _ => Err(AppError::Database(
            "snapshot slip tidak valid untuk diperkaya data perusahaan".to_string(),
        )),
    }
}

fn resolve_payslip_directory(app: &AppHandle) -> Result<PathBuf, AppError> {
    let app_data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Path(error.to_string()))?;

    Ok(app_data_directory.join("payslips").join("manager"))
}

fn resolve_snapshot_email(
    connection: &rusqlite::Connection,
    snapshot: &PayslipSnapshot,
    payslip: &ImportedPayslipSnapshot,
) -> Result<String, AppError> {
    if !payslip.employee.email.trim().is_empty() {
        return Ok(payslip.employee.email.trim().to_lowercase());
    }

    let Some(employee_id) = snapshot.employee_id.as_deref() else {
        return Ok(String::new());
    };

    connection
        .query_row(
            "SELECT email FROM employees WHERE id = ?1",
            [employee_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map(|value| value.unwrap_or_default().trim().to_lowercase())
        .map_err(AppError::from)
}

fn send_resend_email(
    settings: &settings_service::StoredEmailDeliverySettings,
    snapshot: &PayslipSnapshot,
    payslip: &ImportedPayslipSnapshot,
    employee_email: &str,
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
    let subject = format!("Slip Gaji {}", payslip.payroll.period.label);
    let text = format!(
        "Halo {},\n\nTerlampir slip gaji periode {}.\n\nMohon dicek kembali. Jika ada pertanyaan, silakan hubungi bagian payroll.\n\nTerima kasih.",
        payslip.employee.name, payslip.payroll.period.label
    );
    let html = format!(
        "<p>Halo {},</p><p>Terlampir slip gaji periode <strong>{}</strong>.</p><p>Mohon dicek kembali. Jika ada pertanyaan, silakan hubungi bagian payroll.</p><p>Terima kasih.</p>",
        escape_html(&payslip.employee.name),
        escape_html(&payslip.payroll.period.label)
    );
    let mut payload = serde_json::json!({
        "from": from,
        "to": [employee_email],
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
        .header("Idempotency-Key", format!("payslip-manager-email-{}", snapshot.id))
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

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#039;")
}

fn write_payslip_pdf(
    path: &PathBuf,
    snapshot: &ImportedPayslipSnapshot,
    company: &CompanySnapshot,
) -> Result<(), AppError> {
    let mut page = PdfPage::new();
    page.text_center(297.5, 792.0, 15.0, true, &company.name);
    page.text_center(297.5, 774.0, 9.5, false, &company.address);
    page.text_center(
        297.5,
        755.0,
        12.0,
        true,
        &format!("SLIP GAJI - {}", snapshot.payroll.period.label),
    );
    page.line(42.0, 741.0, 553.0, 741.0);

    page.text(48.0, 719.0, 9.5, true, "NIK");
    page.text(126.0, 719.0, 9.5, false, &snapshot.employee.nik);
    page.text(318.0, 719.0, 9.5, true, "Nama");
    page.text(386.0, 719.0, 9.5, false, &snapshot.employee.name);
    page.text(48.0, 701.0, 9.5, true, "Jabatan");
    page.text(126.0, 701.0, 9.5, false, &snapshot.employee.position);
    page.text(318.0, 701.0, 9.5, true, "NPWP");
    page.text(386.0, 701.0, 9.5, false, empty_as_dash(&snapshot.employee.npwp));

    draw_component_table(
        &mut page,
        42.0,
        670.0,
        "Pendapatan",
        &INCOME_COMPONENT_NAMES,
        &snapshot.payroll.income_components,
        "Jumlah Pendapatan",
        snapshot.payroll.gross_pay,
    );
    draw_component_table(
        &mut page,
        303.0,
        670.0,
        "Potongan",
        &DEDUCTION_COMPONENT_NAMES,
        &snapshot.payroll.deduction_components,
        "Jumlah Potongan",
        snapshot.payroll.total_deductions,
    );

    page.rect(42.0, 442.0, 511.0, 36.0);
    page.text(52.0, 463.0, 11.0, true, "Gaji Bersih");
    page.text_right(
        543.0,
        463.0,
        13.0,
        true,
        &format_rupiah(snapshot.payroll.net_pay),
    );

    page.rect(42.0, 361.0, 511.0, 72.0);
    page.text(52.0, 414.0, 9.5, true, "Terbilang");
    for (index, line) in wrap_text(&snapshot.amount_in_words, 74).iter().take(3).enumerate() {
        page.text(52.0, 397.0 - (index as f32 * 15.0), 9.5, false, line);
    }

    page.text_center(442.0, 326.0, 9.5, false, "Bendahara");
    page.text_center(442.0, 244.0, 9.5, true, &company.treasurer_name);

    let content = page.finish();
    let stream = format!("{content}\n");
    let objects = vec![
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>".to_string(),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".to_string(),
        format!("<< /Length {} >> stream\n{}endstream", stream.len(), stream),
    ];
    let mut pdf = "%PDF-1.4\n".to_string();
    let mut offsets = vec![0usize];

    for (index, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.push_str(&format!("{} 0 obj\n{}\nendobj\n", index + 1, object));
    }

    let xref_offset = pdf.len();
    pdf.push_str(&format!("xref\n0 {}\n", objects.len() + 1));
    pdf.push_str("0000000000 65535 f \n");
    for offset in offsets.iter().skip(1) {
        pdf.push_str(&format!("{offset:010} 00000 n \n"));
    }
    pdf.push_str(&format!(
        "trailer << /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF",
        objects.len() + 1,
        xref_offset
    ));

    fs::write(path, pdf)?;
    Ok(())
}

struct PdfPage {
    commands: Vec<String>,
}

impl PdfPage {
    fn new() -> Self {
        Self {
            commands: Vec::new(),
        }
    }

    fn finish(self) -> String {
        self.commands.join("\n")
    }

    fn text(&mut self, x: f32, y: f32, size: f32, bold: bool, value: &str) {
        let font = if bold { "F2" } else { "F1" };
        self.commands.push(format!(
            "BT /{font} {size:.1} Tf {x:.1} {y:.1} Td ({}) Tj ET",
            escape_pdf_text(value)
        ));
    }

    fn text_center(&mut self, center_x: f32, y: f32, size: f32, bold: bool, value: &str) {
        let x = center_x - approximate_text_width(value, size) / 2.0;
        self.text(x, y, size, bold, value);
    }

    fn text_right(&mut self, right_x: f32, y: f32, size: f32, bold: bool, value: &str) {
        let x = right_x - approximate_text_width(value, size);
        self.text(x, y, size, bold, value);
    }

    fn line(&mut self, x1: f32, y1: f32, x2: f32, y2: f32) {
        self.commands
            .push(format!("{x1:.1} {y1:.1} m {x2:.1} {y2:.1} l S"));
    }

    fn rect(&mut self, x: f32, y: f32, width: f32, height: f32) {
        self.commands
            .push(format!("{x:.1} {y:.1} {width:.1} {height:.1} re S"));
    }
}

fn draw_component_table(
    page: &mut PdfPage,
    x: f32,
    y: f32,
    title: &str,
    component_names: &[&str],
    components: &[PayrollComponentSnapshot],
    total_label: &str,
    total_amount: i64,
) {
    let width = 250.0;
    let label_width = 142.0;
    let row_height = 22.0;
    let row_count = component_names.len() + 2;
    let table_height = row_height * row_count as f32;

    page.rect(x, y - table_height, width, table_height);
    page.line(x, y - row_height, x + width, y - row_height);
    page.text(x + 8.0, y - 15.0, 9.5, true, title);
    page.line(x + label_width, y - row_height, x + label_width, y - table_height);

    for (index, name) in component_names.iter().enumerate() {
        let row_top = y - row_height * (index as f32 + 1.0);
        let row_bottom = row_top - row_height;
        page.line(x, row_bottom, x + width, row_bottom);
        page.text(x + 8.0, row_top - 15.0, 8.7, false, name);
        page.text_right(
            x + width - 8.0,
            row_top - 15.0,
            8.7,
            false,
            &format_rupiah(find_component_amount(components, *name)),
        );
    }

    let total_top = y - row_height * (component_names.len() as f32 + 1.0);
    page.text(x + 8.0, total_top - 15.0, 8.9, true, total_label);
    page.text_right(
        x + width - 8.0,
        total_top - 15.0,
        8.9,
        true,
        &format_rupiah(total_amount),
    );
}

fn find_component_amount(components: &[PayrollComponentSnapshot], name: &str) -> i64 {
    components
        .iter()
        .find(|component| component.name == name)
        .map(|component| component.amount)
        .unwrap_or(0)
}

fn format_rupiah(amount: i64) -> String {
    let amount_text = amount.to_string();
    let (sign, digits) = amount_text
        .strip_prefix('-')
        .map(|digits| ("-", digits))
        .unwrap_or(("", amount_text.as_str()));
    let mut grouped = String::new();

    for (index, character) in digits.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(character);
    }

    let value = grouped.chars().rev().collect::<String>();
    format!("{sign}Rp {value}")
}

fn wrap_text(value: &str, max_chars: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();

    for word in value.split_whitespace() {
        let next_len = if current.is_empty() {
            word.len()
        } else {
            current.len() + 1 + word.len()
        };

        if next_len > max_chars && !current.is_empty() {
            lines.push(current);
            current = word.to_string();
        } else {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
        }
    }

    if !current.is_empty() {
        lines.push(current);
    }

    if lines.is_empty() {
        lines.push("-".to_string());
    }

    lines
}

fn approximate_text_width(value: &str, size: f32) -> f32 {
    value.chars().count() as f32 * size * 0.52
}

fn empty_as_dash(value: &str) -> &str {
    if value.trim().is_empty() {
        "-"
    } else {
        value
    }
}

fn escape_pdf_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

fn sanitize_file_name(value: &str) -> String {
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
        "slip-gaji".to_string()
    } else {
        trimmed
    }
}

fn create_id(prefix: &str) -> Result<String, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Database(error.to_string()))?
        .as_millis();

    Ok(format!("{prefix}-{timestamp}"))
}

fn utc_now_string(connection: &rusqlite::Connection) -> Result<String, AppError> {
    connection
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |row| row.get(0))
        .map_err(AppError::from)
}
