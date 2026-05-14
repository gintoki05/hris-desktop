import { PanelNote, StatusBadge } from "../../../components/shared/FeaturePanel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { EMPLOYEE_STATUS_OPTIONS, EMPLOYMENT_TYPE_OPTIONS } from "../constants";
import { formatRupiah } from "../../../lib/formatters/currency";
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
    <div className="overflow-x-auto rounded-lg border border-border">
      {isLoading ? <PanelNote>Membaca data karyawan lokal...</PanelNote> : null}
      <Table className="w-full caption-bottom text-sm">
        <TableHeader className="border-b bg-muted/50">
          <TableRow className="border-b transition-colors">
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Nama</TableHead>
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">WhatsApp</TableHead>
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Email</TableHead>
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Departemen</TableHead>
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Jabatan</TableHead>
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Sistem</TableHead>
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Gaji Pokok</TableHead>
            <TableHead className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow
              className="cursor-pointer border-b transition-colors hover:bg-muted/50 data-[selected=true]:bg-muted"
              data-selected={employee.id === selectedEmployeeId}
              key={employee.id}
              onClick={() => onSelect(employee)}
            >
              <TableCell className="p-3 align-middle">
                <strong>{employee.name}</strong>
                <span>{employee.nik}</span>
              </TableCell>
              <TableCell className="p-3 align-middle">{maskWhatsAppNumber(employee.whatsappNumber)}</TableCell>
              <TableCell className="p-3 align-middle">{maskEmail(employee.email)}</TableCell>
              <TableCell className="p-3 align-middle">{employee.department}</TableCell>
              <TableCell className="p-3 align-middle">{employee.position}</TableCell>
              <TableCell className="p-3 align-middle">{labelFor(employee.employmentType, EMPLOYMENT_TYPE_OPTIONS)}</TableCell>
              <TableCell className="p-3 align-middle">{formatRupiah(employee.salaryAmount)}</TableCell>
              <TableCell className="p-3 align-middle">
                <StatusBadge>{labelFor(employee.status, EMPLOYEE_STATUS_OPTIONS)}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && employees.length === 0 ? (
            <TableRow>
              <TableCell className="p-6 text-center text-muted-foreground" colSpan={8}>
                Belum ada data karyawan sesuai filter.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
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
