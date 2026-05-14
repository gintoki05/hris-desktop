use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

#[derive(Clone, Serialize)]
pub struct Employee {
    pub id: String,
    pub nik: String,
    pub whatsapp_number: String,
    pub email: String,
    pub name: String,
    pub hire_date: String,
    pub npwp: String,
    pub marital_status: String,
    pub dependents: i32,
    pub department: String,
    pub position: String,
    pub status: String,
    pub employment_type: String,
    pub salary_amount: i64,
    pub payment_method: String,
    pub pph21_enabled: bool,
    pub shift_type: String,
    pub work_schedule: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct EmployeeActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct EmployeeListFilter {
    pub query: Option<String>,
    pub include_inactive: bool,
}

#[derive(Deserialize)]
pub struct EmployeeInput {
    pub nik: String,
    pub whatsapp_number: String,
    pub email: String,
    pub name: String,
    pub hire_date: String,
    pub npwp: String,
    pub marital_status: String,
    pub dependents: i32,
    pub department: String,
    pub position: String,
    pub status: String,
    pub employment_type: String,
    pub salary_amount: i64,
    pub payment_method: String,
    pub pph21_enabled: bool,
    pub shift_type: String,
    pub work_schedule: String,
}

pub fn list_employees(
    app: &AppHandle,
    filter: EmployeeListFilter,
) -> Result<Vec<Employee>, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    let query = filter.query.unwrap_or_default().trim().to_lowercase();
    let search_pattern = format!("%{query}%");

    let sql = if filter.include_inactive {
        "
        SELECT
            id, nik, whatsapp_number, email, name, hire_date, npwp, marital_status, dependents, department,
            position, status, employment_type, payment_method,
            salary_amount, pph21_enabled, shift_type, work_schedule, updated_at
        FROM employees
        WHERE ?1 = ''
            OR lower(name) LIKE ?2
            OR lower(nik) LIKE ?2
            OR lower(department) LIKE ?2
            OR lower(position) LIKE ?2
        ORDER BY status ASC, name ASC
        "
    } else {
        "
        SELECT
            id, nik, whatsapp_number, email, name, hire_date, npwp, marital_status, dependents, department,
            position, status, employment_type, payment_method,
            salary_amount, pph21_enabled, shift_type, work_schedule, updated_at
        FROM employees
        WHERE status = 'active'
            AND (
                ?1 = ''
                OR lower(name) LIKE ?2
                OR lower(nik) LIKE ?2
                OR lower(department) LIKE ?2
                OR lower(position) LIKE ?2
            )
        ORDER BY name ASC
        "
    };

    let mut statement = connection.prepare(sql)?;
    let rows = statement.query_map(params![query, search_pattern], employee_from_row)?;

    let mut employees = Vec::new();
    for row in rows {
        employees.push(row?);
    }

    Ok(employees)
}

pub fn create_employee(
    app: &AppHandle,
    input: EmployeeInput,
    actor: EmployeeActor,
) -> Result<Employee, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&actor)?;

    let employee = normalize_employee_input(create_employee_id()?, input)?;
    let mut connection = database_service::open_local_connection(app)?;
    ensure_nik_available(&connection, &employee.nik, None)?;

    let transaction = connection.transaction()?;
    transaction.execute(
        "
        INSERT INTO employees (
            id, nik, whatsapp_number, email, name, hire_date, npwp, marital_status, dependents, department,
            position, status, employment_type, salary_amount, payment_method,
            pph21_enabled, shift_type, work_schedule, created_at, updated_at
        )
        VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
            ?11, ?12, ?13, ?14,
            ?15, ?16, ?17, ?18, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        )
        ",
        params![
            &employee.id,
            &employee.nik,
            &employee.whatsapp_number,
            &employee.email,
            &employee.name,
            &employee.hire_date,
            &employee.npwp,
            &employee.marital_status,
            employee.dependents,
            &employee.department,
            &employee.position,
            &employee.status,
            &employee.employment_type,
            employee.salary_amount,
            &employee.payment_method,
            if employee.pph21_enabled { 1 } else { 0 },
            &employee.shift_type,
            &employee.work_schedule,
        ],
    )?;
    transaction.commit()?;

    get_employee_by_id(app, &employee.id)?.ok_or_else(|| {
        AppError::Database("karyawan tersimpan tetapi gagal dibaca ulang".to_string())
    })
}

