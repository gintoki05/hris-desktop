import { useEffect, useMemo, useState } from "react";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { AppNotice } from "../../../components/shared/AppNotice";
import {
  FeaturePanel,
  PanelBody,
  PanelNote,
  StatusBadge,
} from "../../../components/shared/FeaturePanel";
import { FileNameCell } from "../../../components/shared/FileNameCell";
import { PaginationControls } from "../../../components/shared/PaginationControls";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { formatRupiah } from "../../../lib/formatters/currency";
import {
  formatDisplayDateRange,
  formatDisplayDateText,
} from "../../../lib/formatters/date-time";
import type { AuthSession } from "../../auth/types";
import {
  generatePayslipPdfs,
  listPayslipPeriods,
  listPayslipSnapshots,
  publishFinalPayslipsToPortal,
  updatePayslipSnapshotSendStatus,
} from "../services/payslip-manager.service";
import {
  createPayslipWhatsAppMessage,
  maskWhatsAppNumber,
} from "../services/whatsapp-delivery.service";
import type {
  PayslipManagerSnapshot,
  PayslipPeriod,
} from "../types";

type PayslipManagerPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

const PERIOD_STATUS_LABELS: Record<PayslipPeriod["status"], string> = {
  archived: "Diarsipkan",
  draft: "Draft",
  imported: "Data slip tersimpan",
  pdf_ready: "PDF siap",
};

const WHATSAPP_STATUS_LABELS: Record<PayslipManagerSnapshot["whatsappStatus"], string> = {
  failed: "Gagal",
  missing_number: "Nomor kosong",
  not_opened: "Belum",
  opened: "Dibuka",
  sent_manual: "Terkirim manual",
};

const PORTAL_STATUS_LABELS: Record<PayslipManagerSnapshot["portalPublishStatus"], string> = {
  failed: "Gagal",
  not_published: "Belum",
  published: "Published",
};

const PERIOD_PAGE_SIZE = 5;

