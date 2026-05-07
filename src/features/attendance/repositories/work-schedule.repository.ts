import type {
  WorkScheduleActor,
  WorkSchedulePeriod,
  WorkSchedulePeriodInput,
} from "../types";

export type WorkScheduleRepository = {
  getWorkSchedulePeriod: (
    startDate: string,
    endDate: string,
  ) => Promise<WorkSchedulePeriod | null>;
  saveWorkSchedulePeriod: (
    input: WorkSchedulePeriodInput,
    actor: WorkScheduleActor,
  ) => Promise<WorkSchedulePeriod>;
};
