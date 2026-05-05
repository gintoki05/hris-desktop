import type { FoundationStatus } from "../types";

type FoundationStatusPanelProps = {
  errorMessage: string | null;
  status: FoundationStatus | null;
};

export function FoundationStatusPanel({ errorMessage, status }: FoundationStatusPanelProps) {
  const isDatabaseReady = Boolean(status?.database.foreignKeysEnabled);

  return (
    <section className="panel" aria-label="Status fondasi aplikasi">
      <div className="panel-header">
        <h2>Status Lokal</h2>
        <span className="status-pill">{isDatabaseReady ? "Database siap" : "Preview"}</span>
      </div>

      <div className="status-grid">
        <StatusItem label="SQLite" value={isDatabaseReady ? "App data directory" : "Desktop app"} />
        <StatusItem label="Journal" value={status?.database.journalMode.toUpperCase() ?? "-"} />
        <StatusItem
          label="Foreign keys"
          value={status?.database.foreignKeysEnabled ? "Aktif" : "-"}
        />
        <StatusItem
          label="Migrasi"
          value={status ? `${status.database.migrationsApplied} diterapkan` : "-"}
        />
      </div>

      {errorMessage ? <p className="alert">{errorMessage}</p> : null}

      <p className="status-note">Backup lokal tersedia. Restore akan membuat safety backup.</p>
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
