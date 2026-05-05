import { invoke } from "@tauri-apps/api/core";
import type { MasterSettingsRepository } from "./master-settings.repository";
import type {
  MasterSettings,
  MasterSettingsInput,
  PayrollPaydayType,
  PayrollWeekday,
} from "../types";

type CompanySettingsDto = {
  company_name: string;
  address: string;
  contact_phone: string;
  contact_email: string;
  treasurer_name: string;
};

type PayrollSettingsDto = {
  current_year: number;
  payday_type: PayrollPaydayType;
  payday_day_of_month: number | null;
  payday_weekday: PayrollWeekday | null;
  working_days_per_week: number;
  late_tolerance_minutes: number;
  late_penalty_amount: number;
  early_leave_tolerance_minutes: number;
  early_leave_penalty_amount: number;
};

type SettingsAuditEventDto = {
  id: string;
  actor_display_name: string;
  actor_role: string;
  change_summary: string;
  created_at: string;
};

type MasterSettingsDto = {
  company: CompanySettingsDto;
  payroll: PayrollSettingsDto;
  recent_audit_events: SettingsAuditEventDto[];
};

type MasterSettingsInputDto = {
  company: CompanySettingsDto;
  payroll: PayrollSettingsDto;
  actor: {
    user_id: string;
    display_name: string;
    role: string;
  };
};

export const tauriMasterSettingsRepository: MasterSettingsRepository = {
  async getMasterSettings() {
    if (!isTauriRuntime()) {
      return createBrowserPreviewSettings();
    }

    const dto = await invoke<MasterSettingsDto>("get_master_settings");
    return toMasterSettings(dto);
  },

  async updateMasterSettings(input) {
    ensureTauriRuntime();
    const dto = await invoke<MasterSettingsDto>("update_master_settings", {
      input: toMasterSettingsInputDto(input),
    });
    return toMasterSettings(dto);
  },
};

function toMasterSettings(dto: MasterSettingsDto): MasterSettings {
  return {
    company: {
      companyName: dto.company.company_name,
      address: dto.company.address,
      contactPhone: dto.company.contact_phone,
      contactEmail: dto.company.contact_email,
      treasurerName: dto.company.treasurer_name,
    },
    payroll: {
      currentYear: dto.payroll.current_year,
      paydayType: dto.payroll.payday_type,
      paydayDayOfMonth: dto.payroll.payday_day_of_month,
      paydayWeekday: dto.payroll.payday_weekday,
      workingDaysPerWeek: dto.payroll.working_days_per_week,
      lateToleranceMinutes: dto.payroll.late_tolerance_minutes,
      latePenaltyAmount: dto.payroll.late_penalty_amount,
      earlyLeaveToleranceMinutes: dto.payroll.early_leave_tolerance_minutes,
      earlyLeavePenaltyAmount: dto.payroll.early_leave_penalty_amount,
    },
    recentAuditEvents: dto.recent_audit_events.map((event) => ({
      id: event.id,
      actorDisplayName: event.actor_display_name,
      actorRole: event.actor_role,
      changeSummary: event.change_summary,
      createdAt: event.created_at,
    })),
  };
}

function toMasterSettingsInputDto(input: MasterSettingsInput): MasterSettingsInputDto {
  return {
    company: {
      company_name: input.company.companyName,
      address: input.company.address,
      contact_phone: input.company.contactPhone,
      contact_email: input.company.contactEmail,
      treasurer_name: input.company.treasurerName,
    },
    payroll: {
      current_year: input.payroll.currentYear,
      payday_type: input.payroll.paydayType,
      payday_day_of_month: input.payroll.paydayDayOfMonth,
      payday_weekday: input.payroll.paydayWeekday,
      working_days_per_week: input.payroll.workingDaysPerWeek,
      late_tolerance_minutes: input.payroll.lateToleranceMinutes,
      late_penalty_amount: input.payroll.latePenaltyAmount,
      early_leave_tolerance_minutes: input.payroll.earlyLeaveToleranceMinutes,
      early_leave_penalty_amount: input.payroll.earlyLeavePenaltyAmount,
    },
    actor: {
      user_id: input.actor.userId,
      display_name: input.actor.displayName,
      role: input.actor.role,
    },
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Setting master hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  }
}

function createBrowserPreviewSettings(): MasterSettings {
  return {
    company: {
      companyName: "Klinik Permata Medika",
      address: "",
      contactPhone: "",
      contactEmail: "",
      treasurerName: "",
    },
    payroll: {
      currentYear: new Date().getFullYear(),
      paydayType: "day_of_month",
      paydayDayOfMonth: 25,
      paydayWeekday: null,
      workingDaysPerWeek: 6,
      lateToleranceMinutes: 0,
      latePenaltyAmount: 0,
      earlyLeaveToleranceMinutes: 0,
      earlyLeavePenaltyAmount: 0,
    },
    recentAuditEvents: [],
  };
}
