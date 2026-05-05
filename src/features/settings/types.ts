export type LocalDatabaseStatus = {
  databasePath: string;
  backupDirectory: string;
  journalMode: "wal" | "delete" | "memory" | "off" | "truncate" | "persist" | string;
  foreignKeysEnabled: boolean;
  migrationsApplied: number;
};

export type FoundationStatus = {
  database: LocalDatabaseStatus;
  modules: {
    repositoryLayerReady: boolean;
    backupRestorePlanned: boolean;
    offlinePayslipReady: boolean;
    manualWhatsAppOnly: boolean;
  };
};
