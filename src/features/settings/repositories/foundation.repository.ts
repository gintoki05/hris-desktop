import type { LocalDatabaseStatus } from "../types";

export type FoundationRepository = {
  initializeLocalDatabase: () => Promise<LocalDatabaseStatus>;
  createLocalDatabaseBackup: () => Promise<string>;
  restoreLocalDatabaseBackup: (backupPath: string) => Promise<void>;
};
