import { AppNotice } from "../../../components/shared/AppNotice";
import { FeaturePanel, PanelBody, StatusBadge } from "../../../components/shared/FeaturePanel";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import type { FoundationStatus } from "../types";

type FoundationStatusPanelProps = {
  errorMessage: string | null;
  status: FoundationStatus | null;
};

export function FoundationStatusPanel({ errorMessage, status }: FoundationStatusPanelProps) {
  const isDatabaseReady = Boolean(status?.database.foreignKeysEnabled);
  const migrationCount = status?.database.migrationsApplied ?? 0;

  return (
    <FeaturePanel
      aria-label="Status fondasi aplikasi"
      badge={<StatusBadge>{isDatabaseReady ? "Siap digunakan" : "Memuat"}</StatusBadge>}
      title="Status Lokal"
    >
      <PanelBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        <Alert>
          <AlertTitle>Penyimpanan lokal</AlertTitle>
          <AlertDescription>
            Data disimpan di komputer ini. Backup dan restore tetap memakai safety backup sebelum mengganti data.
          </AlertDescription>
        </Alert>
      </PanelBody>
    </FeaturePanel>
  );
}

type StatusItemProps = {
  label: string;
  value: string;
};

function StatusItem({ label, value }: StatusItemProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <span className="block text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-sm font-semibold text-foreground">{value}</strong>
    </div>
  );
}
