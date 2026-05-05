import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { AdminLayout } from "./components/layout/AdminLayout";
import { FoundationStatusPanel } from "./features/settings/components/FoundationStatusPanel";
import { getFoundationStatus } from "./features/settings/services/foundation.service";
import type { FoundationStatus } from "./features/settings/types";

function App() {
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
    () => [
      {
        name: "Master Data",
        description: "Perusahaan, karyawan, komponen payroll, dan pengaturan periode.",
        status: "Siap dikembangkan",
      },
      {
        name: "Absensi",
        description: "Import Excel/fingerprint, input manual izin, sakit, cuti, lembur, dan koreksi.",
        status: "Service placeholder",
      },
      {
        name: "Payroll",
        description: "Perhitungan deterministic dari snapshot absensi dan master payroll.",
        status: "Service placeholder",
      },
      {
        name: "Slip PDF",
        description: "Generate slip dari payroll final tanpa membaca live master data.",
        status: "Offline-ready placeholder",
      },
    ],
    [],
  );

  return (
    <AdminLayout>
      <section className="page-header">
        <div>
          <p className="eyebrow">HRIS Payroll Klinik</p>
          <h1>Fondasi Desktop Offline</h1>
        </div>
        <span className="offline-badge">Offline-first</span>
      </section>

      <FoundationStatusPanel errorMessage={errorMessage} status={status} />

      <section className="module-grid" aria-label="Modul V1">
        {modules.map((module) => (
          <article className="module-card" key={module.name}>
            <div>
              <h2>{module.name}</h2>
              <p>{module.description}</p>
            </div>
            <span>{module.status}</span>
          </article>
        ))}
      </section>
    </AdminLayout>
  );
}

export default App;
