export type PayrollReportPeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  updatedAt: string;
};

export type PayrollReportEmployeeRow = {
  snapshotId: string;
  employeeId: string;
  employeeNik: string;
  employeeName: string;
  employeePosition: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

export type PayrollReportComponentSummary = {
  name: string;
  amount: number;
};

export type PayrollPeriodReport = {
  period: PayrollReportPeriod;
  employeeCount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  incomeComponents: PayrollReportComponentSummary[];
  deductionComponents: PayrollReportComponentSummary[];
  employees: PayrollReportEmployeeRow[];
};
