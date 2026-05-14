import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { AppNotice } from "../../../components/shared/AppNotice";
import {
  FeaturePanel,
  PanelBody,
  PanelNote,
  StatusBadge,
} from "../../../components/shared/FeaturePanel";
import { FileActionRow } from "../../../components/shared/FileActionRow";
import { FileNameCell } from "../../../components/shared/FileNameCell";
import { PaginationControls } from "../../../components/shared/PaginationControls";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
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
  createCurrentMonthPeriodDefaults,
  formatDisplayDateRange,
  formatDisplayDateText,
} from "../../../lib/formatters/date-time";
import type { AuthSession } from "../../auth/types";
import { listActiveEmployees } from "../../employees/services/employee.service";
import {
  exportPayslipImportTemplate,
  previewPayslipWorkbook,
  toPayslipImportSnapshots,
} from "../services/payslip-import.service";
import {
  exportPayslipTemplateFile,
  generatePayslipPdfs,
  listPayslipPeriods,
  listPayslipSnapshots,
  savePayslipImportBatch,
  savePayslipPeriod,
  sendPayslipManagerEmail,
  updatePayslipSnapshotSendStatus,
} from "../services/payslip-manager.service";
import {
  createPayslipWhatsAppMessage,
  maskWhatsAppNumber,
} from "../services/whatsapp-delivery.service";
import type {
  PayslipImportPreview,
  PayslipImportPreviewRow,
  PayslipManagerSnapshot,
  PayslipPeriod,
} from "../types";

type PayslipManagerPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

type SavedTemplateFile = {
  name: string;
  path: string;
};

type GeneratedPdfFolder = {
  path: string;
  count: number;
};

const PERIOD_STATUS_LABELS: Record<PayslipPeriod["status"], string> = {
  archived: "Diarsipkan",
  draft: "Draft",
  imported: "Data diimport",
  pdf_ready: "PDF siap",
};

const WHATSAPP_STATUS_LABELS: Record<PayslipManagerSnapshot["whatsappStatus"], string> = {
  failed: "Gagal",
  missing_number: "Nomor kosong",
  not_opened: "Belum",
  opened: "Dibuka",
  sent_manual: "Terkirim manual",
};

const EMAIL_STATUS_LABELS: Record<PayslipManagerSnapshot["emailStatus"], string> = {
  failed: "Gagal",
  missing_email: "Email kosong",
  not_sent: "Belum",
  sent: "Terkirim",
};

const PERIOD_PAGE_SIZE = 5;

