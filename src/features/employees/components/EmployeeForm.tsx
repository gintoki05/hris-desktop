import { formatLocalDateTimeFromUtc } from "../../../lib/formatters/date-time";
import { FormattedAmountInput } from "../../../components/shared/FormattedAmountInput";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import type { WorkShift } from "../../attendance/types";
import type { OrganizationReferenceItem } from "../../organization/types";
import {
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  FOLLOW_MONTHLY_SCHEDULE_LABEL,
  MARITAL_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SHIFT_TYPE_OPTIONS,
} from "../constants";
import type { Employee, EmployeeInput } from "../types";

type EmployeeFormProps = {
  disabled: boolean;
  draft: EmployeeInput;
  departments: OrganizationReferenceItem[];
  isSaving: boolean;
  positions: OrganizationReferenceItem[];
  selectedEmployee: Employee | null;
  workShifts: WorkShift[];
  onDeactivate: () => void;
  onSubmit: () => void;
  onUpdateDraft: <K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) => void;
};

export function EmployeeForm({
  departments,
  disabled,
  draft,
  isSaving,
  onDeactivate,
  onSubmit,
  onUpdateDraft,
  positions,
  selectedEmployee,
  workShifts,
}: EmployeeFormProps) {
  const departmentOptions = ensureCurrentOption(activeReferenceNames(departments), draft.department);
  const positionOptions = ensureCurrentOption(activeReferenceNames(positions), draft.position);
  const workScheduleOptions = ensureCurrentOption(
    [
      FOLLOW_MONTHLY_SCHEDULE_LABEL,
      ...workShifts
        .filter((shift) => shift.isActive)
        .map(formatWorkShiftOption),
    ],
    draft.workSchedule,
  );
  const nonShiftDefaultSchedule = getNonShiftDefaultSchedule(workShifts);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-semibold text-foreground">
          {selectedEmployee ? "Detail Karyawan" : "Karyawan Baru"}
        </legend>
        <div className="settings-two-columns">
          <label>
            <span className="field-label">
              Nama <span className="required-label">Wajib</span>
            </span>
            <Input
              maxLength={140}
              onChange={(event) => onUpdateDraft("name", event.target.value)}
              required
              value={draft.name}
            />
          </label>
          <label>
            <span className="field-label">
              NIK <span className="required-label">Wajib</span>
            </span>
            <Input
              maxLength={40}
              onChange={(event) => onUpdateDraft("nik", event.target.value)}
              required
              value={draft.nik}
            />
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Nomor WhatsApp
            <Input
              inputMode="tel"
              maxLength={32}
              onChange={(event) => onUpdateDraft("whatsappNumber", event.target.value)}
              placeholder="Contoh: 081234567890"
              value={draft.whatsappNumber}
            />
          </label>
          <label>
            Email slip gaji
            <Input
              maxLength={160}
              onChange={(event) => onUpdateDraft("email", event.target.value)}
              placeholder="pegawai@email.com"
              type="email"
              value={draft.email}
            />
          </label>
        </div>
        <span className="field-help employee-field-note">
          WhatsApp dipakai sebagai fallback manual. Email dipakai untuk pengiriman slip PDF otomatis.
        </span>

        <div className="settings-two-columns">
          <label>
            <span className="field-label">
              Tanggal mulai kerja <span className="required-label">Wajib</span>
            </span>
            <Input
              onChange={(event) => onUpdateDraft("hireDate", event.target.value)}
              required
              type="date"
              value={draft.hireDate}
            />
          </label>
          <label>
            NPWP
            <Input
              maxLength={40}
              onChange={(event) => onUpdateDraft("npwp", event.target.value)}
              value={draft.npwp}
            />
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Status kawin
            <Select
              disabled={disabled}
              onValueChange={(value) => onUpdateDraft("maritalStatus", value as EmployeeInput["maritalStatus"])}
              value={draft.maritalStatus}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Tanggungan
            <Input
              min={0}
              max={10}
              onChange={(event) => onUpdateDraft("dependents", readNumber(event.target.value, 0))}
              type="number"
              value={draft.dependents}
            />
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            <span className="field-label">
              Departemen <span className="required-label">Wajib</span>
            </span>
            <Select
              disabled={disabled}
              onValueChange={(value) => onUpdateDraft("department", value)}
              value={draft.department}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih departemen" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <span className="field-label">
              Jabatan <span className="required-label">Wajib</span>
            </span>
            <Select
              disabled={disabled}
              onValueChange={(value) => onUpdateDraft("position", value)}
              value={draft.position}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih jabatan" />
              </SelectTrigger>
              <SelectContent>
                {positionOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Status karyawan
            <Select
              disabled={disabled}
              onValueChange={(value) => onUpdateDraft("status", value as EmployeeInput["status"])}
              value={draft.status}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            Sistem gaji
            <Select
              disabled={disabled}
              onValueChange={(value) => onUpdateDraft("employmentType", value as EmployeeInput["employmentType"])}
              value={draft.employmentType}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Gaji pokok default
            <FormattedAmountInput
              disabled={disabled}
              onChange={(value) => onUpdateDraft("salaryAmount", value)}
              value={draft.salaryAmount}
            />
            <span className="field-help">
              Dipakai otomatis sebagai Gaji Pokok saat membuat draft payroll baru.
            </span>
          </label>
          <span className="field-help employee-field-note">
            Nilai ini hanya default master. Slip periode final tetap memakai snapshot payroll.
          </span>
        </div>

        <div className="settings-two-columns">
          <label>
            Pembayaran gaji
            <Select
              disabled={disabled}
              onValueChange={(value) => onUpdateDraft("paymentMethod", value as EmployeeInput["paymentMethod"])}
              value={draft.paymentMethod}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Checkbox
              checked={draft.pph21Enabled}
              disabled={disabled}
              onCheckedChange={(checked) => onUpdateDraft("pph21Enabled", checked === true)}
            />
            PPh 21 aktif
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Tipe shift
            <Select
              disabled={disabled}
              onValueChange={(value) => {
                const nextShiftType = value as EmployeeInput["shiftType"];
                onUpdateDraft("shiftType", nextShiftType);

                if (nextShiftType === "shift") {
                  onUpdateDraft("workSchedule", FOLLOW_MONTHLY_SCHEDULE_LABEL);
                } else if (draft.workSchedule === FOLLOW_MONTHLY_SCHEDULE_LABEL) {
                  onUpdateDraft("workSchedule", nonShiftDefaultSchedule);
                }
              }}
              value={draft.shiftType}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <span className="field-label">
              Jam kerja default <span className="required-label">Wajib</span>
            </span>
            <Select
              disabled={disabled}
              onValueChange={(value) => onUpdateDraft("workSchedule", value)}
              value={draft.workSchedule}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih jam kerja default" />
              </SelectTrigger>
              <SelectContent>
                {workScheduleOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

      </fieldset>

      {selectedEmployee ? (
        <p className="employee-updated-at">
          Terakhir diperbarui {formatLocalDateTimeFromUtc(selectedEmployee.updatedAt)}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={disabled} type="submit">
          {isSaving ? "Menyimpan..." : selectedEmployee ? "Simpan Perubahan" : "Simpan Karyawan"}
        </Button>
        {selectedEmployee && selectedEmployee.status === "active" ? (
          <Button disabled={disabled} onClick={onDeactivate} type="button" variant="destructive">
            Nonaktifkan
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function activeReferenceNames(items: OrganizationReferenceItem[]): string[] {
  return items
    .filter((item) => item.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name))
    .map((item) => item.name);
}

function ensureCurrentOption(options: string[], currentValue: string): string[] {
  const trimmed = currentValue.trim();
  if (trimmed === "" || options.includes(trimmed)) {
    return options;
  }

  return [trimmed, ...options];
}

function formatWorkShiftOption(shift: WorkShift): string {
  if (shift.isOff) {
    return `${shift.name} (Off)`;
  }

  return `${shift.name} (${shift.startTime}-${shift.endTime})`;
}

function getNonShiftDefaultSchedule(workShifts: WorkShift[]): string {
  const nonShift = workShifts.find((shift) => shift.isActive && shift.code === "NONSHIFT");
  return nonShift ? formatWorkShiftOption(nonShift) : FOLLOW_MONTHLY_SCHEDULE_LABEL;
}

function readNumber(value: string, fallback: number): number {
  if (value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
