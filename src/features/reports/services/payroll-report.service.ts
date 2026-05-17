import { listPayslipPeriods, listPayslipSnapshots } from "../../payslips/services/payslip-manager.service";
import type { PayslipManagerSnapshot, PayslipPeriod, PayslipSnapshot } from "../../payslips/types";
import type {
  PayrollPeriodReport,
  PayrollReportComponentSummary,
  PayrollReportEmployeeRow,
  PayrollReportPeriod,
} from "../types";

export async function listPayrollReportPeriods(): Promise<PayrollReportPeriod[]> {
  const periods = await listPayslipPeriods();

  return periods
    .filter((period) => period.status === "pdf_ready" || period.status === "archived")
    .map(toReportPeriod);
}

export async function getPayrollPeriodReport(period: PayrollReportPeriod): Promise<PayrollPeriodReport> {
  const snapshots = await listPayslipSnapshots(period.id);
  const parsedSnapshots = snapshots.map(toParsedSnapshot).filter(isParsedSnapshot);
  const employees = parsedSnapshots.map(({ managerSnapshot, payslipSnapshot }) =>
    toEmployeeRow(managerSnapshot, payslipSnapshot),
  );

  return {
    period,
    employeeCount: employees.length,
    grossPay: sumAmounts(employees.map((employee) => employee.grossPay)),
    totalDeductions: sumAmounts(employees.map((employee) => employee.totalDeductions)),
    netPay: sumAmounts(employees.map((employee) => employee.netPay)),
    incomeComponents: summarizeComponents(
      parsedSnapshots.flatMap(({ payslipSnapshot }) => payslipSnapshot.payroll.incomeComponents),
    ),
    deductionComponents: summarizeComponents(
      parsedSnapshots.flatMap(({ payslipSnapshot }) => payslipSnapshot.payroll.deductionComponents),
    ),
    employees,
  };
}

function toReportPeriod(period: PayslipPeriod): PayrollReportPeriod {
  return {
    id: period.id,
    label: period.label,
    startDate: period.startDate,
    endDate: period.endDate,
    updatedAt: period.updatedAt,
  };
}

function toParsedSnapshot(managerSnapshot: PayslipManagerSnapshot): {
  managerSnapshot: PayslipManagerSnapshot;
  payslipSnapshot: PayslipSnapshot;
} | null {
  try {
    const parsedValue: unknown = JSON.parse(managerSnapshot.snapshotJson);
    if (!isPayslipSnapshot(parsedValue)) {
      return null;
    }

    return {
      managerSnapshot,
      payslipSnapshot: parsedValue,
    };
  } catch {
    return null;
  }
}

function isParsedSnapshot(
  value: ReturnType<typeof toParsedSnapshot>,
): value is {
  managerSnapshot: PayslipManagerSnapshot;
  payslipSnapshot: PayslipSnapshot;
} {
  return value !== null;
}

function isPayslipSnapshot(value: unknown): value is PayslipSnapshot {
  if (!isRecord(value) || !isRecord(value.employee) || !isRecord(value.payroll)) {
    return false;
  }

  return (
    typeof value.employee.id === "string" &&
    typeof value.employee.nik === "string" &&
    typeof value.employee.name === "string" &&
    typeof value.employee.position === "string" &&
    Array.isArray(value.payroll.incomeComponents) &&
    Array.isArray(value.payroll.deductionComponents) &&
    typeof value.payroll.grossPay === "number" &&
    typeof value.payroll.totalDeductions === "number" &&
    typeof value.payroll.netPay === "number"
  );
}

function toEmployeeRow(
  managerSnapshot: PayslipManagerSnapshot,
  payslipSnapshot: PayslipSnapshot,
): PayrollReportEmployeeRow {
  return {
    snapshotId: managerSnapshot.id,
    employeeId: payslipSnapshot.employee.id,
    employeeNik: payslipSnapshot.employee.nik,
    employeeName: payslipSnapshot.employee.name,
    employeePosition: payslipSnapshot.employee.position,
    grossPay: payslipSnapshot.payroll.grossPay,
    totalDeductions: payslipSnapshot.payroll.totalDeductions,
    netPay: payslipSnapshot.payroll.netPay,
  };
}

function summarizeComponents(
  components: Array<{
    name: string;
    amount: number;
  }>,
): PayrollReportComponentSummary[] {
  const totals = new Map<string, number>();

  for (const component of components) {
    totals.set(component.name, (totals.get(component.name) ?? 0) + component.amount);
  }

  return [...totals.entries()].map(([name, amount]) => ({
    name,
    amount,
  }));
}

function sumAmounts(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
