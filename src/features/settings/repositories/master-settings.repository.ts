import type { MasterSettings, MasterSettingsInput } from "../types";

export type MasterSettingsRepository = {
  getMasterSettings: () => Promise<MasterSettings>;
  updateMasterSettings: (input: MasterSettingsInput) => Promise<MasterSettings>;
};
