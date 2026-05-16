import { ROLE_PERMISSIONS } from "../constants";
import { tauriAuthRepository } from "../repositories/tauri-auth.repository";
import type {
  AuthPermission,
  AuthRole,
  CreateUserInput,
  LoginInput,
  ResetUserPasswordInput,
  UpdateUserInput,
} from "../types";

export async function getCurrentAuthSession() {
  return tauriAuthRepository.getSession();
}

export async function listManagedUsers() {
  return tauriAuthRepository.listUsers();
}

export async function login(input: LoginInput) {
  return tauriAuthRepository.login(input);
}

export async function logout() {
  await tauriAuthRepository.logout();
}

export async function createManagedUser(input: CreateUserInput) {
  return tauriAuthRepository.createUser(input);
}

export async function updateManagedUser(input: UpdateUserInput) {
  return tauriAuthRepository.updateUser(input);
}

export async function resetManagedUserPassword(input: ResetUserPasswordInput) {
  return tauriAuthRepository.resetUserPassword(input);
}

export function roleCan(role: AuthRole, permission: AuthPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
