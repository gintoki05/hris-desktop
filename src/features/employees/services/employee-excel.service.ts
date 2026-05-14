import * as XLSX from "xlsx";
import {
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  FOLLOW_MONTHLY_SCHEDULE_LABEL,
  MARITAL_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SHIFT_TYPE_OPTIONS,
} from "../constants";
import type { EmployeeInput } from "../types";

export type EmployeeImportPreviewRow = {
  rowNumber: number;
  nik: string;
  name: string;
  status: "valid" | "error";
  action: "create" | "update";
  input: EmployeeInput | null;
  errorMessage: string;
};

export type EmployeeImportPreview = {
  sourceFileName: string;
  sheetName: string;
  rows: EmployeeImportPreviewRow[];
};

type ExistingEmployeeLookup = {
  hasNik: (nik: string) => boolean;
};

const EMPLOYEE_TEMPLATE_HEADERS = [
  "NIK",
  "Nama",
  "Nomor WhatsApp",
  "Email",
  "Tanggal Mulai Kerja",
  "NPWP",
  "Status Kawin",
  "Tanggungan",
  "Departemen",
  "Jabatan",
  "Status Karyawan",
  "Sistem Gaji",
  "Gaji Pokok Default",
  "Pembayaran Gaji",
  "PPh 21 Aktif",
  "Tipe Shift",
  "Jam Kerja Default",
] as const;

const REQUIRED_HEADERS = [
  "NIK",
  "Nama",
  "Tanggal Mulai Kerja",
  "Departemen",
  "Jabatan",
  "Jam Kerja Default",
] as const;

