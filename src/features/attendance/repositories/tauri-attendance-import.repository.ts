import { invoke } from "@tauri-apps/api/core";
import type { AttendanceImportRepository } from "./attendance-import.repository";
import type {
  AttendanceImportActor,
  AttendanceImportBatch,
  AttendanceImportPreviewRow,
  AttendanceImportSaveInput,
} from "../types";

type AttendanceImportRowDto = {
  source_row_number: number;
  employee_id: string | null;
  employee_nik: string;
  employee_name: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  raw_payload_json: string;
  status: AttendanceImportPreviewRow["status"];
  error_message: string;
};

type AttendanceImportInputDto = {
  source_file_name: string;
  sheet_name: string;
  rows: AttendanceImportRowDto[];
  actor: {
    user_id: string;
    display_name: string;
    role: string;
  };
};

type AttendanceImportBatchDto = {
  id: string;
  source_file_name: string;
  imported_at: string;
  imported_by: string;
  total_rows: number;
};

export const tauriAttendanceImportRepository: AttendanceImportRepository = {
  async saveImportBatch(input, actor) {
    ensureTauriRuntime();
    const dto = await invoke<AttendanceImportBatchDto>("save_attendance_import_batch", {
      input: toInputDto(input, actor),
    });
    return toBatch(dto);
  },
};

function toInputDto(
  input: AttendanceImportSaveInput,
  actor: AttendanceImportActor,
): AttendanceImportInputDto {
  return {
    source_file_name: input.sourceFileName,
    sheet_name: input.sheetName,
    rows: input.rows.map((row) => ({
      source_row_number: row.rowNumber,
      employee_id: row.employeeId,
      employee_nik: row.employeeNik,
      employee_name: row.employeeName,
      work_date: row.workDate,
      clock_in: row.clockIn,
      clock_out: row.clockOut,
      raw_payload_json: JSON.stringify({
        matchedEmployeeName: row.matchedEmployeeName,
        rawValue: row.rawValue,
        sheetName: input.sheetName,
      }),
      status: row.status,
      error_message: row.errorMessage,
    })),
    actor: {
      user_id: actor.userId,
      display_name: actor.displayName,
      role: actor.role,
    },
  };
}

function toBatch(dto: AttendanceImportBatchDto): AttendanceImportBatch {
  return {
    id: dto.id,
    sourceFileName: dto.source_file_name,
    importedAt: dto.imported_at,
    importedBy: dto.imported_by,
    totalRows: dto.total_rows,
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Import absensi hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  }
}
