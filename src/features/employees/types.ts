export type EmploymentType = "monthly" | "daily";

export type ShiftType = "shift" | "non_shift";

export type EmployeeStatus = "active" | "inactive";

export type MaritalStatus = "single" | "married" | "divorced" | "widowed";

export type SalaryPaymentMethod = "cash" | "bank_transfer";

export type Employee = {
  id: string;
  nik: string;
  name: string;
  hireDate: string;
  position: string;
  npwp: string;
  maritalStatus: MaritalStatus;
  dependents: number;
  department: string;
  employmentType: EmploymentType;
  salaryAmount: number;
  paymentMethod: SalaryPaymentMethod;
  pph21Enabled: boolean;
  shiftType: ShiftType;
  workSchedule: string;
  status: EmployeeStatus;
  updatedAt: string;
};

export type EmployeeInput = {
  nik: string;
  name: string;
  hireDate: string;
  npwp: string;
  maritalStatus: MaritalStatus;
  dependents: number;
  department: string;
  position: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  salaryAmount: number;
  paymentMethod: SalaryPaymentMethod;
  pph21Enabled: boolean;
  shiftType: ShiftType;
  workSchedule: string;
};

export type EmployeeListFilter = {
  query: string;
  includeInactive: boolean;
};

export type EmployeeActor = {
  userId: string;
  displayName: string;
  role: string;
};
