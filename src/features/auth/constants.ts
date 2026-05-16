import type { AuthPermission, AuthRole } from "./types";

export const AUTH_ROLE_LABELS: Record<AuthRole, string> = {
  admin_payroll: "Admin Payroll",
  owner_management: "Owner/Manajemen",
  viewer: "Viewer",
};

export const ROLE_PERMISSIONS: Record<AuthRole, AuthPermission[]> = {
  admin_payroll: [
    "dashboard:view",
    "master-data:manage",
    "attendance:manage",
    "payroll:manage",
    "reports:view",
    "payslips:view",
    "portal-ess:manage",
    "users:manage",
    "backup:manage",
  ],
  owner_management: ["dashboard:view", "reports:view", "payslips:view"],
  viewer: ["dashboard:view"],
};

export const LOGIN_HELP_TEXT =
  "Gunakan akun lokal sesuai role. Data auth V1 tetap offline di perangkat ini.";
