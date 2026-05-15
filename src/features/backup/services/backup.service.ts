import { tauriBackupRepository } from "../repositories/tauri-backup.repository";
import type { LocalBackupFile } from "../types";

export async function createLocalDatabaseBackup(): Promise<string> {
  return tauriBackupRepository.createLocalDatabaseBackup();
}

export async function listLocalDatabaseBackups(): Promise<LocalBackupFile[]> {
  return tauriBackupRepository.listLocalDatabaseBackups();
}

export async function restoreLocalDatabaseBackup(backupPath: string): Promise<void> {
  await tauriBackupRepository.restoreLocalDatabaseBackup(backupPath);
}
