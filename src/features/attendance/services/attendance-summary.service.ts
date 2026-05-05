import type { AttendanceEntry } from "../types";

export type AttendanceSummary = {
  employeeId: string;
  absenceDays: number;
  leaveDays: number;
  sickDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  totalOvertimeMinutes: number;
};

export function summarizeAttendance(entries: AttendanceEntry[]): AttendanceSummary[] {
  const summaries = new Map<string, AttendanceSummary>();

  for (const entry of entries) {
    const summary = summaries.get(entry.employeeId) ?? {
      employeeId: entry.employeeId,
      absenceDays: 0,
      leaveDays: 0,
      sickDays: 0,
      totalLateMinutes: 0,
      totalEarlyLeaveMinutes: 0,
      totalOvertimeMinutes: 0,
    };

    summary.absenceDays += entry.status === "absence" ? 1 : 0;
    summary.leaveDays += entry.status === "leave" ? 1 : 0;
    summary.sickDays += entry.status === "sick" ? 1 : 0;
    summary.totalLateMinutes += entry.minutesLate;
    summary.totalEarlyLeaveMinutes += entry.minutesEarlyLeave;
    summary.totalOvertimeMinutes += entry.overtimeMinutes;

    summaries.set(entry.employeeId, summary);
  }

  return Array.from(summaries.values());
}
