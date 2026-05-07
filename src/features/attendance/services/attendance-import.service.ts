import * as XLSX from "xlsx";
import type { Employee } from "../../employees/types";
import { tauriAttendanceImportRepository } from "../repositories/tauri-attendance-import.repository";
import type { AttendanceImportRepository } from "../repositories/attendance-import.repository";
import type {
  AttendanceImportActor,
  AttendanceImportBatch,
  AttendanceImportPreview,
  AttendanceImportPreviewRow,
  AttendanceImportSaveInput,
} from "../types";

type HeaderDate = {
  columnIndex: number;
  workDate: string;
};

type WorkbookPeriod = {
  startDate: string;
  endDate: string;
};

export function createAttendanceImportService(repository: AttendanceImportRepository) {
  return {
    async previewFingerprintWorkbook(
      file: File,
      employees: Employee[],
    ): Promise<AttendanceImportPreview> {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { cellDates: true, type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Workbook tidak memiliki sheet yang bisa dibaca.");
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        blankrows: false,
        defval: "",
        header: 1,
        raw: true,
      });
      const period = findWorkbookPeriod(rows);
      const header = findDateHeader(rows, period);
      if (!header) {
        throw new Error("Header tanggal absensi tidak ditemukan di workbook.");
      }

      return {
        sourceFileName: file.name,
        sheetName,
        periodStart: period?.startDate ?? header.dates[0]?.workDate ?? null,
        periodEnd: period?.endDate ?? header.dates[header.dates.length - 1]?.workDate ?? null,
        rows: buildPreviewRows(rows, header.rowIndex, header.dates, employees),
      };
    },

    saveImportBatch(
      input: AttendanceImportSaveInput,
      actor: AttendanceImportActor,
    ): Promise<AttendanceImportBatch> {
      return repository.saveImportBatch(input, actor);
    },
  };
}

const attendanceImportService = createAttendanceImportService(tauriAttendanceImportRepository);

export const previewFingerprintWorkbook = attendanceImportService.previewFingerprintWorkbook;
export const saveAttendanceImportBatch = attendanceImportService.saveImportBatch;

function buildPreviewRows(
  rows: unknown[][],
  headerRowIndex: number,
  headerDates: HeaderDate[],
  employees: Employee[],
): AttendanceImportPreviewRow[] {
  const employeeLookup = createEmployeeLookup(employees);
  const previewRows: AttendanceImportPreviewRow[] = [];
  const seen = new Set<string>();
  const firstDateColumn = Math.min(...headerDates.map((date) => date.columnIndex));

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const identity = readEmployeeIdentity(row, firstDateColumn);
    const employeeName = identity.name;
    if (!looksLikeEmployeeRow(employeeName, row, headerDates)) {
      continue;
    }

    const matchedEmployee = matchEmployee(identity, employeeLookup);
    for (const date of headerDates) {
      const rawValue = normalizeText(row[date.columnIndex]);
      const times = extractTimes(rawValue);
      if (rawValue === "" && times.length === 0) {
        continue;
      }

      const clockIn = times[0] ?? null;
      const clockOut = times.length > 1 ? times[times.length - 1] : null;
      const duplicateKey = `${matchedEmployee?.id ?? employeeName}-${date.workDate}`;
      const problems: string[] = [];

      if (!matchedEmployee) {
        problems.push("Karyawan tidak ditemukan atau tidak aktif.");
      }
      if (!clockIn) {
        problems.push("Jam masuk tidak terbaca.");
      }
      if (seen.has(duplicateKey)) {
        problems.push("Duplikat karyawan/tanggal dalam file.");
      }

      seen.add(duplicateKey);
      previewRows.push({
        rowNumber: rowIndex + 1,
        employeeId: matchedEmployee?.id ?? null,
        employeeNik: identity.nik || matchedEmployee?.nik || "",
        employeeName,
        matchedEmployeeName: matchedEmployee?.name ?? "",
        workDate: date.workDate,
        clockIn,
        clockOut,
        rawValue,
        status: !matchedEmployee
          ? "unknown_employee"
          : problems.length > 0
            ? "error"
            : "valid",
        errorMessage: problems.join(" "),
      });
    }
  }

  return previewRows.sort((a, b) => (
    a.workDate.localeCompare(b.workDate)
    || a.employeeName.localeCompare(b.employeeName)
    || a.rowNumber - b.rowNumber
  ));
}

