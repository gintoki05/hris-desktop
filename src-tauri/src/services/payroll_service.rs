use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{
    error::AppError,
    services::{database_service, payslip_pdf_logo::parse_logo_data_url},
};

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

#[derive(Deserialize)]
pub struct PayrollActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct PayrollPeriodInput {
    pub label: String,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct PayrollComponentInput {
    pub name: String,
    pub amount: i64,
}

#[derive(Deserialize)]
pub struct ManualPayrollEmployeeInput {
    pub employee_id: String,
    pub income_components: Vec<PayrollComponentInput>,
    pub deduction_components: Vec<PayrollComponentInput>,
    pub gross_pay: i64,
    pub total_deductions: i64,
    pub net_pay: i64,
    pub amount_in_words: String,
}

#[derive(Deserialize)]
pub struct ManualPayrollFinalizeInput {
    pub payroll_run_id: Option<String>,
    pub period: PayrollPeriodInput,
    pub items: Vec<ManualPayrollEmployeeInput>,
    pub actor: PayrollActor,
}

#[derive(Serialize)]
pub struct FinalizedPayrollRun {
    pub id: String,
    pub period_label: String,
    pub period_start: String,
    pub period_end: String,
    pub employee_count: usize,
    pub finalized_at: String,
}

#[derive(Deserialize)]
pub struct ManualPayrollDraftSaveInput {
    pub payroll_run_id: Option<String>,
    pub period: PayrollPeriodInput,
    pub items: Vec<ManualPayrollEmployeeInput>,
    pub actor: PayrollActor,
}

#[derive(Deserialize)]
pub struct ManualPayrollDraftQuery {
    pub period_label: String,
    pub period_start: String,
    pub period_end: String,
}

#[derive(Deserialize)]
pub struct LatestFinalizedManualPayrollQuery {
    pub period_start: String,
}

#[derive(Serialize)]
pub struct ManualPayrollDraft {
    pub payroll_run_id: String,
    pub period_label: String,
    pub period_start: String,
    pub period_end: String,
    pub status: String,
    pub items: Vec<ManualPayrollDraftItem>,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct ManualPayrollDraftItem {
    pub employee_id: String,
    pub income_components: Vec<PayrollComponentInput>,
    pub deduction_components: Vec<PayrollComponentInput>,
    pub gross_pay: i64,
    pub total_deductions: i64,
    pub net_pay: i64,
    pub amount_in_words: String,
}

#[derive(Deserialize, Serialize)]
struct CompanySnapshot {
    name: String,
    address: String,
    #[serde(rename = "treasurerName")]
    treasurer_name: String,
    #[serde(rename = "logoDataUrl", default)]
    logo_data_url: String,
}

#[derive(Deserialize, Serialize)]
struct EmployeeSnapshot {
    id: String,
    nik: String,
    name: String,
    position: String,
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
    id: String,
    #[serde(rename = "employeeId")]
    employee_id: String,
    period: PayrollPeriodSnapshot,
    #[serde(rename = "incomeComponents")]
    income_components: Vec<PayrollComponentInput>,
    #[serde(rename = "deductionComponents")]
    deduction_components: Vec<PayrollComponentInput>,
    #[serde(rename = "grossPay")]
    gross_pay: i64,
    #[serde(rename = "totalDeductions")]
    total_deductions: i64,
    #[serde(rename = "netPay")]
    net_pay: i64,
    #[serde(rename = "finalizedAt")]
    finalized_at: String,
}

#[derive(Deserialize, Serialize)]
struct PayslipSnapshot {
    company: CompanySnapshot,
    employee: EmployeeSnapshot,
    payroll: PayrollSnapshot,
    #[serde(rename = "amountInWords")]
    amount_in_words: String,
}

pub fn finalize_manual_payroll(
    app: &AppHandle,
    input: ManualPayrollFinalizeInput,
) -> Result<FinalizedPayrollRun, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    validate_period(&input.period)?;

