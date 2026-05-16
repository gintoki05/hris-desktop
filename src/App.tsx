import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  DatabaseBackup,
  FileSpreadsheet,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import "./App.css";
import { AdminLayout, type AdminPage } from "./components/layout/AdminLayout";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { AttendanceImportPanel } from "./features/attendance/components/AttendanceImportPanel";
import { AttendanceMasterPanel } from "./features/attendance/components/AttendanceMasterPanel";
import { WorkSchedulePanel } from "./features/attendance/components/WorkSchedulePanel";
import { LoginPanel } from "./features/auth/components/LoginPanel";
import { useAuthSession } from "./features/auth/hooks/useAuthSession";
import type { AuthPermission } from "./features/auth/types";
import { BackupRestorePanel } from "./features/backup/components/BackupRestorePanel";
import { EmployeeMasterPanel } from "./features/employees/components/EmployeeMasterPanel";
import { OrganizationMasterPanel } from "./features/organization/components/OrganizationMasterPanel";
import { PayslipManagerPanel } from "./features/payslips/components/PayslipManagerPanel";
import { ManualPayrollPanel } from "./features/payroll/components/ManualPayrollPanel";
import { PortalEssPanel } from "./features/portal-ess/components/PortalEssPanel";
import { FoundationStatusPanel } from "./features/settings/components/FoundationStatusPanel";
import { MasterSettingsPanel } from "./features/settings/components/MasterSettingsPanel";
import { getFoundationStatus } from "./features/settings/services/foundation.service";
import { getMasterSettings } from "./features/settings/services/master-settings.service";
import type { FoundationStatus, MasterSettings } from "./features/settings/types";

type MasterDataTab = "settings" | "employees" | "organization-master" | "attendance-master";

const masterDataTabs: Array<{
  id: MasterDataTab;
  label: string;
}> = [
  { id: "settings", label: "Pengaturan" },
  { id: "employees", label: "Karyawan" },
  { id: "organization-master", label: "Referensi" },
  { id: "attendance-master", label: "Master Absensi" },
];

