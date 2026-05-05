export type AttendanceStatus = "present" | "late" | "early_leave" | "leave" | "sick" | "absence";

export type AttendanceEntry = {
  id: string;
  employeeId: string;
  workDate: string;
  status: AttendanceStatus;
  minutesLate: number;
  minutesEarlyLeave: number;
  overtimeMinutes: number;
  source: "import" | "manual";
};
