import type { AttendanceEntry } from "../types";

export type AttendanceRepository = {
  listEntriesByPeriod: (periodId: string) => Promise<AttendanceEntry[]>;
  saveManualEntry: (entry: AttendanceEntry) => Promise<void>;
};
