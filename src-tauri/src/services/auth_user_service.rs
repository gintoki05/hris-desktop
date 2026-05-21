use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

const PASSWORD_ALGORITHM: &str = "sha256_iter_100000";
const PASSWORD_HASH_ITERATIONS: usize = 100_000;

#[derive(Clone, Serialize)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub status: String,
    pub credential_source: String,
    pub last_login_at: Option<String>,
    pub portal_email: String,
    pub portal_user_id: String,
}

#[derive(Clone, Serialize)]
pub struct AuthSession {
    pub user: AuthUser,
    pub started_at: String,
}

#[derive(Deserialize)]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct CreateUserInput {
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub password: String,
    pub portal_email: String,
}

#[derive(Deserialize)]
pub struct UpdateUserInput {
    pub id: String,
    pub display_name: String,
    pub role: String,
    pub status: String,
    pub portal_email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordInput {
    pub id: String,
    pub password: String,
}

struct StoredAuthUser {
    id: String,
    username: String,
    display_name: String,
    role: String,
    password_hash: String,
    password_salt: String,
    password_algorithm: String,
    is_active: bool,
    last_login_at: Option<String>,
    portal_email: String,
    portal_user_id: String,
}

pub fn list_users(app: &AppHandle) -> Result<Vec<AuthUser>, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;
    let mut statement = connection.prepare(
        "
        SELECT id, username, display_name, role_id, is_active, last_login_at, portal_email, portal_user_id
        FROM auth_users
        ORDER BY
            CASE role_id
                WHEN 'admin_payroll' THEN 1
                WHEN 'owner_management' THEN 2
                ELSE 3
            END,
            username
        ",
    )?;

    let rows = statement.query_map([], |row| {
        let is_active: i32 = row.get(4)?;
        Ok(AuthUser {
            id: row.get(0)?,
            username: row.get(1)?,
            display_name: row.get(2)?,
            role: row.get(3)?,
            status: if is_active == 1 { "active" } else { "inactive" }.to_string(),
            credential_source: "sqlite".to_string(),
            last_login_at: row.get(5)?,
            portal_email: row.get(6)?,
            portal_user_id: row.get(7)?,
        })
    })?;

    let mut users = Vec::new();
    for row in rows {
        users.push(row?);
    }

    Ok(users)
}

pub fn login(app: &AppHandle, input: LoginInput) -> Result<Option<AuthSession>, AppError> {
    database_service::initialize_local_database(app)?;
    let username = normalize_username(&input.username)?;
    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;

    let user = get_stored_user_by_username(&transaction, &username)?;
    let Some(user) = user else {
        return Ok(None);
    };

    if !user.is_active || !verify_password(&input.password, &user)? {
        return Ok(None);
    }

    let started_at = current_timestamp(&transaction)?;
    transaction.execute(
        "
        UPDATE auth_users
        SET last_login_at = ?1, updated_at = datetime('now')
        WHERE id = ?2
        ",
        (&started_at, &user.id),
    )?;
    transaction.execute(
        "
        INSERT INTO auth_sessions (id, user_id, started_at)
        VALUES (?1, ?2, ?3)
        ",
        (create_id("auth-session")?, &user.id, &started_at),
    )?;
    transaction.commit()?;

    Ok(Some(AuthSession {
        started_at,
        user: to_auth_user(user),
    }))
}

pub fn create_user(app: &AppHandle, input: CreateUserInput) -> Result<AuthUser, AppError> {
    database_service::initialize_local_database(app)?;
    let username = normalize_username(&input.username)?;
    let display_name = normalize_display_name(&input.display_name)?;
    validate_role(&input.role)?;
    validate_new_password(&input.password)?;
    let portal_email = normalize_portal_email_for_role(&input.portal_email, &input.role)?;

    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;

    let duplicate_exists: bool = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM auth_users WHERE username = ?1)",
        [&username],
        |row| row.get(0),
    )?;

    if duplicate_exists {
        return Err(AppError::Database("username user aplikasi sudah dipakai".to_string()));
    }

    let user_id = create_id("auth-user")?;
    let salt = create_password_salt(&username)?;
    let password_hash = hash_password(&input.password, &salt);

    transaction.execute(
        "
        INSERT INTO auth_users (
            id,
            username,
            display_name,
            role_id,
            password_hash,
            password_salt,
            password_algorithm,
            is_active,
            portal_email,
            created_at,
            updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, datetime('now'), datetime('now'))
        ",
        (
            &user_id,
            &username,
            &display_name,
            &input.role,
            &password_hash,
            &salt,
            PASSWORD_ALGORITHM,
            &portal_email,
        ),
    )?;
    transaction.commit()?;

    get_user_by_id(app, &user_id)
}