export function PayslipManagerPanel({ canEdit, session }: PayslipManagerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialPeriod = useMemo(() => createCurrentMonthPeriodDefaults("Slip Gaji"), []);
  const [periods, setPeriods] = useState<PayslipPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PayslipManagerSnapshot[]>([]);
  const [preview, setPreview] = useState<PayslipImportPreview | null>(null);
  const [savedTemplate, setSavedTemplate] = useState<SavedTemplateFile | null>(null);
  const [generatedPdfFolder, setGeneratedPdfFolder] = useState<GeneratedPdfFolder | null>(null);
  const [periodLabel, setPeriodLabel] = useState(initialPeriod.label);
  const [startDate, setStartDate] = useState(initialPeriod.startDate);
  const [endDate, setEndDate] = useState(initialPeriod.endDate);
  const [periodPage, setPeriodPage] = useState(1);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);
  const [isExportingTemplate, setIsExportingTemplate] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isReadingImport, setIsReadingImport] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [updatingSnapshotId, setUpdatingSnapshotId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshPeriods();
  }, []);

  useEffect(() => {
    setPreview(null);
    setGeneratedPdfFolder(null);
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
      total: snapshots.length,
      pdfReady: snapshots.filter((snapshot) => snapshot.pdfFilePath.trim()).length,
      whatsappSent: snapshots.filter((snapshot) => snapshot.whatsappStatus === "sent_manual").length,
      emailSent: snapshots.filter((snapshot) => snapshot.emailStatus === "sent").length,
      undelivered: snapshots.filter(
        (snapshot) => snapshot.whatsappStatus !== "sent_manual" && snapshot.emailStatus !== "sent",
      ).length,
    }),
    [snapshots],
  );
  const importSummary = useMemo(() => summarizePreview(preview), [preview]);
  const canSaveImport = canEdit
    && selectedPeriod !== null
    && preview !== null
    && importSummary.saveable > 0
    && importSummary.error === 0
    && !isSavingImport;
  const canGeneratePdf = canEdit
    && selectedPeriod !== null
    && snapshots.length > 0
    && !isLoadingSnapshots
    && !isGeneratingPdf;

  async function refreshPeriods() {
    setIsLoadingPeriods(true);
    setErrorMessage(null);

    try {
      const nextPeriods = await listPayslipPeriods();
      setPeriods(nextPeriods);
      setPeriodPage(1);
      setSelectedPeriodId((current) => current ?? nextPeriods[0]?.id ?? null);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Periode slip gagal dibaca.");
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
      setErrorMessage(error instanceof Error ? error.message : "Daftar slip karyawan gagal dibaca.");
    } finally {
      setIsLoadingSnapshots(false);
    }
  }

  async function handleSavePeriod() {
    if (!canEdit || isSavingPeriod) {
      return;
    }

    setIsSavingPeriod(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const savedPeriod = await savePayslipPeriod(
        {
          label: periodLabel,
          startDate,
          endDate,
        },
        session,
      );
      const nextPeriods = await listPayslipPeriods();
      setPeriods(nextPeriods);
      setSelectedPeriodId(savedPeriod.id);
      setSuccessMessage(`Periode ${savedPeriod.label} siap untuk import data slip.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Periode slip gagal disimpan.");
    } finally {
      setIsSavingPeriod(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file || !selectedPeriod) {
      return;
    }

    setIsReadingImport(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const employees = await listActiveEmployees();
      const nextPreview = await previewPayslipWorkbook(file, employees, selectedPeriod);
      setPreview(nextPreview);
      if (nextPreview.rows.length === 0) {
        setErrorMessage("Workbook terbaca, tetapi tidak ada baris slip gaji yang bisa dipreview.");
      }
    } catch (error: unknown) {
      setPreview(null);
      setErrorMessage(error instanceof Error ? error.message : "File slip gagal dibaca.");
    } finally {
      setIsReadingImport(false);
    }
  }

  async function handleExportTemplate() {
    if (!selectedPeriod || isExportingTemplate) {
      return;
    }

    setIsExportingTemplate(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const employees = await listActiveEmployees();
      const template = exportPayslipImportTemplate(employees, selectedPeriod);
      const targetPath = await save({
        defaultPath: template.fileName,
        filters: [
          {
            extensions: ["xlsx"],
            name: "Excel workbook",
          },
        ],
      });

      if (!targetPath) {
        return;
      }

      const exportedPath = await exportPayslipTemplateFile(targetPath, template.bytes, session);
      const saved = {
        name: fileNameFromPath(exportedPath),
        path: exportedPath,
      };
      setSavedTemplate(saved);
      setSuccessMessage(
        `Template ${selectedPeriod.label} disimpan untuk ${employees.length} karyawan aktif: ${saved.name}.`,
      );
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Template slip gagal dibuat.");
    } finally {
      setIsExportingTemplate(false);
    }
  }

  async function handleOpenSavedTemplate() {
    if (!savedTemplate) {
      return;
    }

    try {
      await openPath(savedTemplate.path);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Template yang tersimpan gagal dibuka.");
    }
  }

  async function handleGeneratePdf() {
    if (!selectedPeriod || !canGeneratePdf) {
      return;
    }

    setIsGeneratingPdf(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const generatedSnapshots = await generatePayslipPdfs(selectedPeriod.id, session);
      setSnapshots(generatedSnapshots);
      const pdfPaths = generatedSnapshots
        .map((snapshot) => snapshot.pdfFilePath)
        .filter((path) => path.trim().length > 0);
      const folderPath = pdfPaths[0] ? directoryFromPath(pdfPaths[0]) : "";
      setGeneratedPdfFolder(folderPath ? { path: folderPath, count: pdfPaths.length } : null);
      await refreshPeriods();
      setSelectedPeriodId(selectedPeriod.id);
      setSuccessMessage(
        `PDF ${selectedPeriod.label} dibuat untuk ${pdfPaths.length} slip karyawan.`,
      );
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "PDF slip gagal dibuat.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  async function handleOpenPdf(path: string) {
    if (!path.trim()) {
      return;
    }

    try {
      await openPath(path);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "PDF slip gagal dibuka.");
    }
  }

  async function handleOpenPdfFolder() {
    if (!generatedPdfFolder?.path) {
      return;
    }

    try {
      await openPath(generatedPdfFolder.path);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Folder PDF gagal dibuka.");
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
      setErrorMessage(error instanceof Error ? error.message : "Status kirim slip gagal disimpan.");
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
      setErrorMessage("PDF slip belum dibuat. Generate PDF dulu sebelum menyiapkan WhatsApp.");
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
      setErrorMessage(error instanceof Error ? error.message : "Pengiriman WhatsApp gagal disiapkan.");
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
      setErrorMessage(error instanceof Error ? error.message : "Pesan WhatsApp gagal disalin.");
    }
  }

  async function handleSendEmail(snapshot: PayslipManagerSnapshot) {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!snapshot.pdfFilePath.trim()) {
      setErrorMessage("PDF slip belum dibuat. Generate PDF dulu sebelum kirim email.");
      return;
    }

    setUpdatingSnapshotId(snapshot.id);
    try {
      const updated = await sendPayslipManagerEmail(snapshot.id, session);
      setSnapshots((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(`Email slip ${snapshot.employeeName} terkirim dengan lampiran PDF.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Email slip gagal dikirim.");
      await refreshSnapshots(snapshot.periodId);
    } finally {
      setUpdatingSnapshotId(null);
    }
  }

  async function handleSaveImport() {
    if (!preview || !selectedPeriod || !canSaveImport) {
      return;
    }

    setIsSavingImport(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const snapshotsToSave = toPayslipImportSnapshots(preview);
      const batch = await savePayslipImportBatch(
        {
          periodId: selectedPeriod.id,
          sourceFileName: preview.sourceFileName,
          totalRows: preview.rows.length,
          validRows: snapshotsToSave.length,
          errorRows: importSummary.error,
          notes: importSummary.warning > 0
            ? "Import tersimpan dengan warning. Periksa nomor WhatsApp atau mapping pegawai."
            : "",
          snapshots: snapshotsToSave,
        },
        session,
      );
      setSuccessMessage(
        `Import ${batch.sourceFileName} tersimpan: ${batch.validRows} slip karyawan.`,
      );
      setPreview(null);
      await refreshPeriods();
      await refreshSnapshots(selectedPeriod.id);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Import slip gagal disimpan.");
    } finally {
      setIsSavingImport(false);
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

        <div className="grid gap-3 md:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto] md:items-end">
          <label>
            Label periode
            <Input
              disabled={!canEdit || isSavingPeriod}
              onChange={(event) => setPeriodLabel(event.target.value)}
              value={periodLabel}
            />
          </label>
          <label>
            Tanggal mulai
            <Input
              disabled={!canEdit || isSavingPeriod}
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label>
            Tanggal selesai
            <Input
              disabled={!canEdit || isSavingPeriod}
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
          <Button disabled={!canEdit || isSavingPeriod} onClick={handleSavePeriod} type="button">
            {isSavingPeriod ? "Menyimpan..." : "Simpan Periode"}
          </Button>
          <Button disabled={isLoadingPeriods} onClick={() => void refreshPeriods()} type="button" variant="outline">
            Refresh
          </Button>
        </div>

        <div className="payslip-manager-content">
          <div className="min-w-0 overflow-hidden rounded-lg border bg-background p-4" aria-label="Daftar periode slip">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Periode Slip</h3>
                <p className="mt-1 text-xs text-muted-foreground">Terbaru diurutkan paling atas.</p>
              </div>
              <span className="text-sm text-muted-foreground">{periods.length} periode</span>
            </div>
            {isLoadingPeriods ? <PanelNote>Membaca periode slip...</PanelNote> : null}
            {!isLoadingPeriods && periods.length === 0 ? (
              <PanelNote>Belum ada periode slip. Buat periode sebelum import Excel.</PanelNote>
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
                Data di sini hanya berasal dari periode slip yang dipilih.
              </p>
            </div>
            <StatusBadge>{selectedPeriod?.label ?? "Pilih periode"}</StatusBadge>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="attendance-import-file-field">
              <span className="attendance-import-label">File Excel Slip Gaji</span>
              <Input
                accept=".xls,.xlsx,.xlsm"
                className="attendance-import-file-input"
                disabled={!canEdit || !selectedPeriod || isReadingImport || isSavingImport}
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />
              <div className="attendance-import-file-control">
                <Button
                  disabled={!canEdit || !selectedPeriod || isReadingImport || isSavingImport}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  variant="outline"
                >
                  {isReadingImport ? "Membaca..." : "Pilih File"}
                </Button>
                <span data-empty={!preview}>{preview?.sourceFileName ?? "Belum ada file dipilih"}</span>
              </div>
            </div>
            <Button
              disabled={!canEdit || !selectedPeriod || isExportingTemplate}
              onClick={handleExportTemplate}
              type="button"
              variant="outline"
            >
              {isExportingTemplate ? "Membuat..." : "Download Template"}
            </Button>
            <Button disabled={!canSaveImport} onClick={handleSaveImport} type="button">
              {isSavingImport ? "Menyimpan..." : "Simpan Import"}
            </Button>
            <Button disabled={!canGeneratePdf} onClick={handleGeneratePdf} type="button">
              {isGeneratingPdf ? "Membuat PDF..." : "Generate PDF"}
            </Button>
          </div>

          {preview ? (
            <div className="attendance-import-content">
              <div className="attendance-import-summary">
                <span>File: {preview.sourceFileName}</span>
                <span>Sheet: {preview.sheetName}</span>
                <strong>
                  {importSummary.valid} valid, {importSummary.warning} warning, {importSummary.error} error
                </strong>
              </div>

              {importSummary.error > 0 ? (
                <PanelNote tone="warning">
                  Perbaiki file import dulu. Slip karyawan belum bisa disimpan selama masih ada baris error.
                </PanelNote>
              ) : null}

              <div className="overflow-x-auto rounded-lg border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Row</TableHead>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Pendapatan</TableHead>
                      <TableHead>Potongan</TableHead>
                      <TableHead>Gaji Bersih</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow data-status={row.status} key={`${row.rowNumber}-${row.employeeName}`}>
                        <TableCell>{formatPreviewStatus(row.status)}</TableCell>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          <strong className="block font-semibold">{row.employeeName}</strong>
                          <span className="block text-muted-foreground">{row.employeeNik || "-"} | {row.employeePosition || "-"}</span>
                        </TableCell>
                        <TableCell>{row.matchedEmployeeName || "-"}</TableCell>
                        <TableCell>{row.whatsappNumber || "-"}</TableCell>
                        <TableCell>{formatRupiah(row.grossPay)}</TableCell>
                        <TableCell>{formatRupiah(row.totalDeductions)}</TableCell>
                        <TableCell>{formatRupiah(row.netPay)}</TableCell>
                        <TableCell>{row.errorMessage || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {savedTemplate ? (
            <FileActionRow
              actionLabel="Buka File"
              label="Template terakhir"
              onAction={handleOpenSavedTemplate}
              value={savedTemplate.name}
            />
          ) : null}

          {generatedPdfFolder ? (
            <FileActionRow
              actionLabel="Buka Folder"
              label="Folder PDF terakhir"
              onAction={handleOpenPdfFolder}
              value={`${generatedPdfFolder.count} file`}
            />
          ) : null}

          <div className="payslip-status-summary">
            <span>Periode: <strong>{selectedPeriod?.label ?? "-"}</strong></span>
            <span>PDF siap: <strong>{summary.pdfReady}</strong></span>
            <span>WA terkirim: <strong>{summary.whatsappSent}</strong></span>
            <span>Email terkirim: <strong>{summary.emailSent}</strong></span>
            <span>Belum terkirim via jalur apa pun: <strong>{summary.undelivered}</strong></span>
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
                  <TableHead>WA</TableHead>
                  <TableHead>Email</TableHead>
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
                      <StatusBadge>{WHATSAPP_STATUS_LABELS[snapshot.whatsappStatus]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge>{EMAIL_STATUS_LABELS[snapshot.emailStatus]}</StatusBadge>
                      {snapshot.emailErrorMessage ? (
                        <span className="delivery-error-note">{snapshot.emailErrorMessage}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={updatingSnapshotId === snapshot.id || !snapshot.pdfFilePath.trim()}
                          onClick={() => void handleSendEmail(snapshot)}
                          size="sm"
                          type="button"
                        >
                          Kirim Email
                        </Button>
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
                          Siapkan Kirim
                        </Button>
                        <Button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void handleCopyWhatsAppMessage(snapshot)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Salin
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
                    <TableCell colSpan={7}>Belum ada slip karyawan. Langkah berikutnya adalah import Excel data slip.</TableCell>
                  </TableRow>
                ) : null}
                {!isLoadingSnapshots && !selectedPeriod ? (
                  <TableRow>
                    <TableCell colSpan={7}>Pilih atau buat periode slip terlebih dahulu.</TableCell>
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

function summarizePreview(preview: PayslipImportPreview | null) {
  const rows = preview?.rows ?? [];
  const valid = rows.filter((row) => row.status === "valid").length;
  const warning = rows.filter((row) => row.status === "warning").length;
  const error = rows.filter((row) => row.status === "error").length;

  return {
    valid,
    warning,
    error,
    saveable: valid + warning,
  };
}

function formatPreviewStatus(status: PayslipImportPreviewRow["status"]): string {
  if (status === "warning") {
    return "Warning";
  }

  return status === "valid" ? "Valid" : "Error";
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
