export type AuthRole = "admin_payroll" | "owner_management" | "viewer";
export type AuthUserStatus = "active" | "inactive";
export type AuthCredentialSource = "local_seed" | "sqlite";

export type AuthPermission =
  | "dashboard:view"
  | "master-data:manage"
  | "attendance:manage"
  | "payroll:manage"
  | "reports:view"
  | "payslips:view"
  | "portal-ess:manage"
  | "users:manage"
  | "backup:manage";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
};

export type AuthSession = {
  user: AuthUser;
  startedAt: string;
};

export type UserManagementItem = AuthUser & {
  credentialSource: AuthCredentialSource;
  lastLoginAt: string | null;
  status: AuthUserStatus;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type CreateUserInput = {
  username: string;
  displayName: string;
  role: AuthRole;
  password: string;
};

export type UpdateUserInput = {
  id: string;
  displayName: string;
  role: AuthRole;
  status: AuthUserStatus;
};

export type ResetUserPasswordInput = {
  id: string;
  password: string;
};

export type LoginResult =
  | {
      ok: true;
      session: AuthSession;
    }
  | {
      ok: false;
      message: string;
    };
