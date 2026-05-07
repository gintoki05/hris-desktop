import type {
  AttendanceImportActor,
  AttendanceImportBatch,
  AttendanceImportSaveInput,
} from "../types";

export type AttendanceImportRepository = {
  saveImportBatch: (
    input: AttendanceImportSaveInput,
    actor: AttendanceImportActor,
  ) => Promise<AttendanceImportBatch>;
};