    if input.items.is_empty() {
        return Err(AppError::Database(
            "minimal satu karyawan diperlukan untuk finalisasi payroll".to_string(),
        ));
    }

    let mut connection = database_service::open_local_connection(app)?;
    let company = get_company_snapshot(&connection)?;
    let run_id = input.payroll_run_id.clone().unwrap_or(create_id("payroll-run")?);
    let finalized_at = utc_now_string(&connection)?;
    let payslip_directory = resolve_payslip_directory(app)?;
    fs::create_dir_all(&payslip_directory)?;

    let transaction = connection.transaction()?;
    upsert_payroll_run(
        &transaction,
        &run_id,
        &input.period,
        "finalized",
        Some(&finalized_at),
        &finalized_at,
    )?;
    let payslip_period_id = upsert_payslip_period_for_payroll(
        &transaction,
        &run_id,
        &input.period,
        &finalized_at,
    )?;
    let payslip_import_batch_id = reset_payslip_manager_period(
        &transaction,
        &payslip_period_id,
        &run_id,
        input.items.len(),
        &input.actor,
        &finalized_at,
    )?;
    transaction.execute(
        "
        DELETE FROM payroll_payslip_delivery_statuses
        WHERE payslip_snapshot_id IN (
            SELECT id FROM payroll_payslip_snapshots WHERE payroll_run_id = ?1
        )
        ",
        [&run_id],
    )?;
    transaction.execute(
        "DELETE FROM payroll_payslip_snapshots WHERE payroll_run_id = ?1",
        [&run_id],
    )?;

    for (index, item) in input.items.iter().enumerate() {
        validate_item(item)?;
        let employee = get_employee_snapshot(&transaction, &item.employee_id)?;
        let snapshot_id = format!("{}-{index}", create_id("payslip")?);
        let payroll_snapshot = PayrollSnapshot {
            id: snapshot_id.clone(),
            employee_id: employee.id.clone(),
            period: PayrollPeriodSnapshot {
                id: run_id.clone(),
                label: input.period.label.trim().to_string(),
                start_date: input.period.start_date.trim().to_string(),
                end_date: input.period.end_date.trim().to_string(),
            },
            income_components: item.income_components.clone(),
            deduction_components: item.deduction_components.clone(),
            gross_pay: item.gross_pay,
            total_deductions: item.total_deductions,
            net_pay: item.net_pay,
            finalized_at: finalized_at.clone(),
        };
        let snapshot = PayslipSnapshot {
            company: CompanySnapshot {
                name: company.name.clone(),
                address: company.address.clone(),
                treasurer_name: company.treasurer_name.clone(),
                logo_data_url: company.logo_data_url.clone(),
            },
            employee,
            payroll: payroll_snapshot,
            amount_in_words: item.amount_in_words.trim().to_string(),
        };
        let snapshot_json = serde_json::to_string(&snapshot)
            .map_err(|error| AppError::Database(error.to_string()))?;
        let pdf_file_path = payslip_directory.join(format!(
            "{}-{}.pdf",
            sanitize_file_name(&input.period.label),
            snapshot.id_for_file()
        ));
        write_payslip_pdf(&pdf_file_path, &snapshot)?;

        transaction.execute(
            "
            INSERT INTO payroll_payslip_snapshots (
                id, payroll_run_id, employee_id, snapshot_json, net_pay, pdf_file_path, created_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ",
            params![
                &snapshot_id,
                &run_id,
                &snapshot.employee.id,
                &snapshot_json,
                item.net_pay,
                pdf_file_path.display().to_string(),
                &finalized_at,
            ],
        )?;

        transaction.execute(
            "
            INSERT INTO payroll_payslip_delivery_statuses (
                payslip_snapshot_id, status, whatsapp_status, email_status,
                actor_user_id, actor_display_name, actor_role, updated_at
            )
            VALUES (?1, 'not_opened', 'not_opened', 'not_sent', ?2, ?3, ?4, ?5)
            ",
            params![
                &snapshot_id,
                &input.actor.user_id,
                &input.actor.display_name,
                &input.actor.role,
                &finalized_at,
            ],
        )?;

        transaction.execute(
            "
            INSERT INTO payslip_snapshots (
                id, period_id, import_batch_id, employee_id, employee_nik,
                employee_name, employee_position, whatsapp_number, snapshot_json,
                net_pay, pdf_file_path, send_status, whatsapp_status, email_status,
                status_updated_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'pdf_ready',
                CASE WHEN trim(?8) = '' THEN 'missing_number' ELSE 'not_opened' END,
                'not_sent', ?12, ?12, ?12)
            ",
            params![
                &snapshot_id,
                &payslip_period_id,
                &payslip_import_batch_id,
                &snapshot.employee.id,
                &snapshot.employee.nik,
                &snapshot.employee.name,
                &snapshot.employee.position,
                &snapshot.employee.whatsapp_number,
                &snapshot_json,
                item.net_pay,
                pdf_file_path.display().to_string(),
                &finalized_at,
            ],
        )?;
    }

    transaction.execute(
        "
        UPDATE payslip_periods
        SET status = 'pdf_ready', updated_at = ?1
        WHERE id = ?2
        ",
        params![&finalized_at, &payslip_period_id],
    )?;

    transaction.commit()?;

    Ok(FinalizedPayrollRun {
        id: run_id,
        period_label: input.period.label.trim().to_string(),
        period_start: input.period.start_date.trim().to_string(),
        period_end: input.period.end_date.trim().to_string(),
        employee_count: input.items.len(),
        finalized_at,
    })
}

pub fn save_manual_payroll_draft(
    app: &AppHandle,
    input: ManualPayrollDraftSaveInput,
) -> Result<ManualPayrollDraft, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&input.actor)?;
    validate_period(&input.period)?;

