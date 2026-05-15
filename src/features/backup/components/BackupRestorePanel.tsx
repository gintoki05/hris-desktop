import { useEffect, useMemo, useState } from "react";
import { DatabaseBackup, FolderOpen, RotateCcw, ShieldCheck } from "lucide-react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { AppNotice } from "@/components/shared/AppNotice";
import { FeaturePanel, PanelBody, PanelNote, StatusBadge } from "@/components/shared/FeaturePanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LocalDatabaseStatus } from "@/features/settings/types";
import {
  createLocalDatabaseBackup,
  listLocalDatabaseBackups,
  restoreLocalDatabaseBackup,
} from "../services/backup.service";
import type { LocalBackupFile } from "../types";

type BackupRestorePanelProps = {
  canEdit: boolean;
  databaseStatus: LocalDatabaseStatus | null;
};

export function BackupRestorePanel({ canEdit, databaseStatus }: BackupRestorePanelProps) {
  const [backups, setBackups] = useState<LocalBackupFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<LocalBackupFile | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const backupCountLabel = useMemo(() => `${backups.length} file backup`, [backups.length]);

  useEffect(() => {
    void refreshBackups();
  }, []);

  async function refreshBackups(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setBackups(await listLocalDatabaseBackups());
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, "Gagal memuat daftar backup lokal."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateBackup(): Promise<void> {
    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const backupPath = await createLocalDatabaseBackup();
      setLastBackupPath(backupPath);
      setSuccessMessage("Backup database berhasil dibuat.");
      await refreshBackups();
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, "Gagal membuat backup database lokal."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRestoreBackup(): Promise<void> {
    if (!restoreCandidate) {
      return;
    }

    setIsRestoring(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await restoreLocalDatabaseBackup(restoreCandidate.path);
      setSuccessMessage("Restore berhasil. Muat ulang aplikasi sebelum melanjutkan input data.");
      setRestoreCandidate(null);
      await refreshBackups();
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, "Gagal restore database lokal."));
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleOpenBackupFolder(): Promise<void> {
    if (!databaseStatus?.backupDirectory) {
      return;
    }

    try {
      await openPath(databaseStatus.backupDirectory);
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, "Folder backup tidak bisa dibuka."));
    }
  }

  async function handleRevealBackup(path: string): Promise<void> {
    try {
      await revealItemInDir(path);
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, "File backup tidak bisa ditampilkan."));
    }
  }

  return (
    <>
      <FeaturePanel
        aria-label="Backup dan restore database lokal"
        badge={<StatusBadge>{backupCountLabel}</StatusBadge>}
        title="Backup & Restore Lokal"
      >
        <PanelBody>
          <div className="grid gap-3 lg:grid-cols-3">
            <StatusItem
              label="Database aktif"
              value={databaseStatus?.databasePath ?? "Memuat"}
            />
            <StatusItem
              label="Folder backup"
              value={databaseStatus?.backupDirectory ?? "Memuat"}
            />
            <StatusItem
              label="Safety restore"
              value="Backup otomatis sebelum restore"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canEdit || isCreating}
              onClick={() => void handleCreateBackup()}
              type="button"
            >
              <DatabaseBackup aria-hidden="true" />
              {isCreating ? "Membuat backup..." : "Buat Backup Sekarang"}
            </Button>
            <Button
              disabled={!databaseStatus?.backupDirectory}
              onClick={() => void handleOpenBackupFolder()}
              type="button"
              variant="outline"
            >
              <FolderOpen aria-hidden="true" />
              Buka Folder Backup
            </Button>
            <Button
              disabled={isLoading}
              onClick={() => void refreshBackups()}
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}
          {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
          {lastBackupPath ? (
            <Alert>
              <ShieldCheck aria-hidden="true" />
              <AlertTitle>Backup terakhir</AlertTitle>
              <AlertDescription>{lastBackupPath}</AlertDescription>
            </Alert>
          ) : null}

          <BackupTable
            backups={backups}
            canEdit={canEdit}
            isLoading={isLoading}
            onRevealBackup={handleRevealBackup}
            onSelectRestore={setRestoreCandidate}
          />
        </PanelBody>

        <PanelNote tone="warning">
          Restore akan mengganti database aktif dengan file backup yang dipilih. Aplikasi membuat safety backup
          terlebih dahulu, lalu admin perlu memuat ulang aplikasi sebelum melanjutkan pekerjaan.
        </PanelNote>
      </FeaturePanel>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setRestoreCandidate(null);
          }
        }}
        open={Boolean(restoreCandidate)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore database?</DialogTitle>
            <DialogDescription>
              Database aktif akan diganti dengan backup ini. Safety backup otomatis dibuat sebelum restore.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <span className="block font-medium text-foreground">{restoreCandidate?.fileName}</span>
            <span className="mt-1 block break-all text-muted-foreground">{restoreCandidate?.path}</span>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={isRestoring} type="button" variant="outline">
                Batal
              </Button>
            </DialogClose>
            <Button
              disabled={isRestoring}
              onClick={() => void handleRestoreBackup()}
              type="button"
              variant="destructive"
            >
              {isRestoring ? "Restore..." : "Restore Database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type BackupTableProps = {
  backups: LocalBackupFile[];
  canEdit: boolean;
  isLoading: boolean;
  onRevealBackup: (path: string) => Promise<void>;
  onSelectRestore: (backup: LocalBackupFile) => void;
};

function BackupTable({
  backups,
  canEdit,
  isLoading,
  onRevealBackup,
  onSelectRestore,
}: BackupTableProps) {
  if (isLoading && backups.length === 0) {
    return <p className="text-sm text-muted-foreground">Memuat daftar backup...</p>;
  }

  if (backups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
        Belum ada file backup. Buat backup sebelum melakukan migrasi, restore, atau perubahan data besar.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Dibuat/diubah</TableHead>
            <TableHead>Ukuran</TableHead>
            <TableHead className="w-48 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {backups.map((backup) => (
            <TableRow key={backup.path}>
              <TableCell>
                <span className="block max-w-96 truncate font-medium" title={backup.fileName}>
                  {backup.fileName}
                </span>
                <span className="block max-w-96 truncate text-xs text-muted-foreground" title={backup.path}>
                  {backup.path}
                </span>
              </TableCell>
              <TableCell>{formatBackupDate(backup.modifiedAtUnixMs)}</TableCell>
              <TableCell>{formatBytes(backup.sizeBytes)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => void onRevealBackup(backup.path)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Folder
                  </Button>
                  <Button
                    disabled={!canEdit}
                    onClick={() => onSelectRestore(backup)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    Restore
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
      <strong className="mt-1 block break-all text-sm font-semibold text-foreground">{value}</strong>
    </div>
  );
}

function formatBackupDate(value: number): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
