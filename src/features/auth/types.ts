export type AuthRole = "admin_payroll" | "owner_management" | "viewer";

export type AuthPermission =
  | "dashboard:view"
  | "master-data:manage"
  | "attendance:manage"
  | "payroll:manage"
  | "reports:view"
  | "payslips:view"
  | "portal-ess:manage"
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

export type LoginInput = {
  username: string;
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