function findDateHeader(
  rows: unknown[][],
  period: WorkbookPeriod | null,
): { rowIndex: number; dates: HeaderDate[] } | null {
  let best: { rowIndex: number; dates: HeaderDate[] } | null = null;

  rows.forEach((row, rowIndex) => {
    const dates = row
      .map((cell, columnIndex) => {
        const workDate = parseDateCell(cell, period);
        return workDate ? { columnIndex, workDate } : null;
      })
      .filter((value): value is HeaderDate => value !== null);

    if (dates.length >= 3 && (!best || dates.length > best.dates.length)) {
      best = { rowIndex, dates };
    }
  });

  return best;
}

function findWorkbookPeriod(rows: unknown[][]): WorkbookPeriod | null {
  const text = rows.map((row) => row.map(normalizeText).join(" ")).join(" ");
  const match = text.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4}).{0,24}?(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) {
    return null;
  }

  return {
    startDate: toIsoDate(Number(match[3]), Number(match[2]), Number(match[1])),
    endDate: toIsoDate(Number(match[6]), Number(match[5]), Number(match[4])),
  };
}

function parseDateCell(cell: unknown, period: WorkbookPeriod | null): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return formatDate(cell);
  }

  if (typeof cell === "number" && cell > 20000 && cell < 60000) {
    const parsed = XLSX.SSF.parse_date_code(cell);
    return parsed ? toIsoDate(parsed.y, parsed.m, parsed.d) : null;
  }

  const text = normalizeText(cell);
  const fullDate = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (fullDate) {
    const year = Number(fullDate[3].length === 2 ? `20${fullDate[3]}` : fullDate[3]);
    return toIsoDate(year, Number(fullDate[2]), Number(fullDate[1]));
  }

  const dayMonth = text.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (!dayMonth || !period) {
    return null;
  }

  const day = Number(dayMonth[1]);
  const month = Number(dayMonth[2]);
  const startYear = Number(period.startDate.slice(0, 4));
  const endYear = Number(period.endDate.slice(0, 4));
  const startMonth = Number(period.startDate.slice(5, 7));
  const year = startYear !== endYear && month < startMonth ? endYear : startYear;
  return toIsoDate(year, month, day);
}

function extractTimes(value: string): string[] {
  return Array.from(value.matchAll(/\b([01]?\d|2[0-3])[:. ]([0-5]\d)\b/g))
    .map((match) => `${match[1].padStart(2, "0")}:${match[2]}`);
}

function looksLikeEmployeeRow(
  employeeName: string,
  row: unknown[],
  headerDates: HeaderDate[],
): boolean {
  if (employeeName === "" || employeeName.toLowerCase().includes("permata medika")) {
    return false;
  }

  return headerDates.some((date) => extractTimes(normalizeText(row[date.columnIndex])).length > 0);
}

function readEmployeeIdentity(row: unknown[], firstDateColumn: number): { nik: string; name: string } {
  const identityCells = row.slice(0, firstDateColumn).map(normalizeText).filter(Boolean);
  if (identityCells.length >= 2) {
    return {
      nik: identityCells[0],
      name: identityCells[1],
    };
  }

  const value = identityCells[0] ?? "";
  return {
    nik: looksLikeNik(value) ? value : "",
    name: value,
  };
}

function createEmployeeLookup(employees: Employee[]) {
  return {
    byNik: new Map(employees.map((employee) => [normalizeKey(employee.nik), employee])),
    byName: new Map(employees.map((employee) => [normalizeKey(employee.name), employee])),
  };
}

function matchEmployee(
  identity: { nik: string; name: string },
  lookup: ReturnType<typeof createEmployeeLookup>,
): Employee | null {
  const nikKey = normalizeKey(identity.nik);
  const nameKey = normalizeKey(identity.name);
  return lookup.byNik.get(nikKey) ?? lookup.byName.get(nameKey) ?? null;
}

function looksLikeNik(value: string): boolean {
  return /^[A-Za-z0-9.-]{3,}$/.test(value) && /\d/.test(value);
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatDate(value: Date): string {
  return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

function toIsoDate(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}
