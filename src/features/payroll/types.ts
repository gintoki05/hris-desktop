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
