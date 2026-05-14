import { AppNotice } from "../../../components/shared/AppNotice";
import type { FoundationStatus } from "../types";

type FoundationStatusPanelProps = {
  errorMessage: string | null;
  status: FoundationStatus | null;
};

export function FoundationStatusPanel({ errorMessage, status }: FoundationStatusPanelProps) {
  const isDatabaseReady = Boolean(status?.database.foreignKeysEnabled);
  const migrationCount = status?.database.migrationsApplied ?? 0;

  return (
    <section className="panel" aria-label="Status fondasi aplikasi">
      <div className="panel-header">
        <h2>Status Lokal</h2>
        <span className="status-pill">{isDatabaseReady ? "Siap digunakan" : "Memuat"}</span>
      </div>

      <div className="status-grid">
        <StatusItem label="Database lokal" value={isDatabaseReady ? "Siap" : "Memuat"} />
        <StatusItem
          label="Mode penyimpanan"
          value={status?.database.journalMode.toLowerCase() === "wal" ? "Aman untuk desktop" : "Standar"}
        />
        <StatusItem
          label="Validasi data"
          value={status?.database.foreignKeysEnabled ? "Aktif" : "Belum aktif"}
        />
        <StatusItem
          label="Struktur data"
          value={status ? (migrationCount > 0 ? "Terbaru" : "Awal") : "Memuat"}
        />
      </div>

      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}

      <p className="status-note">
        Data disimpan di komputer ini. Backup dan restore tetap memakai safety backup sebelum mengganti data.
      </p>
    </section>
  );
}

type StatusItemProps = {
  label: string;
  value: string;
};

function StatusItem({ label, value }: StatusItemProps) {
  return (
    <div className="status-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
