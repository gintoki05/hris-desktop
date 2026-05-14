import * as XLSX from "xlsx";
import type { Employee } from "../../employees/types";
import type {
  PayslipImportPreview,
  PayslipImportPreviewRow,
  PayslipImportSnapshotInput,
  PayslipPeriod,
} from "../types";

type HeaderMap = Partial<Record<ImportColumn, number>>;

type ImportColumn =
  | "nik"
  | "name"
  | "position"
  | "whatsappNumber"
  | "amountInWords"
  | IncomeColumn
  | DeductionColumn
  | "grossPay"
  | "totalDeductions"
  | "netPay";

type IncomeColumn =
  | "baseSalary"
  | "performanceAllowance"
  | "variableAllowance"
  | "medicalService"
  | "mealAllowance"
  | "overtime";

type DeductionColumn =
  | "pph21"
  | "bpjsHealth"
  | "bpjsEmployment"
  | "cashAdvance"
  | "absenceDeduction"
  | "lateDeduction";

const INCOME_COLUMNS: Array<{ key: IncomeColumn; label: string }> = [
  { key: "baseSalary", label: "Gaji Pokok" },
  { key: "performanceAllowance", label: "Tunjangan Kinerja" },
  { key: "variableAllowance", label: "Tunjangan Tidak Tetap" },
  { key: "medicalService", label: "Jasa Tindakan" },
  { key: "mealAllowance", label: "Uang Makan" },
  { key: "overtime", label: "Lembur" },
];

const DEDUCTION_COLUMNS: Array<{ key: DeductionColumn; label: string }> = [
  { key: "pph21", label: "Pajak PPh21" },
  { key: "bpjsHealth", label: "BPJS Kesehatan" },
  { key: "bpjsEmployment", label: "BPJS TK" },
  { key: "cashAdvance", label: "Potongan Kasbon" },
  { key: "absenceDeduction", label: "Potongan Absen" },
  { key: "lateDeduction", label: "Potongan Terlambat" },
];

const TEMPLATE_HEADERS = [
  "NIK",
  "Nama",
  "Jabatan",
  "WhatsApp",
  ...INCOME_COLUMNS.map((column) => column.label),
  "Jumlah Pendapatan",
  ...DEDUCTION_COLUMNS.map((column) => column.label),
  "Jumlah Potongan",
  "Gaji Bersih",
  "Terbilang",
] as const;

const HEADER_ALIASES: Record<ImportColumn, string[]> = {
  absenceDeduction: ["potongan absen", "pot absen", "absen"],
  amountInWords: ["terbilang", "amount in words"],
  baseSalary: ["gaji pokok", "gapok", "gaji"],
  bpjsEmployment: ["bpjs tk", "bpjs ketenagakerjaan", "bpjs tenaga kerja"],
  bpjsHealth: ["bpjs kesehatan", "bpjs kes"],
  cashAdvance: ["potongan kasbon", "kasbon", "pot kasbon"],
  grossPay: ["jumlah pendapatan", "total pendapatan", "pendapatan"],
  lateDeduction: ["potongan terlambat", "potongan telat", "telat", "terlambat"],
  mealAllowance: ["uang makan", "makan"],
  medicalService: ["jasa tindakan", "jasa medis", "tindakan"],
  name: ["nama", "nama pegawai", "nama karyawan", "karyawan"],
  netPay: ["gaji bersih", "take home pay", "thp", "net pay"],
  nik: ["nik", "id karyawan", "kode karyawan", "nip"],
  overtime: ["lembur", "overtime"],
  performanceAllowance: ["tunjangan kinerja", "tukin"],
  position: ["jabatan", "posisi"],
  pph21: ["pajak pph21", "pph21", "pph 21", "pajak"],
  totalDeductions: ["jumlah potongan", "total potongan", "potongan"],
  variableAllowance: ["tunjangan tidak tetap", "tunjangan tdk tetap", "tunjangan lainnya"],
  whatsappNumber: ["whatsapp", "no whatsapp", "nomor whatsapp", "wa", "no wa", "hp"],
};

export async function previewPayslipWorkbook(
  file: File,
  employees: Employee[],
  period: PayslipPeriod,
): Promise<PayslipImportPreview> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { cellDates: true, type: "array" });
  if (workbook.SheetNames.length === 0) {
    throw new Error("Workbook tidak memiliki sheet yang bisa dibaca.");
  }

  const candidate = findBestSheet(workbook);
  if (!candidate) {
    throw new Error(
      "Header slip tidak ditemukan. Pastikan ada kolom Nama/NIK dan minimal salah satu kolom nominal seperti Gaji Bersih, Gaji Pokok, atau Jumlah Pendapatan.",
    );
  }

  return {
    sourceFileName: file.name,
    sheetName: candidate.sheetName,
    rows: buildPreviewRows(candidate.rows, candidate.header.rowIndex, candidate.header.map, employees, period),
  };
}

