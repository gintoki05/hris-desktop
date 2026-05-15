import { invoke } from "@tauri-apps/api/core";
import type { BackupRepository } from "./backup.repository";
import type { LocalBackupFile } from "../types";

type LocalBackupFileDto = {
  path: string;
  file_name: string;
  size_bytes: number;
  modified_at_unix_ms: number;
};

function toLocalBackupFile(dto: LocalBackupFileDto): LocalBackupFile {
  return {
    fileName: dto.file_name,
    modifiedAtUnixMs: dto.modified_at_unix_ms,
    path: dto.path,
    sizeBytes: dto.size_bytes,
  };
}

export const tauriBackupRepository: BackupRepository = {
  async createLocalDatabaseBackup() {
    ensureTauriRuntime();
    return invoke<string>("create_local_database_backup");
  },

  async listLocalDatabaseBackups() {
    ensureTauriRuntime();
    const files = await invoke<LocalBackupFileDto[]>("list_local_database_backups");
    return files.map(toLocalBackupFile);
  },

  async restoreLocalDatabaseBackup(backupPath) {
    ensureTauriRuntime();
    await invoke("restore_local_database_backup", { backupPath });
  },
};

function ensureTauriRuntime(): void {
  if (typeof window === "undefined" || typeof window.__TAURI_INTERNALS__?.invoke !== "function") {
    throw new Error("Fitur backup hanya tersedia saat aplikasi berjalan sebagai desktop app.");
  }
}
