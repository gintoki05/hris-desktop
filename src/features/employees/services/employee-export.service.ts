import {
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SHIFT_TYPE_OPTIONS,
} from "../constants";
import type { Employee } from "../types";

export function exportEmployeeCsv(employees: Employee[]) {
  const csv = [
    [
      "Nama",
      "NIK",
      "WhatsApp",
      "Email",
      "Tanggal Masuk",
      "NPWP",
      "Status Kawin",
      "Tanggungan",
      "Departemen",
      "Jabatan",
      "Status",
      "Sistem Gaji",
      "Gaji Pokok Default",
      "Pembayaran",
      "PPh 21",
      "Tipe Shift",
      "Jam Kerja",
    ],
    ...employees.map((employee) => [
      employee.name,
      employee.nik,
      employee.whatsappNumber,
      employee.email,
      employee.hireDate,
      employee.npwp,
      labelFor(employee.maritalStatus, MARITAL_STATUS_OPTIONS),
      String(employee.dependents),
      employee.department,
      employee.position,
      labelFor(employee.status, EMPLOYEE_STATUS_OPTIONS),
      labelFor(employee.employmentType, EMPLOYMENT_TYPE_OPTIONS),
      String(employee.salaryAmount),
      labelFor(employee.paymentMethod, PAYMENT_METHOD_OPTIONS),
      employee.pph21Enabled ? "Aktif" : "Nonaktif",
      labelFor(employee.shiftType, SHIFT_TYPE_OPTIONS),
      employee.workSchedule,
    ]),
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-karyawan-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function labelFor<T extends string>(
  value: T,
  options: Array<{ value: T; label: string }>,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
