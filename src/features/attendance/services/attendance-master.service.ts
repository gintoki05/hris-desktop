import { tauriAttendanceMasterRepository } from "../repositories/tauri-attendance-master.repository";
import type { AttendanceMasterActor, AttendanceMasterData } from "../types";

export function getAttendanceMasterData(): Promise<AttendanceMasterData> {
  return tauriAttendanceMasterRepository.getAttendanceMasterData();
}

export function saveAttendanceMasterData(
  data: AttendanceMasterData,
  actor: AttendanceMasterActor,
): Promise<AttendanceMasterData> {
  return tauriAttendanceMasterRepository.saveAttendanceMasterData(data, actor);
}
