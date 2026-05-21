import { invoke } from "@tauri-apps/api/core";
import type { AuthRepository } from "./auth.repository";
import { localAuthRepository } from "./local-auth.repository";
import type {
  AuthRole,
  AuthSession,
  AuthUserStatus,
  CreateUserInput,
  LoginResult,
  ResetUserPasswordInput,
  UpdateUserInput,
  UserManagementItem,
} from "../types";

const SESSION_STORAGE_KEY = "hris_payroll_auth_session";

type AuthUserDto = {
  id: string;
  username: string;
  display_name: string;
  role: AuthRole;
  status: AuthUserStatus;
  credential_source: "sqlite";
  last_login_at: string | null;
  portal_email: string;
  portal_user_id: string;
};

type AuthSessionDto = {
  user: AuthUserDto;
  started_at: string;
};

type LoginResultDto = {
  ok: boolean;
  message: string | null;
  session: AuthSessionDto | null;
};

type CreateUserInputDto = {
  username: string;
  display_name: string;
  role: AuthRole;
  password: string;
  portal_email: string;
};

type UpdateUserInputDto = {
  id: string;
  display_name: string;
  role: AuthRole;
  status: AuthUserStatus;
  portal_email: string;
};

type ResetPasswordInputDto = {
  id: string;
  password: string;
};

type OwnerPortalAccountResultDto = {
  auth_user_id: string;
  display_name: string;
  portal_email: string;
  portal_user_id: string;
  account_status: "created" | "existing";
};

export const tauriAuthRepository: AuthRepository = {
  async createUser(input) {
    ensureTauriRuntime();
    const dto = await invoke<AuthUserDto>("create_auth_user", {
      input: toCreateUserInputDto(input),
    });
    return toUserManagementItem(dto);
  },

  async createOwnerPortalAccount(input) {
    ensureTauriRuntime();
    const dto = await invoke<OwnerPortalAccountResultDto>("create_owner_portal_account", {
      input: {
        auth_user_id: input.authUserId,
        temporary_password: input.temporaryPassword,
        actor: {
          user_id: input.actor.userId,
          display_name: input.actor.displayName,
          role: input.actor.role,
        },
      },
    });

    return {
      authUserId: dto.auth_user_id,
      displayName: dto.display_name,
      portalEmail: dto.portal_email,
      portalUserId: dto.portal_user_id,
      accountStatus: dto.account_status,
    };
  },

  async getSession() {
    if (!isTauriRuntime()) {
      return localAuthRepository.getSession();
    }

    const storedSession = readStoredSession();
    if (!storedSession) {
      return null;
    }

    const users = await invoke<AuthUserDto[]>("list_auth_users");
    const currentUser = users.find((user) => user.id === storedSession.user.id);

    if (!currentUser || currentUser.status !== "active") {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    const session: AuthSession = {
      ...storedSession,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.display_name,
        role: currentUser.role,
      },
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return session;
  },

  async listUsers() {
    if (!isTauriRuntime()) {
      return localAuthRepository.listUsers();
    }

    const dto = await invoke<AuthUserDto[]>("list_auth_users");
    return dto.map(toUserManagementItem);
  },

  async login(input) {
    if (!isTauriRuntime()) {
      return localAuthRepository.login(input);
    }

    const result = await invoke<LoginResultDto>("login_auth_user", { input });
    return toLoginResult(result);
  },

  async logout() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  },

  async resetUserPassword(input) {
    ensureTauriRuntime();
    const dto = await invoke<AuthUserDto>("reset_auth_user_password", {
      input: toResetPasswordInputDto(input),
    });
    return toUserManagementItem(dto);
  },

  async updateUser(input) {
    ensureTauriRuntime();
    const dto = await invoke<AuthUserDto>("update_auth_user", {
      input: toUpdateUserInputDto(input),
    });
    return toUserManagementItem(dto);
  },
};

function toLoginResult(result: LoginResultDto): LoginResult {
  if (!result.ok || !result.session) {
    return {
      ok: false,
      message: result.message ?? "Username atau password tidak valid.",
    };
  }

  const session = toAuthSession(result.session);
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

  return {
    ok: true,
    session,
  };
}

function readStoredSession(): AuthSession | null {
  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(rawSession) as AuthSession;
    if (!parsedSession.user?.id || !parsedSession.startedAt) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return parsedSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function toAuthSession(dto: AuthSessionDto): AuthSession {
  return {
    startedAt: dto.started_at,
    user: {
      id: dto.user.id,
      username: dto.user.username,
      displayName: dto.user.display_name,
      role: dto.user.role,
    },
  };
}

function toUserManagementItem(dto: AuthUserDto): UserManagementItem {
  return {
    id: dto.id,
    username: dto.username,
    displayName: dto.display_name,
    role: dto.role,
    credentialSource: dto.credential_source,
    lastLoginAt: dto.last_login_at,
    portalEmail: dto.portal_email,
    portalUserId: dto.portal_user_id,
    status: dto.status,
  };
}

function toCreateUserInputDto(input: CreateUserInput): CreateUserInputDto {
  return {
    username: input.username,
    display_name: input.displayName,
    role: input.role,
    password: input.password,
    portal_email: input.portalEmail,
  };
}

function toUpdateUserInputDto(input: UpdateUserInput): UpdateUserInputDto {
  return {
    id: input.id,
    display_name: input.displayName,
    role: input.role,
    status: input.status,
    portal_email: input.portalEmail,
  };
}

function toResetPasswordInputDto(input: ResetUserPasswordInput): ResetPasswordInputDto {
  return {
    id: input.id,
    password: input.password,
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Manajemen user hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  }
}
