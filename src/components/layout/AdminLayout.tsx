import type { PropsWithChildren } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_APP_LOGO_SRC } from "@/constants/branding";
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
  | "portal-ess"
  | "users"
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
  { id: "portal-ess", label: "Portal ESS", permission: "portal-ess:manage" },
  { id: "users", label: "User", permission: "users:manage" },
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
      <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-4 border-b border-border bg-background px-6 py-0 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-0">
          {/* Brand */}
          <div className="flex min-w-56 flex-none items-center gap-3 border-r border-border pr-5 py-3.5">
            <span
              className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-md border border-border bg-white"
              aria-hidden="true"
            >
              <img
                className="size-full object-contain p-0.5"
                alt=""
                src={companyLogoDataUrl || DEFAULT_APP_LOGO_SRC}
              />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm font-bold leading-tight tracking-tight">HRIS Payroll</strong>
              <span className="block truncate text-xs text-muted-foreground">{companyName}</span>
            </span>
          </div>
          {/* Nav */}
          <nav
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-3 py-2"
            aria-label="Navigasi utama"
          >
            {navItems.map((item) => {
              const isActive = item.id === activePage;

              return (
                <Button
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative h-8 flex-none justify-start rounded-md px-3 text-sm",
                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isActive &&
                      "bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary",
                  )}
                  disabled={!can(item.permission)}
                  key={item.label}
                  onClick={() => onNavigate(item.id)}
                  type="button"
                  variant="ghost"
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-1/2 h-0.5 w-4/5 -translate-x-1/2 rounded-full bg-primary"
                    />
                  ) : null}
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
        {/* User session */}
        <div className="flex flex-none items-center gap-2 border-l border-border pl-4 py-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 px-3">
                <User aria-hidden="true" />
                Profile
                <ChevronDown aria-hidden="true" className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>
                <span className="block truncate">{session.user.displayName}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {AUTH_ROLE_LABELS[session.user.role]}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void onLogout();
                }}
                variant="destructive"
              >
                <LogOut aria-hidden="true" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-8 py-7">{children}</main>
    </div>
  );
}
