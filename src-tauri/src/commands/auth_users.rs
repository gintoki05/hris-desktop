use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::auth_user_service;

#[derive(Serialize)]
pub struct AuthUserDto {
    id: String,
    username: String,
    display_name: String,
    role: String,
    status: String,
    credential_source: String,
    last_login_at: Option<String>,
}

#[derive(Serialize)]
pub struct AuthSessionDto {
    user: AuthUserDto,
    started_at: String,
}

#[derive(Serialize)]
pub struct LoginResultDto {
    ok: bool,
    message: Option<String>,
    session: Option<AuthSessionDto>,
}

#[derive(Deserialize)]
pub struct LoginInputDto {
    username: String,
    password: String,
}

#[derive(Deserialize)]
pub struct CreateUserInputDto {
    username: String,
    display_name: String,
    role: String,
    password: String,
}

#[derive(Deserialize)]
pub struct UpdateUserInputDto {
    id: String,
    display_name: String,
    role: String,
    status: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordInputDto {
    id: String,
    password: String,
}

#[tauri::command]
pub fn login_auth_user(app: AppHandle, input: LoginInputDto) -> Result<LoginResultDto, String> {
    auth_user_service::login(
        &app,
        auth_user_service::LoginInput {
            username: input.username,
            password: input.password,
        },
    )
    .map(|session| match session {
        Some(session) => LoginResultDto {
            ok: true,
            message: None,
            session: Some(to_session_dto(session)),
        },
        None => LoginResultDto {
            ok: false,
            message: Some("Username atau password tidak valid.".to_string()),
            session: None,
        },
    })
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn list_auth_users(app: AppHandle) -> Result<Vec<AuthUserDto>, String> {
    auth_user_service::list_users(&app)
        .map(|users| users.into_iter().map(to_user_dto).collect())
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn create_auth_user(app: AppHandle, input: CreateUserInputDto) -> Result<AuthUserDto, String> {
    auth_user_service::create_user(
        &app,
        auth_user_service::CreateUserInput {
            username: input.username,
            display_name: input.display_name,
            role: input.role,
            password: input.password,
        },
    )
    .map(to_user_dto)
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn update_auth_user(app: AppHandle, input: UpdateUserInputDto) -> Result<AuthUserDto, String> {
    auth_user_service::update_user(
        &app,
        auth_user_service::UpdateUserInput {
            id: input.id,
            display_name: input.display_name,
            role: input.role,
            status: input.status,
        },
    )
    .map(to_user_dto)
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn reset_auth_user_password(
    app: AppHandle,
    input: ResetPasswordInputDto,
) -> Result<AuthUserDto, String> {
    auth_user_service::reset_user_password(
        &app,
        auth_user_service::ResetPasswordInput {
            id: input.id,
            password: input.password,
        },
    )
    .map(to_user_dto)
    .map_err(|error| error.user_message())
}

fn to_session_dto(session: auth_user_service::AuthSession) -> AuthSessionDto {
    AuthSessionDto {
        user: to_user_dto(session.user),
        started_at: session.started_at,
    }
}

fn to_user_dto(user: auth_user_service::AuthUser) -> AuthUserDto {
    AuthUserDto {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
        credential_source: user.credential_source,
        last_login_at: user.last_login_at,
    }
}
