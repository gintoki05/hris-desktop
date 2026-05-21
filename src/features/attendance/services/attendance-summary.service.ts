import { invoke } from "@tauri-apps/api/core";
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

export type AttendanceSummaryPeriodQuery = {
  periodStart: string;
  periodEnd: string;
};

type AttendanceSummaryDto = {
  employee_id: string;
  absence_days: number;
  leave_days: number;
  sick_days: number;
  total_late_minutes: number;
  total_early_leave_minutes: number;
  total_overtime_minutes: number;
};

export async function listAttendanceSummariesByPeriod(
  query: AttendanceSummaryPeriodQuery,
): Promise<AttendanceSummary[]> {
  ensureTauriRuntime();
  const summaries = await invoke<AttendanceSummaryDto[]>("list_attendance_summaries_by_period", {
    query: {
      period_start: query.periodStart,
      period_end: query.periodEnd,
    },
  });

  return summaries.map(toSummary);
}

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

function toSummary(dto: AttendanceSummaryDto): AttendanceSummary {
  return {
    employeeId: dto.employee_id,
    absenceDays: dto.absence_days,
    leaveDays: dto.leave_days,
    sickDays: dto.sick_days,
    totalLateMinutes: dto.total_late_minutes,
    totalEarlyLeaveMinutes: dto.total_early_leave_minutes,
    totalOvertimeMinutes: dto.total_overtime_minutes,
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Rekap absensi hanya bisa dibaca saat aplikasi berjalan sebagai desktop app.");
  }
}
