import { EMPLOYEE_STATUS_OPTIONS, EMPLOYMENT_TYPE_OPTIONS } from "../constants";
import { labelFor } from "../services/employee-export.service";
import type { Employee } from "../types";

type EmployeeTableProps = {
  employees: Employee[];
  isLoading: boolean;
  selectedEmployeeId: string | null;
  onSelect: (employee: Employee) => void;
};

export function EmployeeTable({
  employees,
  isLoading,
  onSelect,
  selectedEmployeeId,
}: EmployeeTableProps) {
  return (
    <div className="employee-table-wrap">
      {isLoading ? <p className="status-note">Membaca data karyawan lokal...</p> : null}
      <table className="employee-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>WhatsApp</th>
            <th>Email</th>
            <th>Departemen</th>
            <th>Jabatan</th>
            <th>Sistem</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr
              data-selected={employee.id === selectedEmployeeId}
              key={employee.id}
              onClick={() => onSelect(employee)}
            >
              <td>
                <strong>{employee.name}</strong>
                <span>{employee.nik}</span>
              </td>
              <td>{maskWhatsAppNumber(employee.whatsappNumber)}</td>
              <td>{maskEmail(employee.email)}</td>
              <td>{employee.department}</td>
              <td>{employee.position}</td>
              <td>{labelFor(employee.employmentType, EMPLOYMENT_TYPE_OPTIONS)}</td>
              <td>
                <span className="status-pill">
                  {labelFor(employee.status, EMPLOYEE_STATUS_OPTIONS)}
                </span>
              </td>
            </tr>
          ))}
          {!isLoading && employees.length === 0 ? (
            <tr>
              <td colSpan={7}>Belum ada data karyawan sesuai filter.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function maskEmail(value: string): string {
  const [localPart, domain] = value.split("@");

  if (!localPart || !domain) {
    return "-";
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function maskWhatsAppNumber(value: string): string {
  if (!value) {
    return "-";
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length <= 7) {
    return digits;
  }

  return `${digits.slice(0, 4)}${"*".repeat(Math.max(0, digits.length - 7))}${digits.slice(-3)}`;
}