function App() {
  const auth = useAuthSession();
  const [activePage, setActivePage] = useState<AdminPage>("dashboard");
  const [activeMasterDataTab, setActiveMasterDataTab] = useState<MasterDataTab>("settings");
  const [employeeDetailRequest, setEmployeeDetailRequest] = useState<{ employeeId: string; requestId: number } | null>(null);
  const [status, setStatus] = useState<FoundationStatus | null>(null);
  const [masterSettings, setMasterSettings] = useState<MasterSettings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getFoundationStatus()
      .then((nextStatus) => {
        if (!isMounted) {
          return;
        }

        setStatus(nextStatus);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Gagal menyiapkan database lokal.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    getMasterSettings()
      .then((settings) => {
        if (isMounted) {
          setMasterSettings(settings);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMasterSettings(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const actions = useMemo(
    (): Array<{
      label: string;
      permission: AuthPermission;
      targetPage: AdminPage;
      icon: LucideIcon;
    }> => [
      {
        icon: Users,
        label: "Kelola Master Data",
        permission: "master-data:manage",
        targetPage: "master-data",
      },
      {
        icon: FileSpreadsheet,
        label: "Import Absensi",
        permission: "attendance:manage",
        targetPage: "attendance",
      },
      {
        icon: Settings,
        label: "Hitung Payroll",
        permission: "payroll:manage",
        targetPage: "payroll",
      },
      {
        icon: DatabaseBackup,
        label: "Buat Backup",
        permission: "backup:manage",
        targetPage: "backup",
      },
    ],
    [],
  );

  const pageTitle = useMemo(() => {
    const titles: Record<AdminPage, string> = {
      attendance: "Absensi",
      backup: "Backup & Restore",
      dashboard: "Dashboard",
      "master-data": "Master Data",
      payroll: "Payroll",
      payslips: "Slip PDF",
      "portal-ess": "Portal ESS",
      reports: "Laporan",
    };

    return titles[activePage];
  }, [activePage]);

  const pageDescription = useMemo(() => {
    const descriptions: Record<AdminPage, string> = {
      attendance: "Kelola jadwal kerja dan import absensi fingerprint dari file Excel lokal.",
      backup: "Buat backup lokal dan siapkan restore database dengan safety copy.",
      dashboard: "Ringkasan status aplikasi dan akses cepat untuk pekerjaan payroll harian.",
      "master-data": "Kelola data dasar perusahaan, karyawan, shift, kode absensi, dan aturan lembur.",
      payroll: "Hitung payroll dari snapshot absensi dan master payroll yang sudah tervalidasi.",
      payslips: "Kelola periode slip, daftar slip karyawan, PDF massal, dan status kirim WhatsApp manual.",
      "portal-ess": "Kelola akun login karyawan dan sinkronisasi profile Employee Self-Service Portal.",
      reports: "Lihat ringkasan payroll dan data manajemen tanpa aksi perubahan.",
    };

    return descriptions[activePage];
  }, [activePage]);

  if (!auth.session) {
    return (
      <LoginPanel
        errorMessage={auth.errorMessage}
        isLoading={auth.isLoading}
        onLogin={auth.login}
      />
    );
  }

  function openEmployeeDetailFromPortal(employeeId: string) {
    setEmployeeDetailRequest({ employeeId, requestId: Date.now() });
    setActiveMasterDataTab("employees");
    setActivePage("master-data");
  }

  return (
    <AdminLayout
      activePage={activePage}
      can={auth.can}
      companyLogoDataUrl={masterSettings?.company.logoDataUrl ?? ""}
      companyName={masterSettings?.company.companyName ?? "Klinik Permata Medika"}
      onLogout={auth.logout}
      onNavigate={setActivePage}
      session={auth.session}
    >
      <section className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">HRIS Payroll Klinik</p>
          <h1 className="mb-2 text-3xl font-semibold tracking-normal text-foreground">{pageTitle}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{pageDescription}</p>
        </div>
      </section>

      {activePage === "dashboard" ? (
        <>
          <FoundationStatusPanel errorMessage={errorMessage} status={status} />

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Aksi Penting</CardTitle>
                <CardDescription>Jalur cepat untuk pekerjaan payroll harian.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2" aria-label="Aksi penting">
              {actions.map((action) => (
                <Button
                  disabled={!auth.can(action.permission)}
                  key={action.label}
                  onClick={() => setActivePage(action.targetPage)}
                  type="button"
                  variant="outline"
                >
                  <action.icon aria-hidden="true" />
                  {action.label}
                  <ArrowRight aria-hidden="true" />
                </Button>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {activePage === "master-data" ? (
        <Tabs
          aria-label="Submenu master data"
          onValueChange={(value) => setActiveMasterDataTab(value as MasterDataTab)}
          value={activeMasterDataTab}
        >
          <TabsList>
            {masterDataTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="settings">
            <MasterSettingsPanel
              canEdit={auth.can("master-data:manage")}
              onSettingsSaved={setMasterSettings}
              session={auth.session}
            />
          </TabsContent>

          <TabsContent value="employees">
            <EmployeeMasterPanel
              canEdit={auth.can("master-data:manage")}
              openEmployeeRequest={employeeDetailRequest}
              session={auth.session}
            />
          </TabsContent>

          <TabsContent value="organization-master">
            <OrganizationMasterPanel
              canEdit={auth.can("master-data:manage")}
              session={auth.session}
            />
          </TabsContent>

          <TabsContent value="attendance-master">
            <AttendanceMasterPanel
              canEdit={auth.can("master-data:manage")}
              session={auth.session}
            />
          </TabsContent>
        </Tabs>
      ) : null}

      {activePage === "attendance" ? (
        <>
          <WorkSchedulePanel
            canEdit={auth.can("attendance:manage")}
            session={auth.session}
          />

          <AttendanceImportPanel
            canEdit={auth.can("attendance:manage")}
            session={auth.session}
          />
        </>
      ) : null}

      {activePage === "payroll" ? (
        <ManualPayrollPanel
          canEdit={auth.can("payroll:manage")}
          session={auth.session}
        />
      ) : null}

      {activePage === "reports" ? (
        <PlaceholderPanel
          description="Halaman laporan akan dipakai untuk ringkasan payroll dan data manajemen tanpa aksi perubahan."
          title="Laporan belum diimplementasikan"
        />
      ) : null}

      {activePage === "payslips" ? (
        <PayslipManagerPanel
          canEdit={auth.can("payroll:manage")}
          session={auth.session}
        />
      ) : null}

      {activePage === "portal-ess" ? (
        <PortalEssPanel
          canManage={auth.can("portal-ess:manage")}
          onOpenEmployeeDetail={openEmployeeDetailFromPortal}
          session={auth.session}
        />
      ) : null}

      {activePage === "backup" ? (
        <BackupRestorePanel
          canEdit={auth.can("backup:manage")}
          databaseStatus={status?.database ?? null}
        />
      ) : null}
    </AdminLayout>
  );
}

function PlaceholderPanel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <CardAction>
          <Badge variant="outline">V1 backlog</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Detail implementasi akan diselesaikan saat scope backlog ini dikerjakan.
      </CardContent>
    </Card>
  );
}

export default App;
