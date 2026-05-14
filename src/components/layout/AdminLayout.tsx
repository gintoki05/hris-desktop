import type { PropsWithChildren } from "react";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <div className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)] bg-background text-foreground">
      <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-4 border-b bg-background/95 px-8 py-3 shadow-xs">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <div className="flex min-w-56 flex-none items-center gap-3">
            <span
              className="flex size-9 flex-none items-center justify-center overflow-hidden rounded-lg bg-primary text-xs font-bold text-primary-foreground"
              aria-hidden="true"
            >
              {companyLogoDataUrl ? (
                <img className="size-full object-contain p-0.5" alt="" src={companyLogoDataUrl} />
              ) : (
                "KP"
              )}
            </span>
            <span className="min-w-0">
              <strong className="block text-base font-semibold leading-tight">HRIS Payroll</strong>
              <span className="block truncate text-xs text-muted-foreground">{companyName}</span>
            </span>
          </div>
          <nav
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
            aria-label="Navigasi utama"
          >
            {navItems.map((item) => {
              const isActive = item.id === activePage;

              return (
                <Button
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative h-9 flex-none justify-start px-3",
                    "text-muted-foreground hover:text-foreground",
                    isActive
                      && "border border-primary/25 bg-primary/10 pl-4 font-semibold text-primary shadow-xs hover:bg-primary/10 hover:text-primary",
                  )}
                  disabled={!can(item.permission)}
                  key={item.label}
                  onClick={() => onNavigate(item.id)}
                  type="button"
                  variant={isActive ? "secondary" : "ghost"}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
                    />
                  ) : null}
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-none items-center gap-2">
          <div className="flex max-w-72 items-center gap-2 truncate">
            <Badge variant="outline">{AUTH_ROLE_LABELS[session.user.role]}</Badge>
            <span className="truncate text-sm text-muted-foreground">{session.user.displayName}</span>
          </div>
          <Button onClick={() => void onLogout()} type="button" variant="outline">
            <LogOut aria-hidden="true" />
            Logout
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-8 py-7">{children}</main>
    </div>
  );
}