    if input.items.is_empty() {
        return Err(AppError::Database(
            "minimal satu karyawan diperlukan untuk menyimpan draft payroll".to_string(),
        ));
    }

    let mut connection = database_service::open_local_connection(app)?;
    let now = utc_now_string(&connection)?;
    let run_id = input.payroll_run_id.clone().unwrap_or(create_id("payroll-run")?);
    let transaction = connection.transaction()?;
    upsert_payroll_run(&transaction, &run_id, &input.period, "draft", None, &now)?;
    transaction.execute(
        "DELETE FROM payroll_manual_draft_items WHERE payroll_run_id = ?1",
        [&run_id],
    )?;

    for (index, item) in input.items.iter().enumerate() {
        validate_item(item)?;
        ensure_employee_active(&transaction, &item.employee_id)?;
        let income_json = serde_json::to_string(&item.income_components)
            .map_err(|error| AppError::Database(error.to_string()))?;
        let deduction_json = serde_json::to_string(&item.deduction_components)
            .map_err(|error| AppError::Database(error.to_string()))?;

        transaction.execute(
            "
            INSERT INTO payroll_manual_draft_items (
                id, payroll_run_id, employee_id, income_components_json, deduction_components_json,
                gross_pay, total_deductions, net_pay, amount_in_words, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
            ",
            params![
                format!("{}-{index}", create_id("payroll-draft-item")?),
                &run_id,
                &item.employee_id,
                &income_json,
                &deduction_json,
                item.gross_pay,
                item.total_deductions,
                item.net_pay,
                item.amount_in_words.trim(),
                &now,
            ],
        )?;
    }

    transaction.commit()?;

    get_manual_payroll_draft_by_id(app, &run_id)?.ok_or_else(|| {
        AppError::Database("draft payroll tersimpan tetapi gagal dibaca ulang".to_string())
    })
}

pub fn get_manual_payroll_draft(
    app: &AppHandle,
    query: ManualPayrollDraftQuery,
) -> Result<Option<ManualPayrollDraft>, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    let run_id: Option<String> = connection
        .query_row(
            "
            SELECT id
            FROM payroll_runs
            WHERE status = 'draft'
                AND period_label = ?1
                AND period_start = ?2
                AND period_end = ?3
            ORDER BY updated_at DESC
            LIMIT 1
            ",
            params![
                query.period_label.trim(),
                query.period_start.trim(),
                query.period_end.trim(),
            ],
            |row| row.get(0),
        )
        .optional()?;

