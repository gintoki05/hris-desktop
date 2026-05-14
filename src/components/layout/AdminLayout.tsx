import type { PropsWithChildren } from "react";
import { AUTH_ROLE_LABELS } from "../../features/auth/constants";
import type { AuthPermission, AuthSession } from "../../features/auth/types";

type NavItem = {
  id: AdminPage;
  label: string;
  permission: AuthPermission;
};

export type AdminPage =
  | "dashboard"
  | "master-data"
  | "attendance"
  | "payroll"
  | "reports"
  | "payslips"
  | "backup";

type AdminLayoutProps = PropsWithChildren<{
  activePage: AdminPage;
  companyName: string;
  companyLogoDataUrl: string;
  session: AuthSession;
  can: (permission: AuthPermission) => boolean;
  onLogout: () => Promise<void>;
  onNavigate: (page: AdminPage) => void;
}>;

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", permission: "dashboard:view" },
  { id: "master-data", label: "Master Data", permission: "master-data:manage" },
  { id: "attendance", label: "Absensi", permission: "attendance:manage" },
  { id: "payroll", label: "Payroll", permission: "payroll:manage" },
  { id: "reports", label: "Laporan", permission: "reports:view" },
  { id: "payslips", label: "Slip PDF", permission: "payslips:view" },
  { id: "backup", label: "Backup", permission: "backup:manage" },
];

export function AdminLayout({
  activePage,
  can,
  children,
  companyLogoDataUrl,
  companyName,
  onLogout,
  onNavigate,
  session,
}: AdminLayoutProps) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            {companyLogoDataUrl ? (
              <img alt="" src={companyLogoDataUrl} />
            ) : (
              "KP"
            )}
          </span>
          <span className="brand-copy">
            <strong>HRIS Payroll</strong>
            <span>{companyName}</span>
          </span>
        </div>
        <nav className="nav-list" aria-label="Navigasi utama">
          {navItems.map((item) => (
            <button
              className="nav-item"
              data-active={item.id === activePage}
              data-disabled={!can(item.permission)}
              disabled={!can(item.permission)}
              key={item.label}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <span className="nav-dot" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="session-panel">
          <span>{AUTH_ROLE_LABELS[session.user.role]}</span>
          <strong>{session.user.displayName}</strong>
          <button onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
