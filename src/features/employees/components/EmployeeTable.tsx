import { formatRupiah } from "../../../lib/formatters/currency";
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
            <th>Departemen</th>
            <th>Jabatan</th>
            <th>Sistem</th>
            <th>Status</th>
            <th>Gaji</th>
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
              <td>{employee.department}</td>
              <td>{employee.position}</td>
              <td>{labelFor(employee.employmentType, EMPLOYMENT_TYPE_OPTIONS)}</td>
              <td>
                <span className="status-pill">
                  {labelFor(employee.status, EMPLOYEE_STATUS_OPTIONS)}
                </span>
              </td>
              <td>{formatRupiah(employee.salaryAmount)}</td>
            </tr>
          ))}
          {!isLoading && employees.length === 0 ? (
            <tr>
              <td colSpan={6}>Belum ada data karyawan sesuai filter.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
