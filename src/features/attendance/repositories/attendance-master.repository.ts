import type { AttendanceMasterActor, AttendanceMasterData } from "../types";

export type AttendanceMasterRepository = {
  getAttendanceMasterData: () => Promise<AttendanceMasterData>;
  saveAttendanceMasterData: (
    data: AttendanceMasterData,
    actor: AttendanceMasterActor,
  ) => Promise<AttendanceMasterData>;
};