export function PayslipManagerPanel({ canEdit, session }: PayslipManagerPanelProps) {
  const [periods, setPeriods] = useState<PayslipPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PayslipManagerSnapshot[]>([]);
  const [periodPage, setPeriodPage] = useState(1);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isRegeneratingPdf, setIsRegeneratingPdf] = useState(false);
  const [isPublishingPortal, setIsPublishingPortal] = useState(false);
  const [updatingSnapshotId, setUpdatingSnapshotId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshPeriods();
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) {
      setSnapshots([]);
      return;
    }

    void refreshSnapshots(selectedPeriodId);
  }, [selectedPeriodId]);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );
  const paginatedPeriods = useMemo(() => {
    const startIndex = (periodPage - 1) * PERIOD_PAGE_SIZE;
    return periods.slice(startIndex, startIndex + PERIOD_PAGE_SIZE);
  }, [periodPage, periods]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(periods.length / PERIOD_PAGE_SIZE));
    if (periodPage > totalPages) {
      setPeriodPage(totalPages);
    }
  }, [periodPage, periods.length]);

  const summary = useMemo(
    () => ({
      pdfReady: snapshots.filter((snapshot) => snapshot.pdfFilePath.trim()).length,
      whatsappSent: snapshots.filter((snapshot) => snapshot.whatsappStatus === "sent_manual").length,
      undelivered: snapshots.filter((snapshot) => snapshot.whatsappStatus !== "sent_manual").length,
      portalPublished: snapshots.filter((snapshot) => snapshot.portalPublishStatus === "published").length,
      portalFailed: snapshots.filter((snapshot) => snapshot.portalPublishStatus === "failed").length,
    }),
    [snapshots],
  );
  const canRegeneratePdf = canEdit
    && selectedPeriod !== null
    && snapshots.length > 0
    && !isLoadingSnapshots
    && !isRegeneratingPdf;
  const canPublishPortal = canEdit
    && selectedPeriod?.status === "pdf_ready"
    && snapshots.length > 0
    && summary.pdfReady === snapshots.length
    && !isLoadingSnapshots
    && !isPublishingPortal;

  async function refreshPeriods() {
    setIsLoadingPeriods(true);
    setErrorMessage(null);

    try {
      const nextPeriods = await listPayslipPeriods();
      setPeriods(nextPeriods);
      setPeriodPage(1);
      setSelectedPeriodId((current) => current ?? nextPeriods[0]?.id ?? null);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Periode slip gagal dibaca."));
    } finally {
      setIsLoadingPeriods(false);
    }
  }

  async function refreshSnapshots(periodId: string) {
    setIsLoadingSnapshots(true);
    setErrorMessage(null);

    try {
      setSnapshots(await listPayslipSnapshots(periodId));
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Daftar slip karyawan gagal dibaca."));
    } finally {
      setIsLoadingSnapshots(false);
    }
  }

  async function handleRegeneratePdf() {
    if (!selectedPeriod || !canRegeneratePdf) {
      return;
    }

    setIsRegeneratingPdf(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const regeneratedSnapshots = await generatePayslipPdfs(selectedPeriod.id, session);
      setSnapshots(regeneratedSnapshots);
      await refreshPeriods();
      setSelectedPeriodId(selectedPeriod.id);
      setSuccessMessage(
        `PDF ${selectedPeriod.label} dibuat ulang untuk ${regeneratedSnapshots.length} slip karyawan.`,
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "PDF slip gagal dibuat ulang."));
    } finally {
      setIsRegeneratingPdf(false);
    }
  }

  async function handlePublishPortal() {
    if (!selectedPeriod || !canPublishPortal) {
      return;
    }

    setIsPublishingPortal(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await publishFinalPayslipsToPortal(selectedPeriod.id, session);
      await refreshSnapshots(selectedPeriod.id);
      setSuccessMessage(
        `Publish portal selesai: ${result.publishedCount} berhasil, ${result.failedCount} gagal.`,
      );
      if (result.failedCount > 0) {
        const firstFailure = result.items.find((item) => item.status === "failed");
        setErrorMessage(firstFailure
          ? `Sebagian publish gagal. Contoh: ${firstFailure.employeeName} - ${firstFailure.errorMessage}`
          : "Sebagian publish gagal. Buka status Portal di tabel untuk detail.");
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Publish slip ke portal gagal."));
    } finally {
      setIsPublishingPortal(false);
    }
  }

  async function handleOpenPdf(path: string) {
    if (!path.trim()) {
      return;
    }

    try {
      await openPath(path);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "PDF slip gagal dibuka."));
    }
  }

  async function updateSnapshotStatus(
    snapshot: PayslipManagerSnapshot,
    status: PayslipManagerSnapshot["sendStatus"],
    successText: string,
  ) {
    setUpdatingSnapshotId(snapshot.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await updatePayslipSnapshotSendStatus(snapshot.id, status, session);
      setSnapshots((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(successText);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Status kirim slip gagal disimpan."));
    } finally {
      setUpdatingSnapshotId(null);
    }
  }

  async function revealPdfFile(path: string) {
    if (!path.trim()) {
      throw new Error("PDF slip belum tersedia.");
    }

    try {
      await revealItemInDir(path);
    } catch {
      const folderPath = directoryFromPath(path);
      if (!folderPath) {
        throw new Error("Folder PDF slip tidak ditemukan.");
      }

      await openPath(folderPath);
    }
  }

  async function handlePrepareWhatsAppSend(snapshot: PayslipManagerSnapshot) {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!snapshot.pdfFilePath.trim()) {
      setErrorMessage("PDF slip belum tersedia. Finalisasi payroll dulu untuk membuat slip PDF.");
      return;
    }

    if (!snapshot.whatsappNumber.trim()) {
      await updateSnapshotStatus(
        snapshot,
        "failed_missing_number",
        `Nomor WhatsApp ${snapshot.employeeName} masih kosong.`,
      );
      return;
    }

    try {
      const message = createPayslipWhatsAppMessage({
        employeeName: snapshot.employeeName,
        payrollPeriod: selectedPeriod?.label ?? "-",
        whatsappNumber: snapshot.whatsappNumber,
        pdfFileName: fileNameFromPath(snapshot.pdfFilePath),
      });
      await navigator.clipboard.writeText(message.message);
      await openUrl(message.waMeUrl);
      await revealPdfFile(snapshot.pdfFilePath);
      await updateSnapshotStatus(
        snapshot,
        "whatsapp_opened",
        `WhatsApp ${snapshot.employeeName} dibuka, pesan disalin, dan PDF ditampilkan di Explorer.`,
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Pengiriman WhatsApp gagal disiapkan."));
    }
  }

  async function handleCopyWhatsAppMessage(snapshot: PayslipManagerSnapshot) {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!snapshot.whatsappNumber.trim()) {
      await updateSnapshotStatus(
        snapshot,
        "failed_missing_number",
        `Nomor WhatsApp ${snapshot.employeeName} masih kosong.`,
      );
      return;
    }

    try {
      const message = createPayslipWhatsAppMessage({
        employeeName: snapshot.employeeName,
        payrollPeriod: selectedPeriod?.label ?? "-",
        whatsappNumber: snapshot.whatsappNumber,
        pdfFileName: fileNameFromPath(snapshot.pdfFilePath),
      });
      await navigator.clipboard.writeText(message.message);
      setSuccessMessage(`Pesan WhatsApp ${snapshot.employeeName} disalin.`);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Pesan WhatsApp gagal disalin."));
    }
  }

  return (
    <FeaturePanel
      aria-label="Periode slip dan daftar slip karyawan"
      badge={<StatusBadge>Periode aktif</StatusBadge>}
      title="Slip PDF"
    >
      <PanelBody>
        {!canEdit ? (
          <PanelNote>Role saat ini hanya bisa melihat periode dan daftar slip karyawan.</PanelNote>
        ) : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

        <div className="payslip-manager-content">
          <div className="min-w-0 overflow-hidden rounded-lg border bg-background p-4" aria-label="Daftar periode slip">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Periode Payroll Final</h3>
                <p className="mt-1 text-xs text-muted-foreground">Dibuat otomatis saat payroll difinalisasi.</p>
              </div>
              <Button disabled={isLoadingPeriods} onClick={() => void refreshPeriods()} size="sm" type="button" variant="outline">
                Refresh
              </Button>
            </div>
            {isLoadingPeriods ? <PanelNote>Membaca periode slip...</PanelNote> : null}
            {!isLoadingPeriods && periods.length === 0 ? (
              <PanelNote>Belum ada payroll final. Finalisasi payroll dulu untuk membuat slip PDF.</PanelNote>
            ) : null}
            <div className="grid gap-2">
              {paginatedPeriods.map((period) => {
                const isSelected = period.id === selectedPeriodId;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={[
                      "grid min-w-0 w-full gap-1 overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors",
                      "hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20"
                        : "border-border bg-card text-foreground",
                    ].join(" ")}
                    key={period.id}
                    onClick={() => setSelectedPeriodId(period.id)}
                    type="button"
                  >
                    <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <strong className="min-w-0 truncate text-sm font-semibold">
                        {formatDisplayDateText(period.label)}
                      </strong>
                      <StatusBadge>{PERIOD_STATUS_LABELS[period.status]}</StatusBadge>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDisplayDateRange(period.startDate, period.endDate)}
                    </span>
                  </button>
                );
              })}
            </div>
            {periods.length > PERIOD_PAGE_SIZE ? (
              <div className="mt-3">
                <PaginationControls
                  ariaLabel="Pagination periode slip"
                  currentPage={periodPage}
                  itemLabel="periode"
                  onPageChange={setPeriodPage}
                  pageSize={PERIOD_PAGE_SIZE}
                  totalItems={periods.length}
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 rounded-lg border bg-background p-4" aria-label="Daftar slip karyawan">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Daftar Slip Karyawan</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Data di sini berasal dari snapshot payroll final.
              </p>
            </div>
            <StatusBadge>{selectedPeriod?.label ?? "Pilih periode"}</StatusBadge>
          </div>

          <div className="payslip-status-summary">
            <span>Periode: <strong>{selectedPeriod?.label ?? "-"}</strong></span>
            <span>PDF siap: <strong>{summary.pdfReady}</strong></span>
            <span>WA terkirim: <strong>{summary.whatsappSent}</strong></span>
            <span>Belum terkirim WA: <strong>{summary.undelivered}</strong></span>
            <span>Portal: <strong>{summary.portalPublished}</strong></span>
            <span>Portal gagal: <strong>{summary.portalFailed}</strong></span>
            <Button
              disabled={!canRegeneratePdf}
              onClick={() => void handleRegeneratePdf()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isRegeneratingPdf ? "Membuat ulang..." : "Buat Ulang PDF Periode"}
            </Button>
            <Button
              disabled={!canPublishPortal}
              onClick={() => void handlePublishPortal()}
              size="sm"
              type="button"
              variant="secondary"
            >
              {isPublishingPortal ? "Publishing..." : "Publish ke Portal"}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-background">
            {isLoadingSnapshots ? <PanelNote>Membaca daftar slip karyawan...</PanelNote> : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Gaji Bersih</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>WA</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id} data-status={snapshot.sendStatus}>
                    <TableCell>
                      <strong className="block font-semibold">{snapshot.employeeName}</strong>
                      <span className="block text-muted-foreground">{snapshot.employeeNik || "-"} | {snapshot.employeePosition || "-"}</span>
                    </TableCell>
                    <TableCell>{snapshot.whatsappNumber ? maskWhatsAppNumber(snapshot.whatsappNumber) : "-"}</TableCell>
                    <TableCell>{formatRupiah(snapshot.netPay)}</TableCell>
                    <TableCell><FileNameCell path={snapshot.pdfFilePath} /></TableCell>
                    <TableCell>
                      <StatusBadge>{PORTAL_STATUS_LABELS[snapshot.portalPublishStatus]}</StatusBadge>
                      {snapshot.portalErrorMessage ? (
                        <span className="mt-1 block max-w-48 truncate text-xs text-destructive">
                          {snapshot.portalErrorMessage}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge>{WHATSAPP_STATUS_LABELS[snapshot.whatsappStatus]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={updatingSnapshotId === snapshot.id || !snapshot.pdfFilePath.trim()}
                          onClick={() => void handleOpenPdf(snapshot.pdfFilePath)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Buka PDF
                        </Button>
                        <Button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void handlePrepareWhatsAppSend(snapshot)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Buka WhatsApp
                        </Button>
                        <Button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void handleCopyWhatsAppMessage(snapshot)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Salin Pesan
                        </Button>
                        <Button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void updateSnapshotStatus(
                            snapshot,
                            "sent",
                            `WA ${snapshot.employeeName} ditandai terkirim manual.`,
                          )}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Terkirim
                        </Button>
                        <Button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void updateSnapshotStatus(
                            snapshot,
                            snapshot.whatsappNumber.trim() ? "failed" : "failed_missing_number",
                            snapshot.whatsappNumber.trim()
                              ? `WA ${snapshot.employeeName} ditandai gagal.`
                              : `Nomor WhatsApp ${snapshot.employeeName} masih kosong.`,
                          )}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          Gagal
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoadingSnapshots && selectedPeriod && snapshots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>Belum ada slip karyawan untuk periode ini. Finalisasi payroll dulu.</TableCell>
                  </TableRow>
                ) : null}
                {!isLoadingSnapshots && !selectedPeriod ? (
                  <TableRow>
                    <TableCell colSpan={7}>Pilih periode payroll final terlebih dahulu.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      </PanelBody>
    </FeaturePanel>
  );
}

function fileNameFromPath(path: string): string {
  if (!path.trim()) {
    return "-";
  }

  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || "-";
}

function directoryFromPath(path: string): string {
  if (!path.trim()) {
    return "";
  }

  const slashIndex = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return slashIndex > 0 ? path.slice(0, slashIndex) : "";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
