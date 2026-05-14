import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import {
  FeaturePanel,
  PanelBody,
  PanelNote,
  StatusBadge,
} from "../../../components/shared/FeaturePanel";
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
import type { AuthSession } from "../../auth/types";
import { listActiveEmployees } from "../../employees/services/employee.service";
import {
  previewFingerprintWorkbook,
  saveAttendanceImportBatch,
} from "../services/attendance-import.service";
import { formatDisplayDate, formatDisplayDateRange } from "../../../lib/formatters/date-time";
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
    <FeaturePanel
      aria-label="Import absensi fingerprint"
      badge={<StatusBadge>{canEdit ? "Admin bisa import" : "Readonly"}</StatusBadge>}
      title="Import Absensi Fingerprint"
    >
      <PanelBody>
        <div className="flex flex-wrap items-end gap-3">
          <div className="attendance-import-file-field">
            <span className="attendance-import-label">File Excel Fingerprint</span>
            <Input
              accept=".xls,.xlsx,.xlsm"
              className="attendance-import-file-input"
              disabled={fileInputDisabled}
              ref={fileInputRef}
              onChange={handleFileChange}
              type="file"
            />
            <div className="attendance-import-file-control">
              <Button
                disabled={fileInputDisabled}
                onClick={() => fileInputRef.current?.click()}
                type="button"
                variant="outline"
              >
                {isReading ? "Membaca..." : "Pilih File"}
              </Button>
              <span data-empty={!preview}>{selectedFileName}</span>
            </div>
          </div>
          <Button disabled={!canSave} onClick={handleSave} type="button">
            {isSaving ? "Menyimpan..." : "Simpan Import"}
          </Button>
        </div>

        {!canEdit ? <PanelNote>Role saat ini hanya bisa melihat preview absensi.</PanelNote> : null}
        {isReading ? <PanelNote>Membaca workbook lokal...</PanelNote> : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

        {preview ? (
          <div className="attendance-import-content">
            <div className="attendance-import-summary">
              <span>File: {preview.sourceFileName}</span>
              <span>Sheet: {preview.sheetName}</span>
              <span>
                Periode: {formatDisplayDateRange(preview.periodStart, preview.periodEnd)}
              </span>
              <strong>
                {summary.valid} valid, {summary.unknown} unknown, {summary.error} error
              </strong>
            </div>

            {summary.invalid > 0 ? (
              <PanelNote tone="warning">
                Perbaiki master karyawan atau file import dulu. Batch belum bisa disimpan selama masih ada baris error.
              </PanelNote>
            ) : null}

            <div className="overflow-x-auto rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama File</TableHead>
                    <TableHead>Karyawan Match</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Pulang</TableHead>
                    <TableHead>Raw</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, index) => (
                    <TableRow data-status={row.status} key={`${row.rowNumber}-${row.workDate}-${index}`}>
                      <TableCell>{formatStatus(row.status)}</TableCell>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{formatDisplayDate(row.workDate)}</TableCell>
                      <TableCell>{row.employeeName}</TableCell>
                      <TableCell>{row.matchedEmployeeName || "-"}</TableCell>
                      <TableCell>{row.clockIn ?? "-"}</TableCell>
                      <TableCell>{row.clockOut ?? "-"}</TableCell>
                      <TableCell>{row.rawValue}</TableCell>
                      <TableCell>{row.errorMessage || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </PanelBody>
    </FeaturePanel>
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
