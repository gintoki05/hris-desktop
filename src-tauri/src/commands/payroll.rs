use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::payroll_service;

#[derive(Deserialize)]
pub struct PayrollActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[derive(Deserialize)]
pub struct PayrollPeriodInputDto {
    label: String,
    start_date: String,
    end_date: String,
}

#[derive(Deserialize)]
pub struct PayrollComponentInputDto {
    name: String,
    amount: i64,
}

#[derive(Deserialize)]
pub struct ManualPayrollEmployeeInputDto {
    employee_id: String,
    income_components: Vec<PayrollComponentInputDto>,
    deduction_components: Vec<PayrollComponentInputDto>,
    gross_pay: i64,
    total_deductions: i64,
    net_pay: i64,
    amount_in_words: String,
}

#[derive(Deserialize)]
pub struct ManualPayrollFinalizeInputDto {
    payroll_run_id: Option<String>,
    period: PayrollPeriodInputDto,
    items: Vec<ManualPayrollEmployeeInputDto>,
    actor: PayrollActorDto,
}

#[derive(Serialize)]
pub struct FinalizedPayrollRunDto {
    id: String,
    period_label: String,
    period_start: String,
    period_end: String,
    employee_count: usize,
    finalized_at: String,
}

#[derive(Deserialize)]
pub struct ManualPayrollDraftSaveInputDto {
    payroll_run_id: Option<String>,
    period: PayrollPeriodInputDto,
    items: Vec<ManualPayrollEmployeeInputDto>,
    actor: PayrollActorDto,
}

#[derive(Deserialize)]
pub struct ManualPayrollDraftQueryDto {
    period_label: String,
    period_start: String,
    period_end: String,
}

#[derive(Deserialize)]
pub struct LatestFinalizedManualPayrollQueryDto {
    period_start: String,
}

#[derive(Deserialize)]
pub struct LatestManualPayrollQueryDto {
    period_start: String,
}

#[derive(Serialize)]
pub struct ManualPayrollDraftDto {
    payroll_run_id: String,
    period_label: String,
    period_start: String,
    period_end: String,
    status: String,
    items: Vec<ManualPayrollDraftItemDto>,
    updated_at: String,
}

#[derive(Serialize)]
pub struct ManualPayrollDraftItemDto {
    employee_id: String,
    income_components: Vec<PayrollComponentInputOutputDto>,
    deduction_components: Vec<PayrollComponentInputOutputDto>,
    gross_pay: i64,
    total_deductions: i64,
    net_pay: i64,
    amount_in_words: String,
}

#[derive(Serialize)]
pub struct PayrollComponentInputOutputDto {
    name: String,
    amount: i64,
}

