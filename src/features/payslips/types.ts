import type { Employee } from "../employees/types";
import type { PayrollSnapshot } from "../payroll/types";

export type PayslipCompanySnapshot = {
  name: string;
  address: string;
  treasurerName: string;
};

export type PayslipSnapshot = {
  company: PayslipCompanySnapshot;
  employee: Pick<Employee, "id" | "nik" | "name" | "position" | "npwp">;
  payroll: PayrollSnapshot;
  amountInWords: string;
};
