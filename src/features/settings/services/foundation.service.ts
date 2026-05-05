import { tauriFoundationRepository } from "../repositories/tauri-foundation.repository";
import type { FoundationStatus } from "../types";

export async function getFoundationStatus(): Promise<FoundationStatus> {
  const database = await tauriFoundationRepository.initializeLocalDatabase();

  return {
    database,
    modules: {
      repositoryLayerReady: true,
      backupRestorePlanned: true,
      offlinePayslipReady: true,
      manualWhatsAppOnly: true,
    },
  };
}