pub fn update_employee(
    app: &AppHandle,
    id: String,
    input: EmployeeInput,
    actor: EmployeeActor,
) -> Result<Employee, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&actor)?;

    let employee = normalize_employee_input(id, input)?;
    let mut connection = database_service::open_local_connection(app)?;
    ensure_employee_exists(&connection, &employee.id)?;
    ensure_nik_available(&connection, &employee.nik, Some(&employee.id))?;

    let transaction = connection.transaction()?;
    transaction.execute(
        "
        UPDATE employees
        SET
            nik = ?1,
            whatsapp_number = ?2,
            email = ?3,
            name = ?4,
            hire_date = ?5,
            npwp = ?6,
            marital_status = ?7,
            dependents = ?8,
            department = ?9,
            position = ?10,
            status = ?11,
            employment_type = ?12,
            payment_method = ?13,
            salary_amount = ?14,
            pph21_enabled = ?15,
            shift_type = ?16,
            work_schedule = ?17,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?18
        ",
        params![
            &employee.nik,
            &employee.whatsapp_number,
            &employee.email,
            &employee.name,
            &employee.hire_date,
            &employee.npwp,
            &employee.marital_status,
            employee.dependents,
            &employee.department,
            &employee.position,
            &employee.status,
            &employee.employment_type,
            &employee.payment_method,
            employee.salary_amount,
            if employee.pph21_enabled { 1 } else { 0 },
            &employee.shift_type,
            &employee.work_schedule,
            &employee.id,
        ],
    )?;
    transaction.commit()?;

    get_employee_by_id(app, &employee.id)?.ok_or_else(|| {
        AppError::Database("karyawan diperbarui tetapi gagal dibaca ulang".to_string())
    })
}

pub fn deactivate_employee(
    app: &AppHandle,
    id: String,
    actor: EmployeeActor,
) -> Result<Employee, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&actor)?;

    let mut connection = database_service::open_local_connection(app)?;
    ensure_employee_exists(&connection, &id)?;

    let transaction = connection.transaction()?;
    transaction.execute(
        "
        UPDATE employees
        SET status = 'inactive', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?1
        ",
        [&id],
    )?;
    transaction.commit()?;

    get_employee_by_id(app, &id)?.ok_or_else(|| {
        AppError::Database("karyawan dinonaktifkan tetapi gagal dibaca ulang".to_string())
    })
}

fn get_employee_by_id(app: &AppHandle, id: &str) -> Result<Option<Employee>, AppError> {
    let connection = database_service::open_local_connection(app)?;

    connection
        .query_row(
            "
            SELECT
            id, nik, whatsapp_number, email, name, hire_date, npwp, marital_status, dependents, department,
            position, status, employment_type, payment_method,
            salary_amount, pph21_enabled, shift_type, work_schedule, updated_at
            FROM employees
            WHERE id = ?1
            ",
            [id],
            employee_from_row,
        )
        .optional()
        .map_err(AppError::from)
}

fn employee_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Employee> {
    let pph21_enabled: i32 = row.get(15)?;

    Ok(Employee {
        id: row.get(0)?,
        nik: row.get(1)?,
        whatsapp_number: row.get(2)?,
        email: row.get(3)?,
        name: row.get(4)?,
        hire_date: row.get(5)?,
        npwp: row.get(6)?,
        marital_status: row.get(7)?,
        dependents: row.get(8)?,
        department: row.get(9)?,
        position: row.get(10)?,
        status: row.get(11)?,
        employment_type: row.get(12)?,
        payment_method: row.get(13)?,
        salary_amount: row.get(14)?,
        pph21_enabled: pph21_enabled == 1,
        shift_type: row.get(16)?,
        work_schedule: row.get(17)?,
        updated_at: row.get(18)?,
    })
}

