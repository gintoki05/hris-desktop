import type {
  EmployeeStatus,
  EmploymentType,
  MaritalStatus,
  SalaryPaymentMethod,
  ShiftType,
} from "./types";

export const MARITAL_STATUS_OPTIONS: Array<{ value: MaritalStatus; label: string }> = [
  { value: "single", label: "Belum kawin" },
  { value: "married", label: "Kawin" },
  { value: "divorced", label: "Cerai hidup" },
  { value: "widowed", label: "Cerai mati" },
];

export const EMPLOYEE_STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
];

export const EMPLOYMENT_TYPE_OPTIONS: Array<{ value: EmploymentType; label: string }> = [
  { value: "monthly", label: "Bulanan" },
  { value: "weekly", label: "Mingguan" },
  { value: "daily", label: "Harian" },
];

export const PAYMENT_METHOD_OPTIONS: Array<{ value: SalaryPaymentMethod; label: string }> = [
  { value: "cash", label: "Tunai" },
  { value: "bank_transfer", label: "Transfer bank" },
];

export const SHIFT_TYPE_OPTIONS: Array<{ value: ShiftType; label: string }> = [
  { value: "non_shift", label: "Non-shift" },
  { value: "shift", label: "Shift" },
];

export const FOLLOW_MONTHLY_SCHEDULE_LABEL = "Mengikuti jadwal bulanan";
