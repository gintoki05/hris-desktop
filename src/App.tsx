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
import { FoundationStatusPanel } from "./features/settings/components/FoundationStatusPanel";
import { MasterSettingsPanel } from "./features/settings/components/MasterSettingsPanel";
import { getFoundationStatus } from "./features/settings/services/foundation.service";
import type { FoundationStatus } from "./features/settings/types";

type MasterDataTab = "settings" | "employees" | "attendance-master";

const masterDataTabs: Array<{
  id: MasterDataTab;
  label: string;
}> = [
  { id: "settings", label: "Pengaturan" },
  { id: "employees", label: "Karyawan" },
  { id: "attendance-master", label: "Master Absensi" },
];

function App() {
  const auth = useAuthSession();
  const [activePage, setActivePage] = useState<AdminPage>("dashboard");
  const [activeMasterDataTab, setActiveMasterDataTab] = useState<MasterDataTab>("settings");
  const [status, setStatus] = useState<FoundationStatus | null>(null);
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

  const modules = useMemo(
    (): Array<{
      name: string;
      description: string;
      status: string;
      permission: AuthPermission;
    }> => [
      {
        name: "Master Data",
        description: "Perusahaan, karyawan, komponen payroll, dan pengaturan periode.",
        permission: "master-data:manage",
        status: "Admin Payroll",
      },
      {
        name: "Absensi",
        description: "Import Excel/fingerprint, input manual dan koreksi absensi.",
        permission: "attendance:manage",
        status: "Admin Payroll",
      },
      {
        name: "Payroll",
        description: "Perhitungan deterministic dari snapshot absensi dan master payroll.",
        permission: "payroll:manage",
        status: "Admin Payroll",
      },
      {
        name: "Laporan",
        description: "Ringkasan payroll dan informasi manajemen tanpa aksi perubahan.",
        permission: "reports:view",
        status: "Manajemen",
      },
      {
        name: "Slip PDF",
        description: "Generate slip dari payroll final tanpa membaca live master data.",
        permission: "payslips:view",
        status: "Terbatas role",
      },
    ],
    [],
  );

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
      onLogout={auth.logout}
      onNavigate={setActivePage}
      session={auth.session}
    >
      <section className="page-header">
        <div>
          <p className="eyebrow">HRIS Payroll Klinik</p>
          <h1>{pageTitle}</h1>
        </div>
        <span className="offline-badge">Offline-first</span>
      </section>

      {activePage === "dashboard" ? (
        <>
          <FoundationStatusPanel errorMessage={errorMessage} status={status} />

          <section className="panel">
            <div className="panel-header">
              <h2>Aksi Penting</h2>
              <span className="status-pill">Role-gated</span>
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

          <section className="module-grid" aria-label="Modul V1">
            {modules.map((module) => (
              <article
                className="module-card"
                data-disabled={!auth.can(module.permission)}
                key={module.name}
              >
                <div>
                  <h2>{module.name}</h2>
                  <p>{module.description}</p>
                </div>
                <span>{auth.can(module.permission) ? module.status : "Tidak tersedia"}</span>
              </article>
            ))}
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
              session={auth.session}
            />
          ) : null}

          {activeMasterDataTab === "employees" ? (
            <EmployeeMasterPanel
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
        <PlaceholderPanel
          description="Halaman perhitungan payroll akan menampilkan periode, snapshot absensi, komponen pendapatan/potongan, dan proses finalisasi."
          title="Payroll belum diimplementasikan"
        />
      ) : null}

      {activePage === "reports" ? (
        <PlaceholderPanel
          description="Halaman laporan akan dipakai untuk ringkasan payroll dan data manajemen tanpa aksi perubahan."
          title="Laporan belum diimplementasikan"
        />
      ) : null}

      {activePage === "payslips" ? (
        <PlaceholderPanel
          description="Halaman slip PDF akan memakai payroll snapshot final, bukan live master data."
          title="Slip PDF belum diimplementasikan"
        />
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
