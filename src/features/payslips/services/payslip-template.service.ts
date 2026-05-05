import type { PayslipSnapshot } from "../types";

const incomeOrder = [
  "Gaji Pokok",
  "Tunjangan Kinerja",
  "Tunjangan Tidak Tetap",
  "Jasa Tindakan",
  "Uang Makan",
  "Lembur",
] as const;

const deductionOrder = [
  "Pajak PPh21",
  "BPJS Kesehatan",
  "BPJS TK",
  "Potongan Kasbon",
  "Potongan Absen",
  "Potongan Terlambat",
] as const;

export function validatePayslipSnapshot(snapshot: PayslipSnapshot): string[] {
  const missingFields: string[] = [];

  if (!snapshot.company.name) {
    missingFields.push("Nama perusahaan");
  }

  if (!snapshot.company.address) {
    missingFields.push("Alamat perusahaan");
  }

  if (!snapshot.company.treasurerName) {
    missingFields.push("Nama bendahara");
  }

  if (!snapshot.employee.nik) {
    missingFields.push("NIK karyawan");
  }

  if (!snapshot.amountInWords) {
    missingFields.push("Terbilang");
  }

  return missingFields;
}

export function createOfflinePayslipPrintHtml(snapshot: PayslipSnapshot): string {
  const missingFields = validatePayslipSnapshot(snapshot);

  if (missingFields.length > 0) {
    throw new Error(`Snapshot slip belum lengkap: ${missingFields.join(", ")}`);
  }

  const incomeRows = incomeOrder
    .map((name) => renderComponentRow(name, findAmount(snapshot.payroll.incomeComponents, name)))
    .join("");
  const deductionRows = deductionOrder
    .map((name) => renderComponentRow(name, findAmount(snapshot.payroll.deductionComponents, name)))
    .join("");

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Slip Gaji ${escapeHtml(snapshot.employee.name)}</title>
  <style>
    body { color: #111827; font-family: Arial, sans-serif; font-size: 12px; margin: 28px; }
    h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
    .company { text-align: center; margin-bottom: 18px; }
    .period { font-weight: 700; margin-top: 8px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #6b7280; padding: 6px 8px; }
    th { background: #eef2f7; text-align: left; }
    .amount { text-align: right; }
    .section { margin-top: 12px; }
    .net { font-size: 14px; font-weight: 700; }
    .signature { margin-top: 38px; text-align: right; }
  </style>
</head>
<body>
  <div class="company">
    <h1>${escapeHtml(snapshot.company.name)}</h1>
    <div>${escapeHtml(snapshot.company.address)}</div>
    <div class="period">Periode: ${escapeHtml(snapshot.payroll.period.label)}</div>
  </div>
  <table>
    <tr><th>NIK</th><td>${escapeHtml(snapshot.employee.nik)}</td><th>Nama</th><td>${escapeHtml(snapshot.employee.name)}</td></tr>
    <tr><th>Jabatan</th><td>${escapeHtml(snapshot.employee.position)}</td><th>NPWP</th><td>${escapeHtml(snapshot.employee.npwp ?? "-")}</td></tr>
  </table>
  <table class="section">
    <tr><th colspan="2">Pendapatan</th></tr>
    ${incomeRows}
    ${renderComponentRow("Jumlah Pendapatan", snapshot.payroll.grossPay)}
  </table>
  <table class="section">
    <tr><th colspan="2">Potongan</th></tr>
    ${deductionRows}
    ${renderComponentRow("Jumlah Potongan", snapshot.payroll.totalDeductions)}
  </table>
  <table class="section">
    <tr class="net"><td>Gaji Bersih</td><td class="amount">${formatPlainRupiah(snapshot.payroll.netPay)}</td></tr>
    <tr><td>Terbilang</td><td>${escapeHtml(snapshot.amountInWords)}</td></tr>
  </table>
  <div class="signature">
    <div>Bendahara</div>
    <br /><br /><br />
    <strong>${escapeHtml(snapshot.company.treasurerName)}</strong>
  </div>
</body>
</html>`;
}

function findAmount(components: { name: string; amount: number }[], name: string): number {
  return components.find((component) => component.name === name)?.amount ?? 0;
}

function renderComponentRow(name: string, amount: number): string {
  return `<tr><td>${escapeHtml(name)}</td><td class="amount">${formatPlainRupiah(amount)}</td></tr>`;
}

function formatPlainRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
