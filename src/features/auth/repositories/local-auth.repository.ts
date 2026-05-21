import type { AuthRepository } from "./auth.repository";
import type { AuthRole, AuthSession, AuthUser, UserManagementItem } from "../types";

type LocalAuthUserRecord = AuthUser & {
  password: string;
};

const SESSION_STORAGE_KEY = "hris_payroll_auth_session";

const localUsers: LocalAuthUserRecord[] = [
  {
    id: "local-admin-payroll",
    username: "admin.payroll",
    displayName: "Admin Payroll",
    role: "admin_payroll",
    password: "admin",
  },
  {
    id: "local-owner",
    username: "owner",
    displayName: "Owner/Manajemen",
    role: "owner_management",
    password: "owner",
  },
  {
    id: "local-viewer",
    username: "viewer",
    displayName: "Viewer",
    role: "viewer",
    password: "viewer",
  },
];

export const localAuthRepository: AuthRepository = {
  async createUser() {
    throw new Error("Manajemen user hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  },

  async createOwnerPortalAccount() {
    throw new Error("Akun portal manajemen hanya bisa dibuat saat aplikasi berjalan sebagai desktop app.");
  },

  async getSession() {
    return readStoredSession();
  },

  async listUsers() {
    return localUsers.map(toUserManagementItem);
  },

  async login(input) {
    const username = input.username.trim().toLowerCase();
    const password = input.password;
    const userRecord = localUsers.find((user) => user.username === username);

    if (!userRecord || userRecord.password !== password) {
      return {
        ok: false,
        message: "Username atau password tidak valid.",
      };
    }

    const session: AuthSession = {
      startedAt: new Date().toISOString(),
      user: toAuthUser(userRecord),
    };

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return {
      ok: true,
      session,
    };
  },

  async logout() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  },

  async resetUserPassword() {
    throw new Error("Reset password hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  },

  async updateUser() {
    throw new Error("Manajemen user hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  },
};

function readStoredSession(): AuthSession | null {
  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(rawSession) as Partial<AuthSession>;

    if (!isAuthSession(parsedSession)) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return parsedSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function isAuthSession(value: Partial<AuthSession>): value is AuthSession {
  if (!value.user) {
    return false;
  }

  return (
    typeof value.startedAt === "string" &&
    typeof value.user.id === "string" &&
    typeof value.user.username === "string" &&
    typeof value.user.displayName === "string" &&
    isAuthRole(value.user.role)
  );
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === "admin_payroll" || value === "owner_management" || value === "viewer";
}

function toAuthUser(userRecord: LocalAuthUserRecord): AuthUser {
  return {
    id: userRecord.id,
    username: userRecord.username,
    displayName: userRecord.displayName,
    role: userRecord.role,
  };
}

function toUserManagementItem(userRecord: LocalAuthUserRecord): UserManagementItem {
  return {
    ...toAuthUser(userRecord),
    credentialSource: "local_seed",
    lastLoginAt: null,
    status: "active",
    portalEmail: "",
    portalUserId: "",
  };
}
