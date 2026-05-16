import { invoke } from "@tauri-apps/api/core";
import type {
  PortalCreateAccountResult,
  PortalEmployeeStatusItem,
  PortalEmployeeStatusResult,
  PortalEssActor,
} from "../types";

type PortalEssActorDto = {
  user_id: string;
  display_name: string;
  role: string;
};

type PortalEmployeeStatusResultDto = {
  items: PortalEmployeeStatusItemDto[];
};

type PortalEmployeeStatusItemDto = {
  employee_id: string;
  employee_name: string;
  employee_code_masked: string;
  employee_email: string;
  employee_status: string;
  auth_user_status: PortalEmployeeStatusItem["authUserStatus"];
  employee_profile_status: PortalEmployeeStatusItem["employeeProfileStatus"];
  payslip_count: number;
  latest_payroll_period: string;
  latest_published_at: string | null;
  portal_user_id: string;
  employee_profile_id: string;
  issue_message: string;
};

type PortalCreateAccountResultDto = {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  portal_user_id: string;
  employee_profile_id: string;
  account_status: PortalCreateAccountResult["accountStatus"];
};

export async function listEmployeePortalStatus(
  actor: PortalEssActor,
): Promise<PortalEmployeeStatusResult> {
  ensureTauriRuntime();
  const dto = await invoke<PortalEmployeeStatusResultDto>("list_employee_portal_status", {
    actor: toActorDto(actor),
  });

  return {
    items: dto.items.map(toStatusItem),
  };
}

export async function createEmployeePortalAccount(
  employeeId: string,
  temporaryPassword: string,
  actor: PortalEssActor,
): Promise<PortalCreateAccountResult> {
  ensureTauriRuntime();
  const dto = await invoke<PortalCreateAccountResultDto>("create_employee_portal_account", {
    input: {
      employee_id: employeeId,
      temporary_password: temporaryPassword,
      actor: toActorDto(actor),
    },
  });

  return {
    employeeId: dto.employee_id,
    employeeName: dto.employee_name,
    employeeEmail: dto.employee_email,
    portalUserId: dto.portal_user_id,
    employeeProfileId: dto.employee_profile_id,
    accountStatus: dto.account_status,
  };
}

export async function syncEmployeePortalProfile(
  employeeId: string,
  actor: PortalEssActor,
): Promise<PortalCreateAccountResult> {
  ensureTauriRuntime();
  const dto = await invoke<Omit<PortalCreateAccountResultDto, "account_status">>("link_employee_portal_user", {
    input: {
      employee_id: employeeId,
      actor: toActorDto(actor),
    },
  });

  return {
    employeeId: dto.employee_id,
    employeeName: dto.employee_name,
    employeeEmail: dto.employee_email,
    portalUserId: dto.portal_user_id,
    employeeProfileId: dto.employee_profile_id,
    accountStatus: "existing",
  };
}


function toStatusItem(dto: PortalEmployeeStatusItemDto): PortalEmployeeStatusItem {
  return {
    employeeId: dto.employee_id,
    employeeName: dto.employee_name,
    employeeCodeMasked: dto.employee_code_masked,
    employeeEmail: dto.employee_email,
    employeeStatus: dto.employee_status,
    authUserStatus: dto.auth_user_status,
    employeeProfileStatus: dto.employee_profile_status,
    payslipCount: dto.payslip_count,
    latestPayrollPeriod: dto.latest_payroll_period,
    latestPublishedAt: dto.latest_published_at,
    portalUserId: dto.portal_user_id,
    employeeProfileId: dto.employee_profile_id,
    issueMessage: dto.issue_message,
  };
}

function toActorDto(actor: PortalEssActor): PortalEssActorDto {
  return {
    user_id: actor.userId,
    display_name: actor.displayName,
    role: actor.role,
  };
}

function ensureTauriRuntime(): void {
  if (typeof window === "undefined" || typeof window.__TAURI_INTERNALS__?.invoke !== "function") {
    throw new Error("Portal ESS hanya tersedia saat aplikasi berjalan sebagai desktop app.");
  }
}
