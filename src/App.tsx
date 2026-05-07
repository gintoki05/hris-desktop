import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { AdminLayout } from "./components/layout/AdminLayout";
import { LoginPanel } from "./features/auth/components/LoginPanel";
import { useAuthSession } from "./features/auth/hooks/useAuthSession";
import type { AuthPermission } from "./features/auth/types";
import { EmployeeMasterPanel } from "./features/employees/components/EmployeeMasterPanel";
import { FoundationStatusPanel } from "./features/settings/components/FoundationStatusPanel";
import { MasterSettingsPanel } from "./features/settings/components/MasterSettingsPanel";
import { getFoundationStatus } from "./features/settings/services/foundation.service";
import type { FoundationStatus } from "./features/settings/types";

function App() {
  const auth = useAuthSession();
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
    }> => [
      { label: "Kelola Master Data", permission: "master-data:manage" },
      { label: "Import Absensi", permission: "attendance:manage" },
      { label: "Hitung Payroll", permission: "payroll:manage" },
      { label: "Buat Backup", permission: "backup:manage" },
    ],
    [],
  );

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
    <AdminLayout can={auth.can} onLogout={auth.logout} session={auth.session}>
      <section className="page-header">
        <div>
          <p className="eyebrow">HRIS Payroll Klinik</p>
          <h1>Dashboard</h1>
        </div>
        <span className="offline-badge">Offline-first</span>
      </section>

      <FoundationStatusPanel errorMessage={errorMessage} status={status} />

      <MasterSettingsPanel
        canEdit={auth.can("master-data:manage")}
        session={auth.session}
      />

      <EmployeeMasterPanel
        canEdit={auth.can("master-data:manage")}
        session={auth.session}
      />

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
    </AdminLayout>
  );
}

export default App;