export function toPayslipImportSnapshots(
  preview: PayslipImportPreview,
): PayslipImportSnapshotInput[] {
  return preview.rows
    .filter((row) => row.status !== "error")
    .map((row) => ({
      employeeId: row.employeeId ?? undefined,
      employeeNik: row.employeeNik,
      employeeName: row.employeeName,
      employeePosition: row.employeePosition,
      whatsappNumber: row.whatsappNumber,
      netPay: row.netPay,
      snapshotJson: row.snapshotJson,
    }));
}

export function exportPayslipImportTemplate(
  employees: Employee[],
  period: PayslipPeriod,
): { bytes: number[]; fileName: string } {
  const rows = employees.map((employee) => ({
    NIK: employee.nik,
    Nama: employee.name,
    Jabatan: employee.position,
    WhatsApp: employee.whatsappNumber,
    "Gaji Pokok": "",
    "Tunjangan Kinerja": "",
    "Tunjangan Tidak Tetap": "",
    "Jasa Tindakan": "",
    "Uang Makan": "",
    Lembur: "",
    "Jumlah Pendapatan": "",
    "Pajak PPh21": "",
    "BPJS Kesehatan": "",
    "BPJS TK": "",
    "Potongan Kasbon": "",
    "Potongan Absen": "",
    "Potongan Terlambat": "",
    "Jumlah Potongan": "",
    "Gaji Bersih": "",
    Terbilang: "",
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...TEMPLATE_HEADERS],
  });
  const columnWidths = TEMPLATE_HEADERS.map((header) => ({
    wch: Math.max(header.length + 2, header === "Terbilang" ? 34 : 16),
  }));
  worksheet["!cols"] = columnWidths;
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: `Template Import ${period.label}`,
    Subject: "Template import data slip gaji",
    Author: "HRIS Payroll",
  };
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template Slip");
  const bytes = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  return {
    bytes: Array.from(new Uint8Array(bytes)),
    fileName: `${sanitizeFileName(period.label)}-template-slip.xlsx`,
  };
}

function buildPreviewRows(
  rows: unknown[][],
  headerRowIndex: number,
  headerMap: HeaderMap,
  employees: Employee[],
  period: PayslipPeriod,
): PayslipImportPreviewRow[] {
  const lookup = createEmployeeLookup(employees);
  const previewRows: PayslipImportPreviewRow[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const rawName = readText(row, headerMap.name);
    const rawNik = readText(row, headerMap.nik);
    if (!rawName && !rawNik) {
      continue;
    }

    const matchedEmployee = matchEmployee({ name: rawName, nik: rawNik }, lookup);
    const employeeName = rawName || matchedEmployee?.name || "";
    const employeeNik = rawNik || matchedEmployee?.nik || "";
    const employeePosition = readText(row, headerMap.position) || matchedEmployee?.position || "";
    const whatsappNumber = normalizeWhatsAppNumber(
      readText(row, headerMap.whatsappNumber) || matchedEmployee?.whatsappNumber || "",
    );
    const incomeComponents = INCOME_COLUMNS.map(({ key, label }) => ({
      name: label,
      amount: readAmount(row, headerMap[key]),
    }));
    const deductionComponents = DEDUCTION_COLUMNS.map(({ key, label }) => ({
      name: label,
      amount: readAmount(row, headerMap[key]),
    }));
    const computedGrossPay = sumAmounts(incomeComponents);
    const computedDeductions = sumAmounts(deductionComponents);
    const grossPay = readOptionalAmount(row, headerMap.grossPay) ?? computedGrossPay;
    const totalDeductions = readOptionalAmount(row, headerMap.totalDeductions) ?? computedDeductions;
    const netPay = readOptionalAmount(row, headerMap.netPay) ?? grossPay - totalDeductions;
    const amountInWords = readText(row, headerMap.amountInWords);
    const problems: string[] = [];

    if (!employeeName) {
      problems.push("Nama pegawai wajib diisi.");
    }
    if (!employeeNik) {
      problems.push("NIK pegawai wajib diisi.");
    }
    if (!employeePosition) {
      problems.push("Jabatan pegawai wajib diisi.");
    }
    if (hasNegativeAmount(incomeComponents)) {
      problems.push("Komponen pendapatan tidak boleh negatif.");
    }
    if (hasNegativeAmount(deductionComponents)) {
      problems.push("Komponen potongan tidak boleh negatif.");
    }
    if (grossPay !== computedGrossPay) {
      problems.push("Jumlah pendapatan tidak sama dengan total komponen pendapatan.");
    }
    if (totalDeductions !== computedDeductions) {
      problems.push("Jumlah potongan tidak sama dengan total komponen potongan.");
    }
    if (netPay !== grossPay - totalDeductions) {
      problems.push("Gaji bersih tidak sama dengan pendapatan dikurangi potongan.");
    }
    if (netPay < 0) {
      problems.push("Gaji bersih tidak boleh negatif.");
    }
    if (!amountInWords) {
      problems.push("Terbilang wajib diisi untuk slip PDF.");
    }

    const warnings: string[] = [];
    if (!matchedEmployee) {
      warnings.push("Pegawai belum cocok dengan master.");
    }
    if (!whatsappNumber) {
      warnings.push("Nomor WhatsApp kosong.");
    }

    const status = problems.length > 0 ? "error" : warnings.length > 0 ? "warning" : "valid";
    const snapshotJson = JSON.stringify({
      employee: {
        id: matchedEmployee?.id ?? "",
        nik: employeeNik,
        name: employeeName,
        position: employeePosition,
        npwp: matchedEmployee?.npwp ?? "",
        whatsappNumber,
        email: matchedEmployee?.email ?? "",
      },
      payroll: {
        period: {
          id: period.id,
          label: period.label,
          startDate: period.startDate,
          endDate: period.endDate,
        },
        incomeComponents,
        deductionComponents,
        grossPay,
        totalDeductions,
        netPay,
      },
      amountInWords,
      source: {
        rowNumber: rowIndex + 1,
      },
    });

    previewRows.push({
      rowNumber: rowIndex + 1,
      employeeId: matchedEmployee?.id ?? null,
      employeeNik,
      employeeName,
      employeePosition,
      whatsappNumber,
      matchedEmployeeName: matchedEmployee?.name ?? "",
      incomeComponents,
      deductionComponents,
      grossPay,
      totalDeductions,
      netPay,
      amountInWords,
      snapshotJson,
      status,
      errorMessage: [...problems, ...warnings].join(" "),
    });
  }

  return previewRows;
}

