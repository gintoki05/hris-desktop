import { tauriMasterSettingsRepository } from "../repositories/tauri-master-settings.repository";
import type { MasterSettings, MasterSettingsInput } from "../types";

export async function getMasterSettings(): Promise<MasterSettings> {
  return tauriMasterSettingsRepository.getMasterSettings();
}

export async function updateMasterSettings(input: MasterSettingsInput): Promise<MasterSettings> {
  return tauriMasterSettingsRepository.updateMasterSettings(input);
}
