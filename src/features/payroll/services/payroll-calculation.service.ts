import type { PayrollComponentAmount, PayrollSnapshot } from "../types";

export type PayrollCalculationInput = {
  id: string;
  employeeId: string;
  period: PayrollSnapshot["period"];
  incomeComponents: PayrollComponentAmount[];
  deductionComponents: PayrollComponentAmount[];
  finalizedAt: string;
};

export function calculatePayrollSnapshot(input: PayrollCalculationInput): PayrollSnapshot {
  const grossPay = sumAmounts(input.incomeComponents);
  const totalDeductions = sumAmounts(input.deductionComponents);

  return {
    id: input.id,
    employeeId: input.employeeId,
    period: input.period,
    incomeComponents: input.incomeComponents,
    deductionComponents: input.deductionComponents,
    grossPay,
    totalDeductions,
    netPay: grossPay - totalDeductions,
    finalizedAt: input.finalizedAt,
  };
}

function sumAmounts(components: PayrollComponentAmount[]): number {
  return components.reduce((total, component) => total + component.amount, 0);
}
