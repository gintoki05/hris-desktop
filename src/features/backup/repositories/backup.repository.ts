import type { LocalBackupFile } from "../types";

export type BackupRepository = {
  createLocalDatabaseBackup: () => Promise<string>;
  listLocalDatabaseBackups: () => Promise<LocalBackupFile[]>;
  restoreLocalDatabaseBackup: (backupPath: string) => Promise<void>;
};
