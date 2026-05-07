import type { Dispatch, SetStateAction } from "react";
import type { AttendanceCode, AttendanceMasterData, OvertimeRule, WorkShift } from "../types";

type SetDraft = Dispatch<SetStateAction<AttendanceMasterData | null>>;

export function updateShift(index: number, patch: Partial<WorkShift>, setDraft: SetDraft) {
  setDraft((current) =>
    current
      ? {
          ...current,
          shifts: current.shifts.map((shift, rowIndex) =>
            rowIndex === index ? { ...shift, ...patch } : shift,
          ),
        }
      : current,
  );
}

export function updateAttendanceCode(
  index: number,
  patch: Partial<AttendanceCode>,
  setDraft: SetDraft,
) {
  setDraft((current) =>
    current
      ? {
          ...current,
          attendanceCodes: current.attendanceCodes.map((code, rowIndex) =>
            rowIndex === index ? { ...code, ...patch } : code,
          ),
        }
      : current,
  );
}

export function updateOvertimeRule(index: number, patch: Partial<OvertimeRule>, setDraft: SetDraft) {
  setDraft((current) =>
    current
      ? {
          ...current,
          overtimeRules: current.overtimeRules.map((rule, rowIndex) =>
            rowIndex === index ? { ...rule, ...patch } : rule,
          ),
        }
      : current,
  );
}

export function removeShift(id: string, setDraft: SetDraft) {
  setDraft((current) =>
    current
      ? {
          ...current,
          shifts: current.shifts.filter((shift) => shift.id !== id),
        }
      : current,
  );
}

export function removeAttendanceCode(id: string, setDraft: SetDraft) {
  setDraft((current) =>
    current
      ? {
          ...current,
          attendanceCodes: current.attendanceCodes.filter((code) => code.id !== id),
        }
      : current,
  );
}

export function removeOvertimeRule(id: string, setDraft: SetDraft) {
  setDraft((current) =>
    current
      ? {
          ...current,
          overtimeRules: current.overtimeRules.filter((rule) => rule.id !== id),
        }
      : current,
  );
}

export function addShift(draft: AttendanceMasterData, setDraft: SetDraft) {
  setDraft({
    ...draft,
    shifts: [
      ...draft.shifts,
      {
        id: `shift-${Date.now()}`,
        code: "BARU",
        name: "Shift Baru",
        startTime: "08:00",
        endTime: "16:00",
        breakMinutes: 0,
        isOff: false,
        isActive: true,
        sortOrder: nextSortOrder(draft.shifts),
      },
    ],
  });
}

export function addAttendanceCode(draft: AttendanceMasterData, setDraft: SetDraft) {
  setDraft({
    ...draft,
    attendanceCodes: [
      ...draft.attendanceCodes,
      {
        id: `attendance-${Date.now()}`,
        code: "BARU",
        name: "Kode Baru",
        category: "present",
        countsAsWorkday: true,
        isPaid: true,
        isActive: true,
        sortOrder: nextSortOrder(draft.attendanceCodes),
      },
    ],
  });
}

export function addOvertimeRule(draft: AttendanceMasterData, setDraft: SetDraft) {
  setDraft({
    ...draft,
    overtimeRules: [
      ...draft.overtimeRules,
      {
        id: `overtime-${Date.now()}`,
        code: "LEMBUR_BARU",
        name: "Lembur Baru",
        appliesTo: "workday",
        multiplier: 1,
        isActive: true,
        sortOrder: nextSortOrder(draft.overtimeRules),
      },
    ],
  });
}

function nextSortOrder(items: Array<{ sortOrder: number }>): number {
  return Math.max(0, ...items.map((item) => item.sortOrder)) + 10;
}