pub fn update_user(app: &AppHandle, input: UpdateUserInput) -> Result<AuthUser, AppError> {
    database_service::initialize_local_database(app)?;
    let user_id = normalize_required("user", &input.id)?;
    let display_name = normalize_display_name(&input.display_name)?;
    validate_role(&input.role)?;
    validate_status(&input.status)?;
    let portal_email = normalize_portal_email_for_role(&input.portal_email, &input.role)?;

    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;
    ensure_user_exists(&transaction, &user_id)?;

    let is_active = input.status == "active";
    if !is_active {
        ensure_not_last_active_admin(&transaction, &user_id)?;
    }

    transaction.execute(
        "
        UPDATE auth_users
        SET
            display_name = ?1,
            role_id = ?2,
            is_active = ?3,
            portal_email = ?4,
            portal_user_id = CASE WHEN ?2 = 'owner_management' THEN portal_user_id ELSE '' END,
            updated_at = datetime('now')
        WHERE id = ?5
        ",
        (&display_name, &input.role, if is_active { 1 } else { 0 }, &portal_email, &user_id),
    )?;

    if input.role != "admin_payroll" {
        ensure_at_least_one_active_admin(&transaction)?;
    }

    transaction.commit()?;
    get_user_by_id(app, &user_id)
}

pub fn reset_user_password(app: &AppHandle, input: ResetPasswordInput) -> Result<AuthUser, AppError> {
    database_service::initialize_local_database(app)?;
    let user_id = normalize_required("user", &input.id)?;
    validate_new_password(&input.password)?;

    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;
    let user = get_stored_user_by_id(&transaction, &user_id)?
        .ok_or_else(|| AppError::Database("user aplikasi tidak ditemukan".to_string()))?;
    let salt = create_password_salt(&user.username)?;
    let password_hash = hash_password(&input.password, &salt);

    transaction.execute(
        "
        UPDATE auth_users
        SET password_hash = ?1, password_salt = ?2, password_algorithm = ?3, updated_at = datetime('now')
        WHERE id = ?4
        ",
        (&password_hash, &salt, PASSWORD_ALGORITHM, &user_id),
    )?;
    transaction.commit()?;

    get_user_by_id(app, &user_id)
}

fn get_user_by_id(app: &AppHandle, user_id: &str) -> Result<AuthUser, AppError> {
    let connection = database_service::open_local_connection(app)?;
    let user = get_stored_user_by_id(&connection, user_id)?
        .ok_or_else(|| AppError::Database("user aplikasi tidak ditemukan".to_string()))?;
    Ok(to_auth_user(user))
}

fn get_stored_user_by_username(
    connection: &rusqlite::Connection,
    username: &str,
) -> Result<Option<StoredAuthUser>, AppError> {
    get_stored_user(connection, "username", username)
}

fn get_stored_user_by_id(
    connection: &rusqlite::Connection,
    user_id: &str,
) -> Result<Option<StoredAuthUser>, AppError> {
    get_stored_user(connection, "id", user_id)
}

fn get_stored_user(
    connection: &rusqlite::Connection,
    column: &str,
    value: &str,
) -> Result<Option<StoredAuthUser>, AppError> {
    let sql = format!(
        "
        SELECT id, username, display_name, role_id, password_hash, password_salt, password_algorithm, is_active, last_login_at, portal_email, portal_user_id
        FROM auth_users
        WHERE {column} = ?1
        "
    );

    connection
        .query_row(&sql, [value], |row| {
            let is_active: i32 = row.get(7)?;
            Ok(StoredAuthUser {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                role: row.get(3)?,
                password_hash: row.get(4)?,
                password_salt: row.get(5)?,
                password_algorithm: row.get(6)?,
                is_active: is_active == 1,
                last_login_at: row.get(8)?,
                portal_email: row.get(9)?,
                portal_user_id: row.get(10)?,
            })
        })
        .optional()
        .map_err(AppError::from)
}

fn ensure_user_exists(connection: &rusqlite::Connection, user_id: &str) -> Result<(), AppError> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM auth_users WHERE id = ?1)",
        [user_id],
        |row| row.get(0),
    )?;

    if exists {
        Ok(())
    } else {
        Err(AppError::Database("user aplikasi tidak ditemukan".to_string()))
    }
}

