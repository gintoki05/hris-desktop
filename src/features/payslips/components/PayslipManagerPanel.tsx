import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FileActionRow } from "../../../components/shared/FileActionRow";
import { FileNameCell } from "../../../components/shared/FileNameCell";
import { formatRupiah } from "../../../lib/formatters/currency";
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

export function PayslipManagerPanel({ canEdit, session }: PayslipManagerPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [periods, setPeriods] = useState<PayslipPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PayslipManagerSnapshot[]>([]);
  const [preview, setPreview] = useState<PayslipImportPreview | null>(null);
  const [savedTemplate, setSavedTemplate] = useState<SavedTemplateFile | null>(null);
  const [generatedPdfFolder, setGeneratedPdfFolder] = useState<GeneratedPdfFolder | null>(null);
  const [periodLabel, setPeriodLabel] = useState(defaultPeriodLabel());
  const [startDate, setStartDate] = useState(defaultPeriodStart());
  const [endDate, setEndDate] = useState(defaultPeriodEnd());
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
      setErrorMessage(error instanceof Error ? error.message : "Snapshot slip gagal dibaca.");
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
        `PDF ${selectedPeriod.label} dibuat untuk ${pdfPaths.length} snapshot slip.`,
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
        `Import ${batch.sourceFileName} tersimpan: ${batch.validRows} snapshot slip.`,
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
    <section className="panel" aria-label="Payslip Manager">
      <div className="panel-header">
        <h2>Payslip Manager</h2>
        <span className="status-pill">Import Excel berikutnya</span>
      </div>

      {!canEdit ? (
        <p className="readonly-note">Role saat ini hanya bisa melihat periode dan snapshot slip.</p>
      ) : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      <div className="payslip-manager-toolbar">
        <label>
          Label periode
          <input
            disabled={!canEdit || isSavingPeriod}
            onChange={(event) => setPeriodLabel(event.target.value)}
            value={periodLabel}
          />
        </label>
        <label>
          Tanggal mulai
          <input
            disabled={!canEdit || isSavingPeriod}
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </label>
        <label>
          Tanggal selesai
          <input
            disabled={!canEdit || isSavingPeriod}
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </label>
        <button disabled={!canEdit || isSavingPeriod} onClick={handleSavePeriod} type="button">
          {isSavingPeriod ? "Menyimpan..." : "Simpan Periode"}
        </button>
        <button disabled={isLoadingPeriods} onClick={() => void refreshPeriods()} type="button">
          Refresh
        </button>
      </div>

      <div className="payslip-manager-content">
        <div className="payslip-period-list" aria-label="Daftar periode slip">
          <div className="master-section-header">
            <h3>Periode Slip</h3>
            <span>{periods.length} periode</span>
          </div>
          {isLoadingPeriods ? <p className="status-note">Membaca periode slip...</p> : null}
          {!isLoadingPeriods && periods.length === 0 ? (
            <p className="empty-panel-note">Belum ada periode slip. Buat periode sebelum import Excel.</p>
          ) : null}
          {periods.map((period) => (
            <button
              className="payslip-period-item"
              data-active={period.id === selectedPeriodId}
              key={period.id}
              onClick={() => setSelectedPeriodId(period.id)}
              type="button"
            >
              <strong>{period.label}</strong>
              <span>{period.startDate} s.d. {period.endDate}</span>
              <em>{PERIOD_STATUS_LABELS[period.status]}</em>
            </button>
          ))}
        </div>

        <div className="payslip-snapshot-panel">
          <div className="payslip-import-toolbar">
            <div className="attendance-import-file-field">
              <span className="attendance-import-label">File Excel Slip Gaji</span>
              <input
                accept=".xls,.xlsx,.xlsm"
                className="attendance-import-file-input"
                disabled={!canEdit || !selectedPeriod || isReadingImport || isSavingImport}
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />
              <div className="attendance-import-file-control">
                <button
                  disabled={!canEdit || !selectedPeriod || isReadingImport || isSavingImport}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {isReadingImport ? "Membaca..." : "Pilih File"}
                </button>
                <span data-empty={!preview}>{preview?.sourceFileName ?? "Belum ada file dipilih"}</span>
              </div>
            </div>
            <button
              disabled={!canEdit || !selectedPeriod || isExportingTemplate}
              onClick={handleExportTemplate}
              type="button"
            >
              {isExportingTemplate ? "Membuat..." : "Download Template"}
            </button>
            <button disabled={!canSaveImport} onClick={handleSaveImport} type="button">
              {isSavingImport ? "Menyimpan..." : "Simpan Import"}
            </button>
            <button disabled={!canGeneratePdf} onClick={handleGeneratePdf} type="button">
              {isGeneratingPdf ? "Membuat PDF..." : "Generate PDF"}
            </button>
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
                <p className="readonly-note">
                  Perbaiki file import dulu. Snapshot belum bisa disimpan selama masih ada baris error.
                </p>
              ) : null}

              <div className="attendance-import-table-wrap">
                <table className="attendance-import-table payslip-import-preview-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Row</th>
                      <th>Karyawan</th>
                      <th>Match</th>
                      <th>WhatsApp</th>
                      <th>Pendapatan</th>
                      <th>Potongan</th>
                      <th>Gaji Bersih</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr data-status={row.status} key={`${row.rowNumber}-${row.employeeName}`}>
                        <td>{formatPreviewStatus(row.status)}</td>
                        <td>{row.rowNumber}</td>
                        <td>
                          <strong>{row.employeeName}</strong>
                          <span>{row.employeeNik || "-"} | {row.employeePosition || "-"}</span>
                        </td>
                        <td>{row.matchedEmployeeName || "-"}</td>
                        <td>{row.whatsappNumber || "-"}</td>
                        <td>{formatRupiah(row.grossPay)}</td>
                        <td>{formatRupiah(row.totalDeductions)}</td>
                        <td>{formatRupiah(row.netPay)}</td>
                        <td>{row.errorMessage || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

          <div className="payslip-queue-summary">
            <span>Periode: <strong>{selectedPeriod?.label ?? "-"}</strong></span>
            <span>PDF siap: <strong>{summary.pdfReady}</strong></span>
            <span>WA terkirim: <strong>{summary.whatsappSent}</strong></span>
            <span>Email terkirim: <strong>{summary.emailSent}</strong></span>
            <span>Belum terkirim via jalur apa pun: <strong>{summary.undelivered}</strong></span>
          </div>

          <div className="payslip-queue-table-wrap">
            {isLoadingSnapshots ? <p className="status-note">Membaca snapshot slip...</p> : null}
            <table className="payslip-queue-table payslip-manager-table">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>WhatsApp</th>
                  <th>Gaji Bersih</th>
                  <th>PDF</th>
                  <th>WA</th>
                  <th>Email</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} data-status={snapshot.sendStatus}>
                    <td>
                      <strong>{snapshot.employeeName}</strong>
                      <span>{snapshot.employeeNik || "-"} | {snapshot.employeePosition || "-"}</span>
                    </td>
                    <td>{snapshot.whatsappNumber ? maskWhatsAppNumber(snapshot.whatsappNumber) : "-"}</td>
                    <td>{formatRupiah(snapshot.netPay)}</td>
                    <td><FileNameCell path={snapshot.pdfFilePath} /></td>
                    <td>
                      <span className="status-pill">{WHATSAPP_STATUS_LABELS[snapshot.whatsappStatus]}</span>
                    </td>
                    <td>
                      <span className="status-pill">{EMAIL_STATUS_LABELS[snapshot.emailStatus]}</span>
                      {snapshot.emailErrorMessage ? (
                        <span className="delivery-error-note">{snapshot.emailErrorMessage}</span>
                      ) : null}
                    </td>
                    <td>
                      <div className="payslip-queue-actions">
                        <button
                          disabled={updatingSnapshotId === snapshot.id || !snapshot.pdfFilePath.trim()}
                          onClick={() => void handleSendEmail(snapshot)}
                          type="button"
                        >
                          Kirim Email
                        </button>
                        <button
                          disabled={updatingSnapshotId === snapshot.id || !snapshot.pdfFilePath.trim()}
                          onClick={() => void handleOpenPdf(snapshot.pdfFilePath)}
                          type="button"
                        >
                          Buka PDF
                        </button>
                        <button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void handlePrepareWhatsAppSend(snapshot)}
                          type="button"
                        >
                          Siapkan Kirim
                        </button>
                        <button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void handleCopyWhatsAppMessage(snapshot)}
                          type="button"
                        >
                          Salin
                        </button>
                        <button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void updateSnapshotStatus(
                            snapshot,
                            "sent",
                            `WA ${snapshot.employeeName} ditandai terkirim manual.`,
                          )}
                          type="button"
                        >
                          Terkirim
                        </button>
                        <button
                          disabled={updatingSnapshotId === snapshot.id || snapshot.sendStatus === "not_generated"}
                          onClick={() => void updateSnapshotStatus(
                            snapshot,
                            snapshot.whatsappNumber.trim() ? "failed" : "failed_missing_number",
                            snapshot.whatsappNumber.trim()
                              ? `WA ${snapshot.employeeName} ditandai gagal.`
                              : `Nomor WhatsApp ${snapshot.employeeName} masih kosong.`,
                          )}
                          type="button"
                        >
                          Gagal
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoadingSnapshots && selectedPeriod && snapshots.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Belum ada snapshot. Langkah berikutnya adalah import Excel data slip.</td>
                  </tr>
                ) : null}
                {!isLoadingSnapshots && !selectedPeriod ? (
                  <tr>
                    <td colSpan={7}>Pilih atau buat periode slip terlebih dahulu.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
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

function defaultPeriodLabel(): string {
  const now = new Date();
  return `Slip Gaji ${now.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })}`;
}

function defaultPeriodStart(): string {
  const now = new Date();
  return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function defaultPeriodEnd(): string {
  const now = new Date();
  return formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
