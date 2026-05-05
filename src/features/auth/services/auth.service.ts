import { ROLE_PERMISSIONS } from "../constants";
import { localAuthRepository } from "../repositories/local-auth.repository";
import type { AuthPermission, AuthRole, LoginInput } from "../types";

export async function getCurrentAuthSession() {
  return localAuthRepository.getSession();
}

export async function login(input: LoginInput) {
  return localAuthRepository.login(input);
}

export async function logout() {
  await localAuthRepository.logout();
}

export function roleCan(role: AuthRole, permission: AuthPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
