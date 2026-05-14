export type PayrollPeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type PayrollComponentAmount = {
  name: string;
  amount: number;
};

export type PayrollSnapshot = {
  id: string;
  employeeId: string;
  period: PayrollPeriod;
  incomeComponents: PayrollComponentAmount[];
  deductionComponents: PayrollComponentAmount[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  finalizedAt: string;
};

export type ManualPayrollEmployeeInput = {
  employeeId: string;
  incomeComponents: PayrollComponentAmount[];
  deductionComponents: PayrollComponentAmount[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  amountInWords: string;
};

export type ManualPayrollFinalizeInput = {
  payrollRunId: string | null;
  period: Omit<PayrollPeriod, "id">;
  items: ManualPayrollEmployeeInput[];
  actor: {
    userId: string;
    displayName: string;
    role: string;
  };
};

export type FinalizedPayrollRun = {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  employeeCount: number;
  finalizedAt: string;
};

export type ManualPayrollDraft = {
  payrollRunId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "finalized" | string;
  items: ManualPayrollEmployeeInput[];
  updatedAt: string;
};
