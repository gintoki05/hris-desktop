import { invoke } from "@tauri-apps/api/core";
import type { AttendanceMasterRepository } from "./attendance-master.repository";
import type {
  AttendanceCode,
  AttendanceCodeCategory,
  AttendanceMasterActor,
  AttendanceMasterData,
  OvertimeAppliesTo,
  OvertimeRule,
  WorkShift,
} from "../types";

type WorkShiftDto = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_off: boolean;
  is_active: boolean;
  sort_order: number;
};

type AttendanceCodeDto = {
  id: string;
  code: string;
  name: string;
  category: AttendanceCodeCategory;
  counts_as_workday: boolean;
  is_paid: boolean;
  is_active: boolean;
  sort_order: number;
};

type OvertimeRuleDto = {
  id: string;
  code: string;
  name: string;
  applies_to: OvertimeAppliesTo;
  multiplier: number;
  is_active: boolean;
  sort_order: number;
};

type AttendanceMasterDataDto = {
  shifts: WorkShiftDto[];
  attendance_codes: AttendanceCodeDto[];
  overtime_rules: OvertimeRuleDto[];
};

type AttendanceMasterActorDto = {
  user_id: string;
  display_name: string;
  role: string;
};

type AttendanceMasterInputDto = AttendanceMasterDataDto & {
  actor: AttendanceMasterActorDto;
};

export const tauriAttendanceMasterRepository: AttendanceMasterRepository = {
  async getAttendanceMasterData() {
    if (!isTauriRuntime()) {
      return createBrowserPreviewMasterData();
    }

    const dto = await invoke<AttendanceMasterDataDto>("get_attendance_master_data");
    return toAttendanceMasterData(dto);
  },

  async saveAttendanceMasterData(data, actor) {
    ensureTauriRuntime();
    const dto = await invoke<AttendanceMasterDataDto>("save_attendance_master_data", {
      input: toAttendanceMasterInputDto(data, actor),
    });
    return toAttendanceMasterData(dto);
  },
};

function toAttendanceMasterData(dto: AttendanceMasterDataDto): AttendanceMasterData {
  return {
    shifts: dto.shifts.map(toWorkShift),
    attendanceCodes: dto.attendance_codes.map(toAttendanceCode),
    overtimeRules: dto.overtime_rules.map(toOvertimeRule),
  };
}

function toWorkShift(dto: WorkShiftDto): WorkShift {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    startTime: dto.start_time,
    endTime: dto.end_time,
    breakMinutes: dto.break_minutes,
    isOff: dto.is_off,
    isActive: dto.is_active,
    sortOrder: dto.sort_order,
  };
}

function toAttendanceCode(dto: AttendanceCodeDto): AttendanceCode {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    category: dto.category,
    countsAsWorkday: dto.counts_as_workday,
    isPaid: dto.is_paid,
    isActive: dto.is_active,
    sortOrder: dto.sort_order,
  };
}

function toOvertimeRule(dto: OvertimeRuleDto): OvertimeRule {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    appliesTo: dto.applies_to,
    multiplier: dto.multiplier,
    isActive: dto.is_active,
    sortOrder: dto.sort_order,
  };
}

function toAttendanceMasterInputDto(
  data: AttendanceMasterData,
  actor: AttendanceMasterActor,
): AttendanceMasterInputDto {
  return {
    shifts: data.shifts.map(toWorkShiftDto),
    attendance_codes: data.attendanceCodes.map(toAttendanceCodeDto),
    overtime_rules: data.overtimeRules.map(toOvertimeRuleDto),
    actor: {
      user_id: actor.userId,
      display_name: actor.displayName,
      role: actor.role,
    },
  };
}

function toWorkShiftDto(shift: WorkShift): WorkShiftDto {
  return {
    id: shift.id,
    code: shift.code,
    name: shift.name,
    start_time: shift.startTime,
    end_time: shift.endTime,
    break_minutes: shift.breakMinutes,
    is_off: shift.isOff,
    is_active: shift.isActive,
    sort_order: shift.sortOrder,
  };
}

function toAttendanceCodeDto(code: AttendanceCode): AttendanceCodeDto {
  return {
    id: code.id,
    code: code.code,
    name: code.name,
    category: code.category,
    counts_as_workday: code.countsAsWorkday,
    is_paid: code.isPaid,
    is_active: code.isActive,
    sort_order: code.sortOrder,
  };
}

function toOvertimeRuleDto(rule: OvertimeRule): OvertimeRuleDto {
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    applies_to: rule.appliesTo,
    multiplier: rule.multiplier,
    is_active: rule.isActive,
    sort_order: rule.sortOrder,
  };
}

function createBrowserPreviewMasterData(): AttendanceMasterData {
  return {
    shifts: [],
    attendanceCodes: [],
    overtimeRules: [],
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Master absensi hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  }
}