    match run_id {
        Some(id) => get_manual_payroll_draft_by_id(app, &id),
        None => Ok(None),
    }
}

pub fn get_finalized_manual_payroll(
    app: &AppHandle,
    query: ManualPayrollDraftQuery,
) -> Result<Option<ManualPayrollDraft>, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    let run_id: Option<String> = connection
        .query_row(
            "
            SELECT id
            FROM payroll_runs
            WHERE status = 'finalized'
                AND period_label = ?1
                AND period_start = ?2
                AND period_end = ?3
            ORDER BY finalized_at DESC, updated_at DESC
            LIMIT 1
            ",
            params![
                query.period_label.trim(),
                query.period_start.trim(),
                query.period_end.trim(),
            ],
            |row| row.get(0),
        )
        .optional()?;

    match run_id {
        Some(id) => get_finalized_manual_payroll_by_id(app, &id),
        None => Ok(None),
    }
}

pub fn get_latest_finalized_manual_payroll_before(
    app: &AppHandle,
    query: LatestFinalizedManualPayrollQuery,
) -> Result<Option<ManualPayrollDraft>, AppError> {
    database_service::initialize_local_database(app)?;

    if query.period_start.trim().is_empty() {
        return Err(AppError::Database(
            "periode mulai payroll wajib diisi".to_string(),
        ));
    }

    let connection = database_service::open_local_connection(app)?;
    let run_id: Option<String> = connection
        .query_row(
            "
            SELECT id
            FROM payroll_runs
            WHERE status = 'finalized'
                AND period_end < ?1
            ORDER BY period_end DESC, finalized_at DESC, updated_at DESC
            LIMIT 1
            ",
            [query.period_start.trim()],
            |row| row.get(0),
        )
        .optional()?;

    match run_id {
        Some(id) => get_finalized_manual_payroll_by_id(app, &id),
        None => Ok(None),
    }
}