fn ensure_not_last_active_admin(
    connection: &rusqlite::Connection,
    user_id: &str,
) -> Result<(), AppError> {
    let active_admin_count: i64 = connection.query_row(
        "
        SELECT COUNT(*)
        FROM auth_users
        WHERE role_id = 'admin_payroll' AND is_active = 1 AND id != ?1
        ",
        [user_id],
        |row| row.get(0),
    )?;

    if active_admin_count > 0 {
        Ok(())
    } else {
        Err(AppError::Database(
            "minimal harus ada satu Admin Payroll aktif".to_string(),
        ))
    }
}

fn ensure_at_least_one_active_admin(connection: &rusqlite::Connection) -> Result<(), AppError> {
    let active_admin_count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM auth_users WHERE role_id = 'admin_payroll' AND is_active = 1",
        [],
        |row| row.get(0),
    )?;

    if active_admin_count > 0 {
        Ok(())
    } else {
        Err(AppError::Database(
            "minimal harus ada satu Admin Payroll aktif".to_string(),
        ))
    }
}

fn verify_password(password: &str, user: &StoredAuthUser) -> Result<bool, AppError> {
    if user.password_algorithm != PASSWORD_ALGORITHM {
        return Err(AppError::Database(
            "format password user aplikasi belum didukung".to_string(),
        ));
    }

    Ok(hash_password(password, &user.password_salt) == user.password_hash)
}

fn hash_password(password: &str, salt: &str) -> String {
    let mut bytes = format!("{salt}\0{password}").into_bytes();
    for _ in 0..PASSWORD_HASH_ITERATIONS {
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        bytes = hasher.finalize().to_vec();
    }

    to_hex(&bytes)
}

fn to_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push_str(&format!("{:02x}", *byte));
    }
    output
}

fn create_password_salt(username: &str) -> Result<String, AppError> {
    Ok(format!("hris-user-{username}-{}", current_millis()?))
}

fn to_auth_user(user: StoredAuthUser) -> AuthUser {
    AuthUser {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        status: if user.is_active { "active" } else { "inactive" }.to_string(),
        credential_source: "sqlite".to_string(),
        last_login_at: user.last_login_at,
        portal_email: user.portal_email,
        portal_user_id: user.portal_user_id,
    }
}

fn normalize_username(value: &str) -> Result<String, AppError> {
    let username = value.trim().to_lowercase();
    if username.len() < 3 {
        return Err(AppError::Database("username minimal 3 karakter".to_string()));
    }

    if username.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-') {
        Ok(username)
    } else {
        Err(AppError::Database(
            "username hanya boleh memakai huruf, angka, titik, underscore, atau dash".to_string(),
        ))
    }
}

fn normalize_display_name(value: &str) -> Result<String, AppError> {
    let display_name = value.trim().to_string();
    if display_name.is_empty() {
        return Err(AppError::Database("nama user wajib diisi".to_string()));
    }

    Ok(display_name)
}

fn normalize_required(label: &str, value: &str) -> Result<String, AppError> {
    let normalized = value.trim().to_string();
    if normalized.is_empty() {
        return Err(AppError::Database(format!("{label} wajib diisi")));
    }

    Ok(normalized)
}

fn validate_new_password(value: &str) -> Result<(), AppError> {
    if value.len() < 8 {
        return Err(AppError::Database("password minimal 8 karakter".to_string()));
    }

    Ok(())
}

fn validate_role(value: &str) -> Result<(), AppError> {
    if matches!(value, "admin_payroll" | "owner_management" | "viewer") {
        Ok(())
    } else {
        Err(AppError::Database("role user tidak valid".to_string()))
    }
}

fn normalize_portal_email_for_role(value: &str, role: &str) -> Result<String, AppError> {
    let email = value.trim().to_lowercase();
    if email.is_empty() {
        return Ok(email);
    }

    if role != "owner_management" {
        return Err(AppError::Database(
            "email portal hanya dipakai untuk role Owner/Manajemen".to_string(),
        ));
    }

    if email.contains('@') && email.rsplit('@').next().is_some_and(|domain| domain.contains('.')) {
        Ok(email)
    } else {
        Err(AppError::Database("email portal owner tidak valid".to_string()))
    }
}

fn validate_status(value: &str) -> Result<(), AppError> {
    if matches!(value, "active" | "inactive") {
        Ok(())
    } else {
        Err(AppError::Database("status user tidak valid".to_string()))
    }
}

fn create_id(prefix: &str) -> Result<String, AppError> {
    Ok(format!("{prefix}-{}", current_millis()?))
}

fn current_timestamp(connection: &rusqlite::Connection) -> Result<String, AppError> {
    Ok(connection.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |row| {
        row.get(0)
    })?)
}

fn current_millis() -> Result<u128, AppError> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Database(error.to_string()))?
        .as_millis())
}
