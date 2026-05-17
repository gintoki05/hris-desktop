import { invoke } from "@tauri-apps/api/core";
import type { FinalizedPayrollRun, ManualPayrollDraft, ManualPayrollFinalizeInput } from "../types";

type PayrollComponentInputDto = {
  name: string;
  amount: number;
};

type ManualPayrollEmployeeInputDto = {
  employee_id: string;
  income_components: PayrollComponentInputDto[];
  deduction_components: PayrollComponentInputDto[];
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  amount_in_words: string;
};

type ManualPayrollFinalizeInputDto = {
  payroll_run_id: string | null;
  period: {
    label: string;
    start_date: string;
    end_date: string;
  };
  items: ManualPayrollEmployeeInputDto[];
  actor: {
    user_id: string;
    display_name: string;
    role: string;
  };
};

type ManualPayrollDraftDto = {
  payroll_run_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: string;
  items: ManualPayrollEmployeeInputDto[];
  updated_at: string;
};

type FinalizedPayrollRunDto = {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  employee_count: number;
  finalized_at: string;
};

export async function finalizeManualPayroll(
  input: ManualPayrollFinalizeInput,
): Promise<FinalizedPayrollRun> {
  ensureTauriRuntime();
  const dto = await invoke<FinalizedPayrollRunDto>("finalize_manual_payroll", {
    input: toFinalizeInputDto(input),
  });

  return {
    id: dto.id,
    periodLabel: dto.period_label,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    employeeCount: dto.employee_count,
    finalizedAt: dto.finalized_at,
  };
}

export async function saveManualPayrollDraft(
  input: ManualPayrollFinalizeInput,
): Promise<ManualPayrollDraft> {
  ensureTauriRuntime();
  const dto = await invoke<ManualPayrollDraftDto>("save_manual_payroll_draft", {
    input: toFinalizeInputDto(input),
  });

  return toManualPayrollDraft(dto);
}

export async function getManualPayrollDraft(query: {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ManualPayrollDraft | null> {
  ensureTauriRuntime();
  const dto = await invoke<ManualPayrollDraftDto | null>("get_manual_payroll_draft", {
    query: {
      period_label: query.periodLabel,
      period_start: query.periodStart,
      period_end: query.periodEnd,
    },
  });

  return dto ? toManualPayrollDraft(dto) : null;
}

export async function getFinalizedManualPayroll(query: {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
}): Promise<ManualPayrollDraft | null> {
  ensureTauriRuntime();
  const dto = await invoke<ManualPayrollDraftDto | null>("get_finalized_manual_payroll", {
    query: {
      period_label: query.periodLabel,
      period_start: query.periodStart,
      period_end: query.periodEnd,
    },
  });

  return dto ? toManualPayrollDraft(dto) : null;
}

export async function getLatestFinalizedManualPayrollBefore(query: {
  periodStart: string;
}): Promise<ManualPayrollDraft | null> {
  ensureTauriRuntime();
  const dto = await invoke<ManualPayrollDraftDto | null>("get_latest_finalized_manual_payroll_before", {
    query: {
      period_start: query.periodStart,
    },
  });

  return dto ? toManualPayrollDraft(dto) : null;
}

function toFinalizeInputDto(input: ManualPayrollFinalizeInput): ManualPayrollFinalizeInputDto {
  return {
    period: {
      label: input.period.label,
      start_date: input.period.startDate,
      end_date: input.period.endDate,
    },
    payroll_run_id: input.payrollRunId,
    items: input.items.map((item) => ({
      employee_id: item.employeeId,
      income_components: item.incomeComponents,
      deduction_components: item.deductionComponents,
      gross_pay: item.grossPay,
      total_deductions: item.totalDeductions,
      net_pay: item.netPay,
      amount_in_words: item.amountInWords,
    })),
    actor: {
      user_id: input.actor.userId,
      display_name: input.actor.displayName,
      role: input.actor.role,
    },
  };
}

function toManualPayrollDraft(dto: ManualPayrollDraftDto): ManualPayrollDraft {
  return {
    payrollRunId: dto.payroll_run_id,
    periodLabel: dto.period_label,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    status: dto.status,
    items: dto.items.map((item) => ({
      employeeId: item.employee_id,
      incomeComponents: item.income_components,
      deductionComponents: item.deduction_components,
      grossPay: item.gross_pay,
      totalDeductions: item.total_deductions,
      netPay: item.net_pay,
      amountInWords: item.amount_in_words,
    })),
    updatedAt: dto.updated_at,
  };
}

function ensureTauriRuntime(): void {
  if (typeof window === "undefined" || typeof window.__TAURI_INTERNALS__?.invoke !== "function") {
    throw new Error("Payroll hanya bisa difinalisasi saat aplikasi berjalan sebagai desktop app.");
  }
}