fn get_manual_payroll_draft_by_id(
    app: &AppHandle,
    payroll_run_id: &str,
) -> Result<Option<ManualPayrollDraft>, AppError> {
    let connection = database_service::open_local_connection(app)?;
    let header = connection
        .query_row(
            "
            SELECT id, period_label, period_start, period_end, status, updated_at
            FROM payroll_runs
            WHERE id = ?1
            ",
            [payroll_run_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .optional()?;

    let Some((id, period_label, period_start, period_end, status, updated_at)) = header else {
        return Ok(None);
    };

    let mut statement = connection.prepare(
        "
        SELECT employee_id, income_components_json, deduction_components_json,
            gross_pay, total_deductions, net_pay, amount_in_words
        FROM payroll_manual_draft_items
        WHERE payroll_run_id = ?1
        ORDER BY created_at ASC
        ",
    )?;
    let rows = statement.query_map([payroll_run_id], |row| {
        let income_json: String = row.get(1)?;
        let deduction_json: String = row.get(2)?;
        let income_components: Vec<PayrollComponentInput> =
            serde_json::from_str(&income_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    1,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
        let deduction_components: Vec<PayrollComponentInput> =
            serde_json::from_str(&deduction_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    2,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;

        Ok(ManualPayrollDraftItem {
            employee_id: row.get(0)?,
            income_components,
            deduction_components,
            gross_pay: row.get(3)?,
            total_deductions: row.get(4)?,
            net_pay: row.get(5)?,
            amount_in_words: row.get(6)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(Some(ManualPayrollDraft {
        payroll_run_id: id,
        period_label,
        period_start,
        period_end,
        status,
        items,
        updated_at,
    }))
}

fn get_finalized_manual_payroll_by_id(
    app: &AppHandle,
    payroll_run_id: &str,
) -> Result<Option<ManualPayrollDraft>, AppError> {
    let connection = database_service::open_local_connection(app)?;
    let header = connection
        .query_row(
            "
            SELECT id, period_label, period_start, period_end, status, updated_at
            FROM payroll_runs
            WHERE id = ?1 AND status = 'finalized'
            ",
            [payroll_run_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            },
        )
        .optional()?;

    let Some((id, period_label, period_start, period_end, status, updated_at)) = header else {
        return Ok(None);
    };

    let mut statement = connection.prepare(
        "
        SELECT snapshot_json
        FROM payroll_payslip_snapshots
        WHERE payroll_run_id = ?1
        ORDER BY created_at ASC
        ",
    )?;
    let rows = statement.query_map([payroll_run_id], |row| {
        let snapshot_json: String = row.get(0)?;
        let snapshot: PayslipSnapshot = serde_json::from_str(&snapshot_json).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })?;

        Ok(ManualPayrollDraftItem {
            employee_id: snapshot.employee.id,
            income_components: snapshot.payroll.income_components,
            deduction_components: snapshot.payroll.deduction_components,
            gross_pay: snapshot.payroll.gross_pay,
            total_deductions: snapshot.payroll.total_deductions,
            net_pay: snapshot.payroll.net_pay,
            amount_in_words: snapshot.amount_in_words,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(Some(ManualPayrollDraft {
        payroll_run_id: id,
        period_label,
        period_start,
        period_end,
        status,
        items,
        updated_at,
    }))
}

fn upsert_payroll_run(
    connection: &rusqlite::Connection,
    run_id: &str,
    period: &PayrollPeriodInput,
    status: &str,
    finalized_at: Option<&str>,
    now: &str,
) -> Result<(), AppError> {
    connection.execute(
        "
        INSERT INTO payroll_runs (
            id, period_label, period_start, period_end, status, finalized_at, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
        ON CONFLICT(id) DO UPDATE SET
            period_label = excluded.period_label,
            period_start = excluded.period_start,
            period_end = excluded.period_end,
            status = excluded.status,
            finalized_at = excluded.finalized_at,
            updated_at = excluded.updated_at
        ",
        params![
            run_id,
            period.label.trim(),
            period.start_date.trim(),
            period.end_date.trim(),
            status,
            finalized_at,
            now,
        ],
    )?;

    Ok(())
}

fn upsert_payslip_period_for_payroll(
    connection: &rusqlite::Connection,
    run_id: &str,
    period: &PayrollPeriodInput,
    now: &str,
) -> Result<String, AppError> {
    let existing_period_id: Option<String> = connection
        .query_row(
            "
            SELECT id
            FROM payslip_periods
            WHERE start_date = ?1 AND end_date = ?2
            ",
            params![period.start_date.trim(), period.end_date.trim()],
            |row| row.get(0),
        )
        .optional()?;
    let period_id = existing_period_id.unwrap_or_else(|| run_id.to_string());

    connection.execute(
        "
        INSERT INTO payslip_periods (
            id, label, start_date, end_date, status, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, 'pdf_ready', ?5, ?5)
        ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            status = 'pdf_ready',
            updated_at = excluded.updated_at
        ",
        params![
            &period_id,
            period.label.trim(),
            period.start_date.trim(),
            period.end_date.trim(),
            now,
        ],
    )?;

    Ok(period_id)
}

fn reset_payslip_manager_period(
    connection: &rusqlite::Connection,
    period_id: &str,
    run_id: &str,
    employee_count: usize,
    actor: &PayrollActor,
    now: &str,
) -> Result<String, AppError> {
    connection.execute(
        "DELETE FROM payslip_snapshots WHERE period_id = ?1",
        [period_id],
    )?;
    connection.execute(
        "DELETE FROM payslip_import_batches WHERE period_id = ?1",
        [period_id],
    )?;

    let batch_id = format!("{run_id}-payroll-final");
    connection.execute(
        "
        INSERT INTO payslip_import_batches (
            id, period_id, source_file_name, imported_by_user_id,
            imported_by_display_name, imported_by_role, total_rows, valid_rows,
            error_rows, notes, imported_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, 0, ?8, ?9)
        ",
        params![
            &batch_id,
            period_id,
            "Finalisasi payroll manual",
            actor.user_id.trim(),
            actor.display_name.trim(),
            actor.role.trim(),
            employee_count as i64,
            "Dibuat otomatis dari payroll final. Jangan gabungkan dengan queue slip lama.",
            now,
        ],
    )?;

    Ok(batch_id)
}

trait SnapshotFileId {
    fn id_for_file(&self) -> String;
}

impl SnapshotFileId for PayslipSnapshot {
    fn id_for_file(&self) -> String {
        sanitize_file_name(&format!(
            "{}-{}-{}",
            self.employee.nik, self.employee.name, self.payroll.id
        ))
    }
}

fn get_company_snapshot(connection: &rusqlite::Connection) -> Result<CompanySnapshot, AppError> {
    connection
        .query_row(
            "
            SELECT company_name, address, treasurer_name, logo_data_url
            FROM company_settings
            WHERE id = 'default'
            ",
            [],
            |row| {
                Ok(CompanySnapshot {
                    name: row.get(0)?,
                    address: row.get(1)?,
                    treasurer_name: row.get(2)?,
                    logo_data_url: row.get(3)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Database("master perusahaan belum tersedia".to_string()))
}

fn get_employee_snapshot(
    connection: &rusqlite::Connection,
    employee_id: &str,
) -> Result<EmployeeSnapshot, AppError> {
    connection
        .query_row(
            "
            SELECT id, nik, name, position, npwp, email, whatsapp_number
            FROM employees
            WHERE id = ?1 AND status = 'active'
            ",
            [employee_id],
            |row| {
                Ok(EmployeeSnapshot {
                    id: row.get(0)?,
                    nik: row.get(1)?,
                    name: row.get(2)?,
                    position: row.get(3)?,
                    npwp: row.get(4)?,
                    email: row.get(5)?,
                    whatsapp_number: row.get(6)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::Database("karyawan aktif tidak ditemukan".to_string()))
}

fn ensure_employee_active(
    connection: &rusqlite::Connection,
    employee_id: &str,
) -> Result<(), AppError> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM employees WHERE id = ?1 AND status = 'active')",
        [employee_id],
        |row| row.get(0),
    )?;

    if exists {
        Ok(())
    } else {
        Err(AppError::Database("karyawan aktif tidak ditemukan".to_string()))
    }
}

fn validate_actor(actor: &PayrollActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh finalisasi payroll".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}

fn validate_period(period: &PayrollPeriodInput) -> Result<(), AppError> {
    if period.label.trim().is_empty()
        || period.start_date.trim().is_empty()
        || period.end_date.trim().is_empty()
    {
        return Err(AppError::Database(
            "periode payroll wajib lengkap".to_string(),
        ));
    }

    Ok(())
}

fn validate_item(item: &ManualPayrollEmployeeInput) -> Result<(), AppError> {
    if item.employee_id.trim().is_empty() {
        return Err(AppError::Database("karyawan payroll wajib dipilih".to_string()));
    }

    if item.amount_in_words.trim().is_empty() {
        return Err(AppError::Database("terbilang slip wajib diisi".to_string()));
    }

    if item.gross_pay < 0 || item.total_deductions < 0 {
        return Err(AppError::Database(
            "jumlah pendapatan dan potongan tidak boleh negatif".to_string(),
        ));
    }

    Ok(())
}

fn resolve_payslip_directory(app: &AppHandle) -> Result<PathBuf, AppError> {
    let app_data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Path(error.to_string()))?;

    Ok(app_data_directory.join("payslips"))
}

fn write_payslip_pdf(path: &PathBuf, snapshot: &PayslipSnapshot) -> Result<(), AppError> {
    let mut page = PdfPage::new();
    let logo = parse_logo_data_url(&snapshot.company.logo_data_url).ok().flatten();
    if let Some(logo_image) = &logo {
        let (logo_width, logo_height) = logo_image.draw_size(58.0, 48.0);
        page.image("ImLogo", 48.0, 765.0, logo_width, logo_height);
    }
    page.text_center(297.5, 792.0, 15.0, true, &snapshot.company.name);
    page.text_center(297.5, 774.0, 9.5, false, &snapshot.company.address);
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

    let left_x = 42.0;
    let right_x = 303.0;
    let table_top = 670.0;
    draw_component_table(
        &mut page,
        left_x,
        table_top,
        "Pendapatan",
        &INCOME_COMPONENT_NAMES,
        &snapshot.payroll.income_components,
        "Jumlah Pendapatan",
        snapshot.payroll.gross_pay,
    );
    draw_component_table(
        &mut page,
        right_x,
        table_top,
        "Potongan",
        &DEDUCTION_COMPONENT_NAMES,
        &snapshot.payroll.deduction_components,
        "Jumlah Potongan",
        snapshot.payroll.total_deductions,
    );

    let net_y = 470.0;
    page.rect(42.0, net_y - 28.0, 511.0, 36.0);
    page.text(52.0, net_y - 7.0, 11.0, true, "Gaji Bersih");
    page.text_right(
        543.0,
        net_y - 7.0,
        13.0,
        true,
        &format_rupiah(snapshot.payroll.net_pay),
    );

    page.rect(42.0, 361.0, 511.0, 72.0);
    page.text(52.0, 414.0, 9.5, true, "Terbilang");
    let amount_in_words = capitalize_first_letter(&snapshot.amount_in_words);
    for (index, line) in wrap_text(&amount_in_words, 74).iter().take(3).enumerate() {
        page.text(52.0, 397.0 - (index as f32 * 15.0), 9.5, false, line);
    }

    page.text_center(442.0, 326.0, 9.5, false, "Bendahara");
    page.text_center(442.0, 244.0, 9.5, true, &snapshot.company.treasurer_name);

    let content = page.finish();
    let stream = format!("{content}\n");
    let has_logo = logo.is_some();
    let image_object_id = 6;
    let content_object_id = if has_logo { 7 } else { 6 };
    let xobject_resource = if has_logo {
        format!(" /XObject << /ImLogo {image_object_id} 0 R >>")
    } else {
        String::new()
    };
    let mut objects = vec![
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
        format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>{xobject_resource} >> /Contents {content_object_id} 0 R >>"),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".to_string(),
    ];
    if let Some(logo_image) = logo {
        objects.push(logo_image.to_pdf_object());
    }
    objects.push(format!("<< /Length {} >> stream\n{}endstream", stream.len(), stream));
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

    fn image(&mut self, name: &str, x: f32, y: f32, width: f32, height: f32) {
        self.commands.push(format!(
            "q {width:.1} 0 0 {height:.1} {x:.1} {y:.1} cm /{name} Do Q"
        ));
    }
}

fn draw_component_table(
    page: &mut PdfPage,
    x: f32,
    y: f32,
    title: &str,
    component_names: &[&str],
    components: &[PayrollComponentInput],
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

fn find_component_amount(components: &[PayrollComponentInput], name: &str) -> i64 {
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

fn capitalize_first_letter(value: &str) -> String {
    let trimmed = value.trim();
    let mut characters = trimmed.chars();
    let Some(first) = characters.next() else {
        return String::new();
    };

    first.to_uppercase().collect::<String>() + characters.as_str()
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
    sanitized.trim_matches('-').to_lowercase()
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
