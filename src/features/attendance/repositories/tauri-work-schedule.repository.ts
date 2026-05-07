import { invoke } from "@tauri-apps/api/core";
import type { WorkScheduleRepository } from "./work-schedule.repository";
import type {
  WorkScheduleActor,
  WorkScheduleEntry,
  WorkScheduleEntryInput,
  WorkSchedulePeriod,
  WorkSchedulePeriodInput,
} from "../types";

type WorkScheduleEntryDto = {
  id: string;
  period_id: string;
  employee_id: string;
  work_date: string;
  shift_id: string;
  notes: string;
  is_locked: boolean;
  updated_at: string;
};

type WorkSchedulePeriodDto = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: "draft" | "locked";
  is_locked: boolean;
  entries: WorkScheduleEntryDto[];
};

type WorkScheduleActorDto = {
  user_id: string;
  display_name: string;
  role: string;
};

type WorkScheduleEntryInputDto = {
  id?: string;
  employee_id: string;
  work_date: string;
  shift_id: string;
  notes: string;
};

type WorkSchedulePeriodInputDto = {
  id?: string;
  label: string;
  start_date: string;
  end_date: string;
  entries: WorkScheduleEntryInputDto[];
  actor: WorkScheduleActorDto;
};

export const tauriWorkScheduleRepository: WorkScheduleRepository = {
  async getWorkSchedulePeriod(startDate, endDate) {
    if (!isTauriRuntime()) {
      return null;
    }

    const dto = await invoke<WorkSchedulePeriodDto | null>("get_work_schedule_period", {
      startDate,
      endDate,
    });
    return dto ? toPeriod(dto) : null;
  },

  async saveWorkSchedulePeriod(input, actor) {
    ensureTauriRuntime();
    const dto = await invoke<WorkSchedulePeriodDto>("save_work_schedule_period", {
      input: toPeriodInputDto(input, actor),
    });
    return toPeriod(dto);
  },
};

function toPeriod(dto: WorkSchedulePeriodDto): WorkSchedulePeriod {
  return {
    id: dto.id,
    label: dto.label,
    startDate: dto.start_date,
    endDate: dto.end_date,
    status: dto.status,
    isLocked: dto.is_locked,
    entries: dto.entries.map(toEntry),
  };
}

function toEntry(dto: WorkScheduleEntryDto): WorkScheduleEntry {
  return {
    id: dto.id,
    periodId: dto.period_id,
    employeeId: dto.employee_id,
    workDate: dto.work_date,
    shiftId: dto.shift_id,
    notes: dto.notes,
    isLocked: dto.is_locked,
    updatedAt: dto.updated_at,
  };
}

function toPeriodInputDto(
  input: WorkSchedulePeriodInput,
  actor: WorkScheduleActor,
): WorkSchedulePeriodInputDto {
  return {
    id: input.id,
    label: input.label,
    start_date: input.startDate,
    end_date: input.endDate,
    entries: input.entries.map(toEntryInputDto),
    actor: {
      user_id: actor.userId,
      display_name: actor.displayName,
      role: actor.role,
    },
  };
}

function toEntryInputDto(input: WorkScheduleEntryInput): WorkScheduleEntryInputDto {
  return {
    id: input.id,
    employee_id: input.employeeId,
    work_date: input.workDate,
    shift_id: input.shiftId,
    notes: input.notes,
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Jadwal kerja hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  }
}
