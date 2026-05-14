use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::employee_service;

#[derive(Serialize)]
pub struct EmployeeDto {
    id: String,
    nik: String,
    whatsapp_number: String,
    email: String,
    name: String,
    hire_date: String,
    npwp: String,
    marital_status: String,
    dependents: i32,
    department: String,
    position: String,
    status: String,
    employment_type: String,
    payment_method: String,
    pph21_enabled: bool,
    shift_type: String,
    work_schedule: String,
    updated_at: String,
}

#[derive(Deserialize)]
pub struct EmployeeActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct EmployeeListFilterDto {
    query: Option<String>,
    include_inactive: bool,
}

#[derive(Deserialize)]
pub struct EmployeeInputDto {
    nik: String,
    whatsapp_number: String,
    email: String,
    name: String,
    hire_date: String,
    npwp: String,
    marital_status: String,
    dependents: i32,
    department: String,
    position: String,
    status: String,
    employment_type: String,
    payment_method: String,
    pph21_enabled: bool,
    shift_type: String,
    work_schedule: String,
}

#[tauri::command]
pub fn list_employees(
    app: AppHandle,
    filter: EmployeeListFilterDto,
) -> Result<Vec<EmployeeDto>, String> {
    employee_service::list_employees(&app, to_employee_list_filter(filter))
        .map(|employees| employees.into_iter().map(to_employee_dto).collect())
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn create_employee(
    app: AppHandle,
    input: EmployeeInputDto,
    actor: EmployeeActorDto,
) -> Result<EmployeeDto, String> {
    employee_service::create_employee(&app, to_employee_input(input), to_employee_actor(actor))
        .map(to_employee_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn update_employee(
    app: AppHandle,
    id: String,
    input: EmployeeInputDto,
    actor: EmployeeActorDto,
) -> Result<EmployeeDto, String> {
    employee_service::update_employee(&app, id, to_employee_input(input), to_employee_actor(actor))
        .map(to_employee_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn deactivate_employee(
    app: AppHandle,
    id: String,
    actor: EmployeeActorDto,
) -> Result<EmployeeDto, String> {
    employee_service::deactivate_employee(&app, id, to_employee_actor(actor))
        .map(to_employee_dto)
        .map_err(|error| error.user_message())
}

fn to_employee_dto(employee: employee_service::Employee) -> EmployeeDto {
    EmployeeDto {
        id: employee.id,
        nik: employee.nik,
        whatsapp_number: employee.whatsapp_number,
        email: employee.email,
        name: employee.name,
        hire_date: employee.hire_date,
        npwp: employee.npwp,
        marital_status: employee.marital_status,
        dependents: employee.dependents,
        department: employee.department,
        position: employee.position,
        status: employee.status,
        employment_type: employee.employment_type,
        payment_method: employee.payment_method,
        pph21_enabled: employee.pph21_enabled,
        shift_type: employee.shift_type,
        work_schedule: employee.work_schedule,
        updated_at: employee.updated_at,
    }
}

fn to_employee_actor(actor: EmployeeActorDto) -> employee_service::EmployeeActor {
    employee_service::EmployeeActor {
        user_id: actor.user_id,
        display_name: actor.display_name,
        role: actor.role,
    }
}

fn to_employee_list_filter(
    filter: EmployeeListFilterDto,
) -> employee_service::EmployeeListFilter {
    employee_service::EmployeeListFilter {
        query: filter.query,
        include_inactive: filter.include_inactive,
    }
}

fn to_employee_input(input: EmployeeInputDto) -> employee_service::EmployeeInput {
    employee_service::EmployeeInput {
        nik: input.nik,
        whatsapp_number: input.whatsapp_number,
        email: input.email,
        name: input.name,
        hire_date: input.hire_date,
        npwp: input.npwp,
        marital_status: input.marital_status,
        dependents: input.dependents,
        department: input.department,
        position: input.position,
        status: input.status,
        employment_type: input.employment_type,
        payment_method: input.payment_method,
        pph21_enabled: input.pph21_enabled,
        shift_type: input.shift_type,
        work_schedule: input.work_schedule,
    }
}
