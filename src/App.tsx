import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { AdminLayout, type AdminPage } from "./components/layout/AdminLayout";
import { AttendanceImportPanel } from "./features/attendance/components/AttendanceImportPanel";
import { AttendanceMasterPanel } from "./features/attendance/components/AttendanceMasterPanel";
import { WorkSchedulePanel } from "./features/attendance/components/WorkSchedulePanel";
import { LoginPanel } from "./features/auth/components/LoginPanel";
import { useAuthSession } from "./features/auth/hooks/useAuthSession";
import type { AuthPermission } from "./features/auth/types";
import { EmployeeMasterPanel } from "./features/employees/components/EmployeeMasterPanel";
import { OrganizationMasterPanel } from "./features/organization/components/OrganizationMasterPanel";
import { PayslipManagerPanel } from "./features/payslips/components/PayslipManagerPanel";
import { PayslipWhatsAppPanel } from "./features/payslips/components/PayslipWhatsAppPanel";
import { ManualPayrollPanel } from "./features/payroll/components/ManualPayrollPanel";
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
    }> => [
      { label: "Kelola Master Data", permission: "master-data:manage", targetPage: "master-data" },
      { label: "Import Absensi", permission: "attendance:manage", targetPage: "attendance" },
      { label: "Hitung Payroll", permission: "payroll:manage", targetPage: "payroll" },
      { label: "Buat Backup", permission: "backup:manage", targetPage: "backup" },
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
      payslips: "Kelola periode slip, snapshot data gaji final, PDF massal, dan status kirim WhatsApp manual.",
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
      <section className="page-header">
        <div>
          <p className="eyebrow">HRIS Payroll Klinik</p>
          <h1>{pageTitle}</h1>
          <p className="page-description">{pageDescription}</p>
        </div>
      </section>

      {activePage === "dashboard" ? (
        <>
          <FoundationStatusPanel errorMessage={errorMessage} status={status} />

          <section className="panel">
            <div className="panel-header">
              <h2>Aksi Penting</h2>
            </div>
            <div className="action-row" aria-label="Aksi penting">
              {actions.map((action) => (
                <button
                  disabled={!auth.can(action.permission)}
                  key={action.label}
                  onClick={() => setActivePage(action.targetPage)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {activePage === "master-data" ? (
        <>
          <div className="page-tabs" role="tablist" aria-label="Submenu master data">
            {masterDataTabs.map((tab) => (
              <button
                aria-selected={tab.id === activeMasterDataTab}
                className="page-tab"
                key={tab.id}
                onClick={() => setActiveMasterDataTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeMasterDataTab === "settings" ? (
            <MasterSettingsPanel
              canEdit={auth.can("master-data:manage")}
              onSettingsSaved={setMasterSettings}
              session={auth.session}
            />
          ) : null}

          {activeMasterDataTab === "employees" ? (
            <EmployeeMasterPanel
              canEdit={auth.can("master-data:manage")}
              session={auth.session}
            />
          ) : null}

          {activeMasterDataTab === "organization-master" ? (
            <OrganizationMasterPanel
              canEdit={auth.can("master-data:manage")}
              session={auth.session}
            />
          ) : null}

          {activeMasterDataTab === "attendance-master" ? (
            <AttendanceMasterPanel
              canEdit={auth.can("master-data:manage")}
              session={auth.session}
            />
          ) : null}
        </>
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
        <>
          <PayslipManagerPanel
            canEdit={auth.can("payroll:manage")}
            session={auth.session}
          />
          <PayslipWhatsAppPanel session={auth.session} />
        </>
      ) : null}

      {activePage === "backup" ? (
        <PlaceholderPanel
          description="Halaman backup dan restore akan menangani safety copy sebelum operasi restore atau perubahan destruktif."
          title="Backup & restore belum diimplementasikan"
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
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span className="status-pill">V1 backlog</span>
      </div>
      <p className="empty-panel-note">{description}</p>
    </section>
  );
}

export default App;
