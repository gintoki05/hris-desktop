import type {
  AuthSession,
  CreateUserInput,
  LoginInput,
  LoginResult,
  ResetUserPasswordInput,
  UpdateUserInput,
  UserManagementItem,
} from "../types";

export type AuthRepository = {
  createUser: (input: CreateUserInput) => Promise<UserManagementItem>;
  getSession: () => Promise<AuthSession | null>;
  listUsers: () => Promise<UserManagementItem[]>;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
  resetUserPassword: (input: ResetUserPasswordInput) => Promise<UserManagementItem>;
  updateUser: (input: UpdateUserInput) => Promise<UserManagementItem>;
};
