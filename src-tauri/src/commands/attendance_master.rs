use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::attendance_master_service;

#[derive(Clone, Serialize, Deserialize)]
pub struct WorkShiftDto {
    id: String,
    code: String,
    name: String,
    start_time: String,
    end_time: String,
    break_minutes: i32,
    is_off: bool,
    is_active: bool,
    sort_order: i32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AttendanceCodeDto {
    id: String,
    code: String,
    name: String,
    category: String,
    counts_as_workday: bool,
    is_paid: bool,
    is_active: bool,
    sort_order: i32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct OvertimeRuleDto {
    id: String,
    code: String,
    name: String,
    applies_to: String,
    multiplier: f64,
    is_active: bool,
    sort_order: i32,
}

#[derive(Serialize)]
pub struct AttendanceMasterDataDto {
    shifts: Vec<WorkShiftDto>,
    attendance_codes: Vec<AttendanceCodeDto>,
    overtime_rules: Vec<OvertimeRuleDto>,
}

#[derive(Deserialize)]
pub struct AttendanceMasterActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct AttendanceMasterInputDto {
    shifts: Vec<WorkShiftDto>,
    attendance_codes: Vec<AttendanceCodeDto>,
    overtime_rules: Vec<OvertimeRuleDto>,
    actor: AttendanceMasterActorDto,
}

#[tauri::command]
pub fn get_attendance_master_data(app: AppHandle) -> Result<AttendanceMasterDataDto, String> {
    attendance_master_service::get_attendance_master_data(&app)
        .map(to_attendance_master_data_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn save_attendance_master_data(
    app: AppHandle,
    input: AttendanceMasterInputDto,
) -> Result<AttendanceMasterDataDto, String> {
    attendance_master_service::save_attendance_master_data(&app, to_attendance_master_input(input))
        .map(to_attendance_master_data_dto)
        .map_err(|error| error.user_message())
}

fn to_attendance_master_data_dto(
    data: attendance_master_service::AttendanceMasterData,
) -> AttendanceMasterDataDto {
    AttendanceMasterDataDto {
        shifts: data.shifts.into_iter().map(to_work_shift_dto).collect(),
        attendance_codes: data
            .attendance_codes
            .into_iter()
            .map(to_attendance_code_dto)
            .collect(),
        overtime_rules: data
            .overtime_rules
            .into_iter()
            .map(to_overtime_rule_dto)
            .collect(),
    }
}

fn to_attendance_master_input(
    input: AttendanceMasterInputDto,
) -> attendance_master_service::AttendanceMasterInput {
    attendance_master_service::AttendanceMasterInput {
        shifts: input.shifts.into_iter().map(to_work_shift).collect(),
        attendance_codes: input
            .attendance_codes
            .into_iter()
            .map(to_attendance_code)
            .collect(),
        overtime_rules: input
            .overtime_rules
            .into_iter()
            .map(to_overtime_rule)
            .collect(),
        actor: attendance_master_service::AttendanceMasterActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}

fn to_work_shift_dto(shift: attendance_master_service::WorkShift) -> WorkShiftDto {
    WorkShiftDto {
        id: shift.id,
        code: shift.code,
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_minutes: shift.break_minutes,
        is_off: shift.is_off,
        is_active: shift.is_active,
        sort_order: shift.sort_order,
    }
}

fn to_attendance_code_dto(
    code: attendance_master_service::AttendanceCode,
) -> AttendanceCodeDto {
    AttendanceCodeDto {
        id: code.id,
        code: code.code,
        name: code.name,
        category: code.category,
        counts_as_workday: code.counts_as_workday,
        is_paid: code.is_paid,
        is_active: code.is_active,
        sort_order: code.sort_order,
    }
}

fn to_overtime_rule_dto(rule: attendance_master_service::OvertimeRule) -> OvertimeRuleDto {
    OvertimeRuleDto {
        id: rule.id,
        code: rule.code,
        name: rule.name,
        applies_to: rule.applies_to,
        multiplier: rule.multiplier,
        is_active: rule.is_active,
        sort_order: rule.sort_order,
    }
}

fn to_work_shift(shift: WorkShiftDto) -> attendance_master_service::WorkShift {
    attendance_master_service::WorkShift {
        id: shift.id,
        code: shift.code,
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_minutes: shift.break_minutes,
        is_off: shift.is_off,
        is_active: shift.is_active,
        sort_order: shift.sort_order,
    }
}

fn to_attendance_code(code: AttendanceCodeDto) -> attendance_master_service::AttendanceCode {
    attendance_master_service::AttendanceCode {
        id: code.id,
        code: code.code,
        name: code.name,
        category: code.category,
        counts_as_workday: code.counts_as_workday,
        is_paid: code.is_paid,
        is_active: code.is_active,
        sort_order: code.sort_order,
    }
}

fn to_overtime_rule(rule: OvertimeRuleDto) -> attendance_master_service::OvertimeRule {
    attendance_master_service::OvertimeRule {
        id: rule.id,
        code: rule.code,
        name: rule.name,
        applies_to: rule.applies_to,
        multiplier: rule.multiplier,
        is_active: rule.is_active,
        sort_order: rule.sort_order,
    }
}
