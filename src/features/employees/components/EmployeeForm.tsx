import { formatLocalDateTimeFromUtc } from "../../../lib/formatters/date-time";
import { FormattedAmountInput } from "../../../components/shared/FormattedAmountInput";
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
      className="employee-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="settings-fieldset" disabled={disabled}>
        <legend>{selectedEmployee ? "Detail Karyawan" : "Karyawan Baru"}</legend>
        <div className="settings-two-columns">
          <label>
            <span className="field-label">
              Nama <span className="required-label">Wajib</span>
            </span>
            <input
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
            <input
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
            <input
              inputMode="tel"
              maxLength={32}
              onChange={(event) => onUpdateDraft("whatsappNumber", event.target.value)}
              placeholder="Contoh: 081234567890"
              value={draft.whatsappNumber}
            />
          </label>
          <label>
            Email slip gaji
            <input
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
            <input
              onChange={(event) => onUpdateDraft("hireDate", event.target.value)}
              required
              type="date"
              value={draft.hireDate}
            />
          </label>
          <label>
            NPWP
            <input
              maxLength={40}
              onChange={(event) => onUpdateDraft("npwp", event.target.value)}
              value={draft.npwp}
            />
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Status kawin
            <select
              onChange={(event) =>
                onUpdateDraft("maritalStatus", event.target.value as EmployeeInput["maritalStatus"])
              }
              value={draft.maritalStatus}
            >
              {MARITAL_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tanggungan
            <input
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
            <select
              onChange={(event) => onUpdateDraft("department", event.target.value)}
              required
              value={draft.department}
            >
              <option value="">Pilih departemen</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">
              Jabatan <span className="required-label">Wajib</span>
            </span>
            <select
              onChange={(event) => onUpdateDraft("position", event.target.value)}
              required
              value={draft.position}
            >
              <option value="">Pilih jabatan</option>
              {positionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Status karyawan
            <select
              onChange={(event) =>
                onUpdateDraft("status", event.target.value as EmployeeInput["status"])
              }
              value={draft.status}
            >
              {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sistem gaji
            <select
              onChange={(event) =>
                onUpdateDraft("employmentType", event.target.value as EmployeeInput["employmentType"])
              }
              value={draft.employmentType}
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            <select
              onChange={(event) =>
                onUpdateDraft("paymentMethod", event.target.value as EmployeeInput["paymentMethod"])
              }
              value={draft.paymentMethod}
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-check">
            <input
              checked={draft.pph21Enabled}
              onChange={(event) => onUpdateDraft("pph21Enabled", event.target.checked)}
              type="checkbox"
            />
            PPh 21 aktif
          </label>
        </div>

        <div className="settings-two-columns">
          <label>
            Tipe shift
            <select
              onChange={(event) => {
                const nextShiftType = event.target.value as EmployeeInput["shiftType"];
                onUpdateDraft("shiftType", nextShiftType);

                if (nextShiftType === "shift") {
                  onUpdateDraft("workSchedule", FOLLOW_MONTHLY_SCHEDULE_LABEL);
                } else if (draft.workSchedule === FOLLOW_MONTHLY_SCHEDULE_LABEL) {
                  onUpdateDraft("workSchedule", nonShiftDefaultSchedule);
                }
              }}
              value={draft.shiftType}
            >
              {SHIFT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">
              Jam kerja default <span className="required-label">Wajib</span>
            </span>
            <select
              onChange={(event) => onUpdateDraft("workSchedule", event.target.value)}
              required
              value={draft.workSchedule}
            >
              <option value="">Pilih jam kerja default</option>
              {workScheduleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

      </fieldset>

      {selectedEmployee ? (
        <p className="employee-updated-at">
          Terakhir diperbarui {formatLocalDateTimeFromUtc(selectedEmployee.updatedAt)}
        </p>
      ) : null}

      <div className="settings-actions">
        <button disabled={disabled} type="submit">
          {isSaving ? "Menyimpan..." : selectedEmployee ? "Simpan Perubahan" : "Simpan Karyawan"}
        </button>
        {selectedEmployee && selectedEmployee.status === "active" ? (
          <button disabled={disabled} onClick={onDeactivate} type="button">
            Nonaktifkan
          </button>
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
