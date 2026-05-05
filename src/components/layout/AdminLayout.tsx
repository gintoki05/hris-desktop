import type { PropsWithChildren } from "react";
import { AUTH_ROLE_LABELS } from "../../features/auth/constants";
import type { AuthPermission, AuthSession } from "../../features/auth/types";

type NavItem = {
  label: string;
  permission: AuthPermission;
};

type AdminLayoutProps = PropsWithChildren<{
  session: AuthSession;
  can: (permission: AuthPermission) => boolean;
  onLogout: () => Promise<void>;
}>;

const navItems: NavItem[] = [
  { label: "Dashboard", permission: "dashboard:view" },
  { label: "Master Data", permission: "master-data:manage" },
  { label: "Absensi", permission: "attendance:manage" },
  { label: "Payroll", permission: "payroll:manage" },
  { label: "Laporan", permission: "reports:view" },
  { label: "Slip PDF", permission: "payslips:view" },
  { label: "Backup", permission: "backup:manage" },
];

export function AdminLayout({ can, children, onLogout, session }: AdminLayoutProps) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand">
          <strong>HRIS Payroll</strong>
          <span>Klinik Permata Medika</span>
        </div>
        <nav className="nav-list" aria-label="Navigasi utama">
          {navItems.map((item, index) => (
            <div
              className="nav-item"
              data-active={index === 0}
              data-disabled={!can(item.permission)}
              key={item.label}
            >
              <span className="nav-dot" aria-hidden="true" />
              {item.label}
            </div>
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