function findBestSheet(
  workbook: XLSX.WorkBook,
): { sheetName: string; rows: unknown[][]; header: { rowIndex: number; map: HeaderMap } } | null {
  let best: {
    sheetName: string;
    rows: unknown[][];
    header: { rowIndex: number; map: HeaderMap; score: number };
  } | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      blankrows: false,
      defval: "",
      header: 1,
      raw: true,
    });
    const header = findHeader(rows);
    if (header && (!best || header.score > best.header.score)) {
      best = {
        sheetName,
        rows,
        header,
      };
    }
  }

  return best ? {
    sheetName: best.sheetName,
    rows: best.rows,
    header: {
      rowIndex: best.header.rowIndex,
      map: best.header.map,
    },
  } : null;
}

function findHeader(rows: unknown[][]): { rowIndex: number; map: HeaderMap; score: number } | null {
  let best: { rowIndex: number; map: HeaderMap; score: number } | null = null;

  rows.forEach((row, rowIndex) => {
    const map = createHeaderMap(row);
    const hasEmployeeIdentity = map.name !== undefined || map.nik !== undefined;
    const incomeCount = INCOME_COLUMNS.filter(({ key }) => map[key] !== undefined).length;
    const deductionCount = DEDUCTION_COLUMNS.filter(({ key }) => map[key] !== undefined).length;
    const score = Number(map.name !== undefined) * 3
      + Number(map.nik !== undefined) * 2
      + Number(map.netPay !== undefined) * 3
      + Number(map.grossPay !== undefined) * 2
      + Number(map.totalDeductions !== undefined) * 2
      + Number(map.nik !== undefined)
      + Number(map.whatsappNumber !== undefined)
      + incomeCount
      + deductionCount;

    if (hasEmployeeIdentity && score >= 4 && (!best || score > best.score)) {
      best = { rowIndex, map, score };
    }
  });

  return best;
}

function createHeaderMap(row: unknown[]): HeaderMap {
  const map: HeaderMap = {};
  row.forEach((cell, columnIndex) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) {
      return;
    }

    for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[ImportColumn, string[]]>) {
      if (map[key] === undefined && aliases.some((alias) => headerMatches(normalized, alias))) {
        map[key] = columnIndex;
      }
    }
  });

  return map;
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
  return lookup.byNik.get(normalizeKey(identity.nik))
    ?? lookup.byName.get(normalizeKey(identity.name))
    ?? null;
}

function readText(row: unknown[], columnIndex: number | undefined): string {
  if (columnIndex === undefined) {
    return "";
  }

  return normalizeText(row[columnIndex]);
}

function readAmount(row: unknown[], columnIndex: number | undefined): number {
  return readOptionalAmount(row, columnIndex) ?? 0;
}

function readOptionalAmount(row: unknown[], columnIndex: number | undefined): number | null {
  if (columnIndex === undefined) {
    return null;
  }

  const value = row[columnIndex];
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const negative = text.includes("(") && text.includes(")");
  const normalized = text
    .replace(/rp/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[()]/g, "");
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(negative ? -parsed : parsed);
}

function sumAmounts(components: Array<{ amount: number }>): number {
  return components.reduce((total, component) => total + component.amount, 0);
}

function hasNegativeAmount(components: Array<{ amount: number }>): boolean {
  return components.some((component) => component.amount < 0);
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function headerMatches(normalizedHeader: string, alias: string): boolean {
  const normalizedAlias = normalizeHeader(alias);
  return normalizedHeader === normalizedAlias
    || normalizedHeader.includes(normalizedAlias)
    || normalizedAlias.includes(normalizedHeader);
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeWhatsAppNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  return digits;
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "payslip";
}
