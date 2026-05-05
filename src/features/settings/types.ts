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

export type PayrollPaydayType = "day_of_month" | "weekday";

export type PayrollWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type CompanySettings = {
  companyName: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  treasurerName: string;
};

export type PayrollSettings = {
  currentYear: number;
  paydayType: PayrollPaydayType;
  paydayDayOfMonth: number | null;
  paydayWeekday: PayrollWeekday | null;
  workingDaysPerWeek: number;
  lateToleranceMinutes: number;
  latePenaltyAmount: number;
  earlyLeaveToleranceMinutes: number;
  earlyLeavePenaltyAmount: number;
};

export type SettingsAuditEvent = {
  id: string;
  actorDisplayName: string;
  actorRole: string;
  changeSummary: string;
  createdAt: string;
};

export type MasterSettings = {
  company: CompanySettings;
  payroll: PayrollSettings;
  recentAuditEvents: SettingsAuditEvent[];
};

export type MasterSettingsInput = {
  company: CompanySettings;
  payroll: PayrollSettings;
  actor: {
    userId: string;
    displayName: string;
    role: string;
  };
};
