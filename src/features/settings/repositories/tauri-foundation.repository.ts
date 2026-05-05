import { invoke } from "@tauri-apps/api/core";
import type { FoundationRepository } from "./foundation.repository";
import type { LocalDatabaseStatus } from "../types";

type LocalDatabaseStatusDto = {
  database_path: string;
  backup_directory: string;
  journal_mode: string;
  foreign_keys_enabled: boolean;
  migrations_applied: number;
};

function toLocalDatabaseStatus(dto: LocalDatabaseStatusDto): LocalDatabaseStatus {
  return {
    databasePath: dto.database_path,
    backupDirectory: dto.backup_directory,
    journalMode: dto.journal_mode,
    foreignKeysEnabled: dto.foreign_keys_enabled,
    migrationsApplied: dto.migrations_applied,
  };
}

export const tauriFoundationRepository: FoundationRepository = {
  async initializeLocalDatabase() {
    if (!isTauriRuntime()) {
      return createBrowserPreviewStatus();
    }

    const dto = await invoke<LocalDatabaseStatusDto>("initialize_local_database");
    return toLocalDatabaseStatus(dto);
  },

  async createLocalDatabaseBackup() {
    ensureTauriRuntime();
    return invoke<string>("create_local_database_backup");
  },

  async restoreLocalDatabaseBackup(backupPath) {
    ensureTauriRuntime();
    await invoke("restore_local_database_backup", { backupPath });
  },
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Fitur database lokal hanya tersedia saat aplikasi berjalan sebagai desktop app.");
  }
}

function createBrowserPreviewStatus(): LocalDatabaseStatus {
  return {
    databasePath: "Desktop runtime belum aktif",
    backupDirectory: "Desktop runtime belum aktif",
    journalMode: "-",
    foreignKeysEnabled: false,
    migrationsApplied: 0,
  };
}
