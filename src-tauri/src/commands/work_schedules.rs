use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::work_schedule_service;

#[derive(Serialize)]
pub struct WorkScheduleEntryDto {
    id: String,
    period_id: String,
    employee_id: String,
    work_date: String,
    shift_id: String,
    notes: String,
    is_locked: bool,
    updated_at: String,
}

#[derive(Serialize)]
pub struct WorkSchedulePeriodDto {
    id: String,
    label: String,
    start_date: String,
    end_date: String,
    status: String,
    is_locked: bool,
    entries: Vec<WorkScheduleEntryDto>,
}

#[derive(Deserialize)]
pub struct WorkScheduleActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct WorkScheduleEntryInputDto {
    id: Option<String>,
    employee_id: String,
    work_date: String,
    shift_id: String,
    notes: String,
}

#[derive(Deserialize)]
pub struct WorkSchedulePeriodInputDto {
    id: Option<String>,
    label: String,
    start_date: String,
    end_date: String,
    entries: Vec<WorkScheduleEntryInputDto>,
    actor: WorkScheduleActorDto,
}

#[tauri::command]
pub fn get_work_schedule_period(
    app: AppHandle,
    start_date: String,
    end_date: String,
) -> Result<Option<WorkSchedulePeriodDto>, String> {
    work_schedule_service::get_work_schedule_period(&app, start_date, end_date)
        .map(|period| period.map(to_period_dto))
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn save_work_schedule_period(
    app: AppHandle,
    input: WorkSchedulePeriodInputDto,
) -> Result<WorkSchedulePeriodDto, String> {
    work_schedule_service::save_work_schedule_period(&app, to_period_input(input))
        .map(to_period_dto)
        .map_err(|error| error.user_message())
}

fn to_period_dto(period: work_schedule_service::WorkSchedulePeriod) -> WorkSchedulePeriodDto {
    WorkSchedulePeriodDto {
        id: period.id,
        label: period.label,
        start_date: period.start_date,
        end_date: period.end_date,
        status: period.status,
        is_locked: period.is_locked,
        entries: period.entries.into_iter().map(to_entry_dto).collect(),
    }
}

fn to_entry_dto(entry: work_schedule_service::WorkScheduleEntry) -> WorkScheduleEntryDto {
    WorkScheduleEntryDto {
        id: entry.id,
        period_id: entry.period_id,
        employee_id: entry.employee_id,
        work_date: entry.work_date,
        shift_id: entry.shift_id,
        notes: entry.notes,
        is_locked: entry.is_locked,
        updated_at: entry.updated_at,
    }
}

fn to_period_input(
    input: WorkSchedulePeriodInputDto,
) -> work_schedule_service::WorkSchedulePeriodInput {
    work_schedule_service::WorkSchedulePeriodInput {
        id: input.id,
        label: input.label,
        start_date: input.start_date,
        end_date: input.end_date,
        entries: input.entries.into_iter().map(to_entry_input).collect(),
        actor: work_schedule_service::WorkScheduleActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}

fn to_entry_input(
    input: WorkScheduleEntryInputDto,
) -> work_schedule_service::WorkScheduleEntryInput {
    work_schedule_service::WorkScheduleEntryInput {
        id: input.id,
        employee_id: input.employee_id,
        work_date: input.work_date,
        shift_id: input.shift_id,
        notes: input.notes,
    }
}
