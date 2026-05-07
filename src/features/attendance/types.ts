export type AttendanceStatus = "present" | "late" | "early_leave" | "leave" | "sick" | "absence";

export type AttendanceCodeCategory = "present" | "sick" | "leave" | "absence" | "off";

export type OvertimeAppliesTo = "workday" | "holiday";

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

export type WorkShift = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isOff: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type AttendanceCode = {
  id: string;
  code: string;
  name: string;
  category: AttendanceCodeCategory;
  countsAsWorkday: boolean;
  isPaid: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type OvertimeRule = {
  id: string;
  code: string;
  name: string;
  appliesTo: OvertimeAppliesTo;
  multiplier: number;
  isActive: boolean;
  sortOrder: number;
};

export type AttendanceMasterData = {
  shifts: WorkShift[];
  attendanceCodes: AttendanceCode[];
  overtimeRules: OvertimeRule[];
};

export type AttendanceMasterActor = {
  userId: string;
  displayName: string;
  role: string;
};

export type WorkScheduleEntry = {
  id: string;
  periodId: string;
  employeeId: string;
  workDate: string;
  shiftId: string;
  notes: string;
  isLocked: boolean;
  updatedAt: string;
};

export type WorkScheduleEntryInput = {
  id?: string;
  employeeId: string;
  workDate: string;
  shiftId: string;
  notes: string;
};

export type WorkSchedulePeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: "draft" | "locked";
  isLocked: boolean;
  entries: WorkScheduleEntry[];
};

export type WorkSchedulePeriodInput = {
  id?: string;
  label: string;
  startDate: string;
  endDate: string;
  entries: WorkScheduleEntryInput[];
};

export type WorkScheduleActor = AttendanceMasterActor;