export function exportEmployeeImportTemplate() {
  const workbook = XLSX.utils.book_new();
  const templateRows = [
    [...EMPLOYEE_TEMPLATE_HEADERS],
    [
      "KRY001",
      "Contoh Karyawan",
      "081234567890",
      "pegawai@email.com",
      "2026-01-01",
      "09.123.456.7-123.000",
      "Belum kawin",
      0,
      "Klinik",
      "Perawat",
      "Aktif",
      "Bulanan",
      3000000,
      "Tunai",
      "Ya",
      "Non-shift",
      FOLLOW_MONTHLY_SCHEDULE_LABEL,
    ],
  ];

  const templateSheet = XLSX.utils.aoa_to_sheet(templateRows);
  templateSheet["!cols"] = EMPLOYEE_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(header.length + 4, 18) }));
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template Karyawan");

  const valuesSheet = XLSX.utils.aoa_to_sheet([
    ["Kolom", "Nilai yang diterima"],
    ["Status Kawin", MARITAL_STATUS_OPTIONS.map((option) => option.label).join(", ")],
    ["Status Karyawan", EMPLOYEE_STATUS_OPTIONS.map((option) => option.label).join(", ")],
    ["Sistem Gaji", EMPLOYMENT_TYPE_OPTIONS.map((option) => option.label).join(", ")],
    ["Pembayaran Gaji", PAYMENT_METHOD_OPTIONS.map((option) => option.label).join(", ")],
    ["PPh 21 Aktif", "Ya, Tidak"],
    ["Tipe Shift", SHIFT_TYPE_OPTIONS.map((option) => option.label).join(", ")],
    ["Jam Kerja Default", `Isi nama jadwal aktif atau "${FOLLOW_MONTHLY_SCHEDULE_LABEL}".`],
  ]);
  valuesSheet["!cols"] = [{ wch: 24 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, valuesSheet, "Panduan Nilai");

  const bytes = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  downloadWorkbook(bytes, `template-import-karyawan-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function previewEmployeeImportWorkbook(
  file: File,
  existingLookup: ExistingEmployeeLookup,
): Promise<EmployeeImportPreview> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { cellDates: true, type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook tidak memiliki sheet yang bisa dibaca.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    blankrows: false,
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error("Sheet import karyawan kosong.");
  }

  const headers = Object.keys(rows[0] ?? {}).map(normalizeHeader);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(normalizeHeader(header)));
  if (missingHeaders.length > 0) {
    throw new Error(`Kolom wajib belum ada: ${missingHeaders.join(", ")}.`);
  }

  const seenNik = new Set<string>();
  return {
    sourceFileName: file.name,
    sheetName,
    rows: rows.map((row, index) => parseEmployeeRow(row, index + 2, existingLookup, seenNik)),
  };
}

export function labelFor<T extends string>(
  value: T,
  options: Array<{ value: T; label: string }>,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function parseEmployeeRow(
  row: Record<string, unknown>,
  rowNumber: number,
  existingLookup: ExistingEmployeeLookup,
  seenNik: Set<string>,
): EmployeeImportPreviewRow {
  const get = createRowReader(row);
  const nik = normalizeText(get("NIK"));
  const name = normalizeText(get("Nama"));
  const problems: string[] = [];

  const input: EmployeeInput = {
    nik,
    whatsappNumber: normalizeText(get("Nomor WhatsApp")),
    email: normalizeText(get("Email")),
    name,
    hireDate: readDate(get("Tanggal Mulai Kerja")),
    npwp: normalizeText(get("NPWP")),
    maritalStatus: readOption(get("Status Kawin"), MARITAL_STATUS_OPTIONS, "single"),
    dependents: readInteger(get("Tanggungan"), 0),
    department: normalizeText(get("Departemen")),
    position: normalizeText(get("Jabatan")),
    status: readOption(get("Status Karyawan"), EMPLOYEE_STATUS_OPTIONS, "active"),
    employmentType: readOption(get("Sistem Gaji"), EMPLOYMENT_TYPE_OPTIONS, "monthly"),
    salaryAmount: readNumber(get("Gaji Pokok Default"), 0),
    paymentMethod: readOption(get("Pembayaran Gaji"), PAYMENT_METHOD_OPTIONS, "cash"),
    pph21Enabled: readBoolean(get("PPh 21 Aktif"), true),
    shiftType: readOption(get("Tipe Shift"), SHIFT_TYPE_OPTIONS, "non_shift"),
    workSchedule: normalizeText(get("Jam Kerja Default")) || FOLLOW_MONTHLY_SCHEDULE_LABEL,
  };

  REQUIRED_HEADERS.forEach((header) => {
    if (normalizeText(get(header)) === "") {
      problems.push(`${header} wajib diisi.`);
    }
  });
  validateOptionCell("Status Kawin", get("Status Kawin"), MARITAL_STATUS_OPTIONS, problems);
  validateOptionCell("Status Karyawan", get("Status Karyawan"), EMPLOYEE_STATUS_OPTIONS, problems);
  validateOptionCell("Sistem Gaji", get("Sistem Gaji"), EMPLOYMENT_TYPE_OPTIONS, problems);
  validateOptionCell("Pembayaran Gaji", get("Pembayaran Gaji"), PAYMENT_METHOD_OPTIONS, problems);
  validateOptionCell("Tipe Shift", get("Tipe Shift"), SHIFT_TYPE_OPTIONS, problems);
  validateBooleanCell("PPh 21 Aktif", get("PPh 21 Aktif"), problems);

  if (seenNik.has(normalizeKey(nik))) {
    problems.push("NIK duplikat di file import.");
  }
  seenNik.add(normalizeKey(nik));

  if (!isIsoDate(input.hireDate)) {
    problems.push("Tanggal Mulai Kerja harus format YYYY-MM-DD atau tanggal Excel valid.");
  }
  if (!isValidOptionalEmail(input.email)) {
    problems.push("Email tidak valid.");
  }
  if (input.dependents < 0 || input.dependents > 10) {
    problems.push("Tanggungan harus 0 sampai 10.");
  }
  if (input.salaryAmount < 0) {
    problems.push("Gaji Pokok Default tidak boleh negatif.");
  }

  return {
    rowNumber,
    nik,
    name,
    status: problems.length > 0 ? "error" : "valid",
    action: existingLookup.hasNik(nik) ? "update" : "create",
    input: problems.length > 0 ? null : input,
    errorMessage: problems.join(" "),
  };
}

function createRowReader(row: Record<string, unknown>) {
  const normalizedEntries = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
  );

  return (header: (typeof EMPLOYEE_TEMPLATE_HEADERS)[number]) => normalizedEntries.get(normalizeHeader(header));
}

function readOption<T extends string>(
  value: unknown,
  options: Array<{ value: T; label: string }>,
  fallback: T,
): T {
  const key = normalizeKey(normalizeText(value));
  if (key === "") {
    return fallback;
  }

  return options.find((option) => normalizeKey(option.label) === key || normalizeKey(option.value) === key)?.value ?? fallback;
}

function validateOptionCell<T extends string>(
  header: string,
  value: unknown,
  options: Array<{ value: T; label: string }>,
  problems: string[],
) {
  const key = normalizeKey(normalizeText(value));
  if (key === "") {
    return;
  }

  const isKnown = options.some((option) => normalizeKey(option.label) === key || normalizeKey(option.value) === key);
  if (!isKnown) {
    problems.push(`${header} tidak valid.`);
  }
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  const key = normalizeKey(normalizeText(value));
  if (key === "") {
    return fallback;
  }

  if (["ya", "yes", "true", "aktif", "1"].includes(key)) {
    return true;
  }
  if (["tidak", "no", "false", "nonaktif", "0"].includes(key)) {
    return false;
  }

  return fallback;
}

function validateBooleanCell(header: string, value: unknown, problems: string[]) {
  const key = normalizeKey(normalizeText(value));
  if (key === "") {
    return;
  }

  if (!["ya", "yes", "true", "aktif", "1", "tidak", "no", "false", "nonaktif", "0"].includes(key)) {
    problems.push(`${header} harus Ya atau Tidak.`);
  }
}

function readDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && value > 20000 && value < 60000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? toIsoDate(parsed.y, parsed.m, parsed.d) : "";
  }

  const text = normalizeText(value);
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return text;
  }

  const localDate = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (localDate) {
    return toIsoDate(Number(localDate[3]), Number(localDate[2]), Number(localDate[1]));
  }

  return text;
}

function readInteger(value: unknown, fallback: number): number {
  return Math.trunc(readNumber(value, fallback));
}

function readNumber(value: unknown, fallback: number): number {
  const normalized = normalizeNumberText(value);
  if (normalized === "") {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNumberText(value: unknown): string {
  const text = normalizeText(value).replace(/[^\d,.-]/g, "");
  if (text.includes(",")) {
    return text.replace(/\./g, "").replace(",", ".");
  }

  const dotCount = (text.match(/\./g) ?? []).length;
  if (dotCount > 1 || /\.\d{3}$/.test(text)) {
    return text.replace(/\./g, "");
  }

  return text;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string): string {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(match[1])
    && date.getMonth() + 1 === Number(match[2])
    && date.getDate() === Number(match[3]);
}

function isValidOptionalEmail(value: string): boolean {
  if (value.trim() === "") {
    return true;
  }

  const parts = value.split("@");
  return value.includes("@") && (parts[parts.length - 1]?.includes(".") ?? false);
}

function toIsoDate(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function downloadWorkbook(bytes: ArrayBuffer, fileName: string) {
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
