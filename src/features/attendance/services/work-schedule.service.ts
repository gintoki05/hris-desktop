import { formatDisplayDateRange } from "../../../lib/formatters/date-time";
import { tauriWorkScheduleRepository } from "../repositories/tauri-work-schedule.repository";
import type { WorkScheduleRepository } from "../repositories/work-schedule.repository";
import type {
  WorkScheduleActor,
  WorkScheduleEntryInput,
  WorkSchedulePeriod,
  WorkSchedulePeriodInput,
} from "../types";

export function createWorkScheduleService(repository: WorkScheduleRepository) {
  return {
    getWorkSchedulePeriod(startDate: string, endDate: string): Promise<WorkSchedulePeriod | null> {
      return repository.getWorkSchedulePeriod(startDate, endDate);
    },

    saveWorkSchedulePeriod(
      input: WorkSchedulePeriodInput,
      actor: WorkScheduleActor,
    ): Promise<WorkSchedulePeriod> {
      return repository.saveWorkSchedulePeriod(
        {
          ...input,
          entries: input.entries
            .map(normalizeEntry)
            .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.employeeId.localeCompare(b.employeeId)),
        },
        actor,
      );
    },
  };
}

export function createEmptyWorkSchedulePeriod(
  startDate: string,
  endDate: string,
): WorkSchedulePeriodInput {
  return {
    label: `Jadwal ${formatDisplayDateRange(startDate, endDate)}`,
    startDate,
    endDate,
    entries: [],
  };
}

export function createWorkScheduleEntry(
  employeeId: string,
  workDate: string,
  shiftId: string,
): WorkScheduleEntryInput {
  return {
    employeeId,
    workDate,
    shiftId,
    notes: "",
  };
}

const workScheduleService = createWorkScheduleService(tauriWorkScheduleRepository);

export const getWorkSchedulePeriod = workScheduleService.getWorkSchedulePeriod;
export const saveWorkSchedulePeriod = workScheduleService.saveWorkSchedulePeriod;

function normalizeEntry(entry: WorkScheduleEntryInput): WorkScheduleEntryInput {
  return {
    id: entry.id,
    employeeId: entry.employeeId.trim(),
    workDate: entry.workDate.trim(),
    shiftId: entry.shiftId.trim(),
    notes: entry.notes.trim(),
  };
}
