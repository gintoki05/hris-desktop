export type EmploymentType = "monthly" | "daily";

export type ShiftType = "shift" | "non_shift";

export type EmployeeStatus = "active" | "inactive";

export type Employee = {
  id: string;
  nik: string;
  name: string;
  position: string;
  npwp: string | null;
  employmentType: EmploymentType;
  shiftType: ShiftType;
  status: EmployeeStatus;
};
