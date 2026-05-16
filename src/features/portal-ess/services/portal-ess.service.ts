import type { AuthSession } from "../../auth/types";
import {
  createEmployeePortalAccount as createAccountWithRepository,
  listEmployeePortalStatus as listStatusWithRepository,
  syncEmployeePortalProfile as syncProfileWithRepository,
} from "../repositories/tauri-portal-ess.repository";
import type { PortalCreateAccountResult, PortalEmployeeStatusResult } from "../types";

export function listEmployeePortalStatus(session: AuthSession): Promise<PortalEmployeeStatusResult> {
  return listStatusWithRepository(toActor(session));
}

export function createEmployeePortalAccount(
  employeeId: string,
  temporaryPassword: string,
  session: AuthSession,
): Promise<PortalCreateAccountResult> {
  return createAccountWithRepository(employeeId, temporaryPassword, toActor(session));
}

export function syncEmployeePortalProfile(
  employeeId: string,
  session: AuthSession,
): Promise<PortalCreateAccountResult> {
  return syncProfileWithRepository(employeeId, toActor(session));
}

function toActor(session: AuthSession) {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}
