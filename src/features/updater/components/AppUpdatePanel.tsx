import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FeaturePanel, PanelBody, PanelNote, StatusBadge } from "../../../components/shared/FeaturePanel";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { checkForAppUpdate, installPendingAppUpdate } from "../services/app-update.service";
import type { AppUpdateCheckResult, AppUpdateInstallProgress } from "../types";

type AppUpdatePanelProps = {
  canInstall: boolean;
};

export function AppUpdatePanel({ canInstall }: AppUpdatePanelProps) {
  const [result, setResult] = useState<AppUpdateCheckResult | null>(null);
  const [progress, setProgress] = useState<AppUpdateInstallProgress | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheckUpdate() {
    setIsChecking(true);
    setProgress(null);
    setMessage(null);
    setErrorMessage(null);

    try {
      const nextResult = await checkForAppUpdate();
      setResult(nextResult);
      setMessage(nextResult.status === "current" ? "Aplikasi sudah memakai versi terbaru." : null);
    } catch (error: unknown) {
      setResult(null);
      setErrorMessage(toErrorMessage(error, "Gagal mengecek update aplikasi."));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleInstallUpdate() {
    setIsInstalling(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await installPendingAppUpdate(setProgress);
      setMessage("Update selesai di-install. Jika aplikasi belum tertutup otomatis, tutup dan buka ulang aplikasi.");
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error, "Gagal mengunduh atau meng-install update."));
    } finally {
      setIsInstalling(false);
    }
  }

  const isUpdateAvailable = result?.status === "available";
  const progressLabel = progress
    ? progress.percentage !== null
      ? `${progress.percentage}%`
      : formatBytes(progress.downloadedBytes)
    : "";

  return (
    <FeaturePanel
      aria-label="Update aplikasi"
      badge={<StatusBadge>{isUpdateAvailable ? "Update tersedia" : "Manual"}</StatusBadge>}
      title="Update Aplikasi"
    >
      <PanelBody>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-2">
            <p className="text-sm leading-6 text-muted-foreground">
              Cek update saat komputer tersambung internet. Data payroll tetap tersimpan lokal dan tidak ikut dikirim.
            </p>

            {result ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <span className="block text-xs font-medium uppercase text-muted-foreground">Versi aplikasi</span>
                <strong className="mt-1 block text-sm font-semibold text-foreground">
                  {result.status === "available"
                    ? `${result.currentVersion} -> ${result.latestVersion}`
                    : result.currentVersion}
                </strong>
                {result.status === "available" && result.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{result.notes}</p>
                ) : null}
                {result.status === "available" && result.publishedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">Dirilis: {result.publishedAt}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              disabled={isChecking || isInstalling}
              onClick={handleCheckUpdate}
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              {isChecking ? "Mengecek" : "Cek Update"}
            </Button>

            <Button
              disabled={!canInstall || !isUpdateAvailable || isChecking || isInstalling}
              onClick={handleInstallUpdate}
              type="button"
            >
              <Download aria-hidden="true" />
              {isInstalling ? "Meng-install" : "Download & Install"}
            </Button>
          </div>
        </div>

        {progress ? (
          <Alert>
            <AlertTitle>{progress.status === "installing" ? "Meng-install update" : "Mengunduh update"}</AlertTitle>
            <AlertDescription>
              Progress: {progressLabel}
              {progress.totalBytes ? ` dari ${formatBytes(progress.totalBytes)}` : ""}. Di Windows, aplikasi dapat
              tertutup otomatis saat installer berjalan.
            </AlertDescription>
          </Alert>
        ) : null}

        {message ? <AppNotice>{message}</AppNotice> : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      </PanelBody>

      <PanelNote tone="warning">
        Sebelum update versi produksi, buat backup database lokal terlebih dahulu jika release notes menyebut perubahan
        struktur data atau migrasi.
      </PanelNote>
    </FeaturePanel>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
