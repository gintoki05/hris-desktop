import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import type { AuthSession } from "../../auth/types";
import { listActiveEmployees } from "../../employees/services/employee.service";
import {
  previewFingerprintWorkbook,
  saveAttendanceImportBatch,
} from "../services/attendance-import.service";
import type {
  AttendanceImportActor,
  AttendanceImportPreview,
  AttendanceImportPreviewRow,
} from "../types";

type AttendanceImportPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

export function AttendanceImportPanel({ canEdit, session }: AttendanceImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<AttendanceImportPreview | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const summary = useMemo(() => summarizePreview(preview), [preview]);
  const canSave = canEdit && preview !== null && summary.valid > 0 && summary.invalid === 0 && !isSaving;
  const selectedFileName = preview?.sourceFileName ?? "Belum ada file dipilih";
  const fileInputDisabled = !canEdit || isReading || isSaving;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }

    setIsReading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const employees = await listActiveEmployees();
      const nextPreview = await previewFingerprintWorkbook(file, employees);
      setPreview(nextPreview);
      if (nextPreview.rows.length === 0) {
        setErrorMessage("Workbook terbaca, tetapi tidak ada baris jam absensi yang bisa dipreview.");
      }
    } catch (error: unknown) {
      setPreview(null);
      setErrorMessage(getErrorMessage(error, "File absensi gagal dibaca."));
    } finally {
      setIsReading(false);
    }
  }

  async function handleSave() {
    if (!preview || !canSave) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const batch = await saveAttendanceImportBatch(
        {
          sourceFileName: preview.sourceFileName,
          sheetName: preview.sheetName,
          rows: preview.rows,
        },
        toActor(session),
      );
      setSuccessMessage(
        `Import tersimpan: ${batch.totalRows} baris dari ${batch.sourceFileName}.`,
      );
      setPreview(null);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Import absensi gagal disimpan."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel" aria-label="Import absensi fingerprint">
      <div className="panel-header">
        <h2>Import Absensi Fingerprint</h2>
        <span className="status-pill">{canEdit ? "Admin bisa import" : "Readonly"}</span>
      </div>

      <div className="attendance-import-toolbar">
        <div className="attendance-import-file-field">
          <span className="attendance-import-label">File Excel Fingerprint</span>
          <input
            accept=".xls,.xlsx,.xlsm"
            className="attendance-import-file-input"
            disabled={fileInputDisabled}
            ref={fileInputRef}
            onChange={handleFileChange}
            type="file"
          />
          <div className="attendance-import-file-control">
            <button
              disabled={fileInputDisabled}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {isReading ? "Membaca..." : "Pilih File"}
            </button>
            <span data-empty={!preview}>{selectedFileName}</span>
          </div>
        </div>
        <button disabled={!canSave} onClick={handleSave} type="button">
          {isSaving ? "Menyimpan..." : "Simpan Import"}
        </button>
      </div>

      {!canEdit ? (
        <p className="readonly-note">Role saat ini hanya bisa melihat preview absensi.</p>
      ) : null}
      {isReading ? <p className="status-note">Membaca workbook lokal...</p> : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      {preview ? (
        <div className="attendance-import-content">
          <div className="attendance-import-summary">
            <span>File: {preview.sourceFileName}</span>
            <span>Sheet: {preview.sheetName}</span>
            <span>
              Periode: {preview.periodStart ?? "-"} s.d. {preview.periodEnd ?? "-"}
            </span>
            <strong>
              {summary.valid} valid, {summary.unknown} unknown, {summary.error} error
            </strong>
          </div>

          {summary.invalid > 0 ? (
            <p className="readonly-note">
              Perbaiki master karyawan atau file import dulu. Batch belum bisa disimpan selama masih ada baris error.
            </p>
          ) : null}

          <div className="attendance-import-table-wrap">
            <table className="attendance-import-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Row</th>
                  <th>Tanggal</th>
                  <th>Nama File</th>
                  <th>Karyawan Match</th>
                  <th>Masuk</th>
                  <th>Pulang</th>
                  <th>Raw</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr data-status={row.status} key={`${row.rowNumber}-${row.workDate}-${index}`}>
                    <td>{formatStatus(row.status)}</td>
                    <td>{row.rowNumber}</td>
                    <td>{row.workDate}</td>
                    <td>{row.employeeName}</td>
                    <td>{row.matchedEmployeeName || "-"}</td>
                    <td>{row.clockIn ?? "-"}</td>
                    <td>{row.clockOut ?? "-"}</td>
                    <td>{row.rawValue}</td>
                    <td>{row.errorMessage || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function summarizePreview(preview: AttendanceImportPreview | null) {
  const rows = preview?.rows ?? [];
  const valid = rows.filter((row) => row.status === "valid").length;
  const unknown = rows.filter((row) => row.status === "unknown_employee").length;
  const error = rows.filter((row) => row.status === "error").length;

  return {
    valid,
    unknown,
    error,
    invalid: unknown + error,
  };
}

function toActor(session: AuthSession): AttendanceImportActor {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}

function formatStatus(status: AttendanceImportPreviewRow["status"]): string {
  if (status === "unknown_employee") {
    return "Unknown";
  }

  return status === "valid" ? "Valid" : "Error";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }

  return fallback;
}
