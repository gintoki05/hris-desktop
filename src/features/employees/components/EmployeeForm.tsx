import { formatLocalDateTimeFromUtc } from "../../../lib/formatters/date-time";
import {
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SHIFT_TYPE_OPTIONS,
} from "../constants";
import type { Employee, EmployeeInput } from "../types";

type EmployeeFormProps = {
  disabled: boolean;
  draft: EmployeeInput;
  isSaving: boolean;
  selectedEmployee: Employee | null;
  onDeactivate: () => void;
  onSubmit: () => void;
  onUpdateDraft: <K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) => void;
};

export function EmployeeForm({
  disabled,
  draft,
  isSaving,
  onDeactivate,
  onSubmit,
  onUpdateDraft,
  selectedEmployee,
}: EmployeeFormProps) {
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
            <span className="field-label">
              Tanggal masuk <span className="required-label">Wajib</span>
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
            <input
              maxLength={100}
              onChange={(event) => onUpdateDraft("department", event.target.value)}
              required
              value={draft.department}
            />
          </label>
          <label>
            <span className="field-label">
              Jabatan <span className="required-label">Wajib</span>
            </span>
            <input
              maxLength={100}
              onChange={(event) => onUpdateDraft("position", event.target.value)}
              required
              value={draft.position}
            />
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
            Nominal gaji
            <input
              min={0}
              onChange={(event) => onUpdateDraft("salaryAmount", readNumber(event.target.value, 0))}
              type="number"
              value={draft.salaryAmount}
            />
          </label>
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
        </div>

        <div className="settings-two-columns">
          <label>
            Tipe shift
            <select
              onChange={(event) =>
                onUpdateDraft("shiftType", event.target.value as EmployeeInput["shiftType"])
              }
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
              Jam kerja <span className="required-label">Wajib</span>
            </span>
            <input
              maxLength={80}
              onChange={(event) => onUpdateDraft("workSchedule", event.target.value)}
              required
              value={draft.workSchedule}
            />
          </label>
        </div>

        <label className="inline-check">
          <input
            checked={draft.pph21Enabled}
            onChange={(event) => onUpdateDraft("pph21Enabled", event.target.checked)}
            type="checkbox"
          />
          PPh 21 aktif
        </label>
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

function readNumber(value: string, fallback: number): number {
  if (value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