#[tauri::command]
pub fn finalize_manual_payroll(
    app: AppHandle,
    input: ManualPayrollFinalizeInputDto,
) -> Result<FinalizedPayrollRunDto, String> {
    payroll_service::finalize_manual_payroll(&app, to_service_input(input))
        .map(to_finalized_run_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn save_manual_payroll_draft(
    app: AppHandle,
    input: ManualPayrollDraftSaveInputDto,
) -> Result<ManualPayrollDraftDto, String> {
    payroll_service::save_manual_payroll_draft(&app, to_draft_save_input(input))
        .map(to_manual_payroll_draft_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn get_manual_payroll_draft(
    app: AppHandle,
    query: ManualPayrollDraftQueryDto,
) -> Result<Option<ManualPayrollDraftDto>, String> {
    payroll_service::get_manual_payroll_draft(
        &app,
        payroll_service::ManualPayrollDraftQuery {
            period_label: query.period_label,
            period_start: query.period_start,
            period_end: query.period_end,
        },
    )
    .map(|draft| draft.map(to_manual_payroll_draft_dto))
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn get_finalized_manual_payroll(
    app: AppHandle,
    query: ManualPayrollDraftQueryDto,
) -> Result<Option<ManualPayrollDraftDto>, String> {
    payroll_service::get_finalized_manual_payroll(
        &app,
        payroll_service::ManualPayrollDraftQuery {
            period_label: query.period_label,
            period_start: query.period_start,
            period_end: query.period_end,
        },
    )
    .map(|draft| draft.map(to_manual_payroll_draft_dto))
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn get_latest_finalized_manual_payroll_before(
    app: AppHandle,
    query: LatestFinalizedManualPayrollQueryDto,
) -> Result<Option<ManualPayrollDraftDto>, String> {
    payroll_service::get_latest_finalized_manual_payroll_before(
        &app,
        payroll_service::LatestFinalizedManualPayrollQuery {
            period_start: query.period_start,
        },
    )
    .map(|draft| draft.map(to_manual_payroll_draft_dto))
    .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn get_latest_manual_payroll_before(
    app: AppHandle,
    query: LatestManualPayrollQueryDto,
) -> Result<Option<ManualPayrollDraftDto>, String> {
    payroll_service::get_latest_manual_payroll_before(
        &app,
        payroll_service::LatestManualPayrollQuery {
            period_start: query.period_start,
        },
    )
    .map(|draft| draft.map(to_manual_payroll_draft_dto))
    .map_err(|error| error.user_message())
}

fn to_service_input(
    input: ManualPayrollFinalizeInputDto,
) -> payroll_service::ManualPayrollFinalizeInput {
    payroll_service::ManualPayrollFinalizeInput {
        payroll_run_id: input.payroll_run_id,
        period: payroll_service::PayrollPeriodInput {
            label: input.period.label,
            start_date: input.period.start_date,
            end_date: input.period.end_date,
        },
        items: input.items.into_iter().map(to_employee_input).collect(),
        actor: payroll_service::PayrollActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}

fn to_draft_save_input(
    input: ManualPayrollDraftSaveInputDto,
) -> payroll_service::ManualPayrollDraftSaveInput {
    payroll_service::ManualPayrollDraftSaveInput {
        payroll_run_id: input.payroll_run_id,
        period: payroll_service::PayrollPeriodInput {
            label: input.period.label,
            start_date: input.period.start_date,
            end_date: input.period.end_date,
        },
        items: input.items.into_iter().map(to_employee_input).collect(),
        actor: payroll_service::PayrollActor {
            user_id: input.actor.user_id,
            display_name: input.actor.display_name,
            role: input.actor.role,
        },
    }
}

fn to_employee_input(
    input: ManualPayrollEmployeeInputDto,
) -> payroll_service::ManualPayrollEmployeeInput {
    payroll_service::ManualPayrollEmployeeInput {
        employee_id: input.employee_id,
        income_components: input
            .income_components
            .into_iter()
            .map(to_component_input)
            .collect(),
        deduction_components: input
            .deduction_components
            .into_iter()
            .map(to_component_input)
            .collect(),
        gross_pay: input.gross_pay,
        total_deductions: input.total_deductions,
        net_pay: input.net_pay,
        amount_in_words: input.amount_in_words,
    }
}

fn to_component_input(
    input: PayrollComponentInputDto,
) -> payroll_service::PayrollComponentInput {
    payroll_service::PayrollComponentInput {
        name: input.name,
        amount: input.amount,
    }
}

fn to_finalized_run_dto(run: payroll_service::FinalizedPayrollRun) -> FinalizedPayrollRunDto {
    FinalizedPayrollRunDto {
        id: run.id,
        period_label: run.period_label,
        period_start: run.period_start,
        period_end: run.period_end,
        employee_count: run.employee_count,
        finalized_at: run.finalized_at,
    }
}

fn to_manual_payroll_draft_dto(
    draft: payroll_service::ManualPayrollDraft,
) -> ManualPayrollDraftDto {
    ManualPayrollDraftDto {
        payroll_run_id: draft.payroll_run_id,
        period_label: draft.period_label,
        period_start: draft.period_start,
        period_end: draft.period_end,
        status: draft.status,
        items: draft.items.into_iter().map(to_draft_item_dto).collect(),
        updated_at: draft.updated_at,
    }
}

fn to_draft_item_dto(
    item: payroll_service::ManualPayrollDraftItem,
) -> ManualPayrollDraftItemDto {
    ManualPayrollDraftItemDto {
        employee_id: item.employee_id,
        income_components: item
            .income_components
            .into_iter()
            .map(to_component_output_dto)
            .collect(),
        deduction_components: item
            .deduction_components
            .into_iter()
            .map(to_component_output_dto)
            .collect(),
        gross_pay: item.gross_pay,
        total_deductions: item.total_deductions,
        net_pay: item.net_pay,
        amount_in_words: item.amount_in_words,
    }
}

fn to_component_output_dto(
    input: payroll_service::PayrollComponentInput,
) -> PayrollComponentInputOutputDto {
    PayrollComponentInputOutputDto {
        name: input.name,
        amount: input.amount,
    }
}
