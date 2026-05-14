import { calculatePayrollSnapshot } from "./payroll-calculation.service";
import {
  finalizeManualPayroll as finalizeManualPayrollWithRepository,
  getFinalizedManualPayroll,
  getManualPayrollDraft,
  saveManualPayrollDraft,
} from "../repositories/tauri-payroll.repository";
import type {
  FinalizedPayrollRun,
  ManualPayrollEmployeeInput,
  ManualPayrollFinalizeInput,
  PayrollComponentAmount,
  PayrollPeriod,
} from "../types";

export type ManualPayrollDraftItem = {
  employeeId: string;
  incomeComponents: PayrollComponentAmount[];
  deductionComponents: PayrollComponentAmount[];
};

export type ManualPayrollDraft = {
  period: Omit<PayrollPeriod, "id">;
  payrollRunId: string | null;
  items: ManualPayrollDraftItem[];
  actor: ManualPayrollFinalizeInput["actor"];
};

export async function finalizeManualPayrollDraft(
  draft: ManualPayrollDraft,
): Promise<FinalizedPayrollRun> {
  const items = draft.items.map(toFinalizeItem);

  return finalizeManualPayrollWithRepository({
    payrollRunId: draft.payrollRunId,
    period: draft.period,
    items,
    actor: draft.actor,
  });
}

export async function saveManualPayrollDraftInput(draft: ManualPayrollDraft) {
  return saveManualPayrollDraft({
    payrollRunId: draft.payrollRunId,
    period: draft.period,
    items: draft.items.map(toFinalizeItem),
    actor: draft.actor,
  });
}

export { getFinalizedManualPayroll, getManualPayrollDraft };

function toFinalizeItem(item: ManualPayrollDraftItem): ManualPayrollEmployeeInput {
  const payroll = calculatePayrollSnapshot({
    id: `snapshot-${item.employeeId}`,
    employeeId: item.employeeId,
    period: {
      id: "pending-finalization",
      label: "",
      startDate: "",
      endDate: "",
    },
    incomeComponents: item.incomeComponents,
    deductionComponents: item.deductionComponents,
    finalizedAt: "",
  });

  return {
    employeeId: item.employeeId,
    incomeComponents: item.incomeComponents,
    deductionComponents: item.deductionComponents,
    grossPay: payroll.grossPay,
    totalDeductions: payroll.totalDeductions,
    netPay: payroll.netPay,
    amountInWords: `${payroll.netPay.toLocaleString("id-ID")} rupiah`,
  };
}
