import type { PropsWithChildren } from "react";

const navItems = ["Dashboard", "Master Data", "Absensi", "Payroll", "Slip PDF", "Backup"];

export function AdminLayout({ children }: PropsWithChildren) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand">
          <strong>HRIS Payroll</strong>
          <span>Klinik Permata Medika</span>
        </div>
        <nav className="nav-list" aria-label="Navigasi utama">
          {navItems.map((item, index) => (
            <div className="nav-item" data-active={index === 0} key={item}>
              <span className="nav-dot" aria-hidden="true" />
              {item}
            </div>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