fn normalize_employee_input(id: String, input: EmployeeInput) -> Result<Employee, AppError> {
    let employee = Employee {
        id,
        nik: input.nik.trim().to_string(),
        whatsapp_number: input.whatsapp_number.trim().to_string(),
        email: input.email.trim().to_lowercase(),
        name: input.name.trim().to_string(),
        hire_date: input.hire_date.trim().to_string(),
        npwp: input.npwp.trim().to_string(),
        marital_status: input.marital_status.trim().to_string(),
        dependents: input.dependents,
        department: input.department.trim().to_string(),
        position: input.position.trim().to_string(),
        status: input.status.trim().to_string(),
        employment_type: input.employment_type.trim().to_string(),
        salary_amount: input.salary_amount,
        payment_method: input.payment_method.trim().to_string(),
        pph21_enabled: input.pph21_enabled,
        shift_type: input.shift_type.trim().to_string(),
        work_schedule: input.work_schedule.trim().to_string(),
        updated_at: String::new(),
    };

    validate_employee(&employee)?;
    Ok(employee)
}

fn validate_employee(employee: &Employee) -> Result<(), AppError> {
    validate_required("nama karyawan", &employee.name)?;
    validate_required("NIK", &employee.nik)?;
    validate_required("tanggal mulai kerja", &employee.hire_date)?;
    validate_required("departemen", &employee.department)?;
    validate_required("jabatan", &employee.position)?;

    if !is_iso_date(&employee.hire_date) {
        return Err(AppError::Database(
            "tanggal mulai kerja harus memakai format YYYY-MM-DD".to_string(),
        ));
    }

    if employee.dependents < 0 || employee.dependents > 10 {
        return Err(AppError::Database(
            "jumlah tanggungan harus berada di rentang 0 sampai 10".to_string(),
        ));
    }

    if !matches!(
        employee.marital_status.as_str(),
        "single" | "married" | "divorced" | "widowed"
    ) {
        return Err(AppError::Database("status kawin tidak valid".to_string()));
    }

    if !matches!(employee.status.as_str(), "active" | "inactive") {
        return Err(AppError::Database("status karyawan tidak valid".to_string()));
    }

    if !matches!(
        employee.employment_type.as_str(),
        "monthly" | "weekly" | "daily"
    ) {
        return Err(AppError::Database("sistem gaji tidak valid".to_string()));
    }

    if employee.salary_amount < 0 {
        return Err(AppError::Database(
            "gaji pokok default tidak boleh negatif".to_string(),
        ));
    }

    if !matches!(
        employee.payment_method.as_str(),
        "cash" | "bank_transfer"
    ) {
        return Err(AppError::Database(
            "metode pembayaran gaji tidak valid".to_string(),
        ));
    }

    if !matches!(employee.shift_type.as_str(), "shift" | "non_shift") {
        return Err(AppError::Database("tipe shift tidak valid".to_string()));
    }

    validate_required("jam kerja default", &employee.work_schedule)?;
    validate_optional_email("email karyawan", &employee.email)?;
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

fn validate_required(label: &str, value: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Database(format!("{label} wajib diisi")));
    }

    Ok(())
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
}

fn validate_actor(actor: &EmployeeActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh mengubah data karyawan".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}

fn ensure_employee_exists(
    connection: &rusqlite::Connection,
    employee_id: &str,
) -> Result<(), AppError> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM employees WHERE id = ?1)",
        [employee_id],
        |row| row.get(0),
    )?;

    if exists {
        Ok(())
    } else {
        Err(AppError::Database("karyawan tidak ditemukan".to_string()))
    }
}

fn ensure_nik_available(
    connection: &rusqlite::Connection,
    nik: &str,
    current_employee_id: Option<&str>,
) -> Result<(), AppError> {
    let existing_id: Option<String> = connection
        .query_row("SELECT id FROM employees WHERE nik = ?1", [nik], |row| {
            row.get(0)
        })
        .optional()?;

    if matches!(existing_id.as_deref(), Some(id) if Some(id) != current_employee_id) {
        return Err(AppError::Database("NIK karyawan sudah terdaftar".to_string()));
    }

    Ok(())
}

fn create_employee_id() -> Result<String, AppError> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Database(error.to_string()))?
        .as_millis();

    Ok(format!("employee-{timestamp}"))
}
