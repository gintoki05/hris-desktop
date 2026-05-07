import { useEffect, useState } from "react";
import { formatLocalDateTimeFromUtc } from "../../../lib/formatters/date-time";
import type { AuthSession } from "../../auth/types";
import { getMasterSettings, updateMasterSettings } from "../services/master-settings.service";
import type { MasterSettings, PayrollPaydayType, PayrollWeekday } from "../types";

type MasterSettingsPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

const weekdayOptions: Array<{ value: PayrollWeekday; label: string }> = [
  { value: "monday", label: "Senin" },
  { value: "tuesday", label: "Selasa" },
  { value: "wednesday", label: "Rabu" },
  { value: "thursday", label: "Kamis" },
  { value: "friday", label: "Jumat" },
  { value: "saturday", label: "Sabtu" },
  { value: "sunday", label: "Minggu" },
];

export function MasterSettingsPanel({ canEdit, session }: MasterSettingsPanelProps) {
  const [settings, setSettings] = useState<MasterSettings | null>(null);
  const [draft, setDraft] = useState<MasterSettings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getMasterSettings()
      .then((nextSettings) => {
        if (!isMounted) {
          return;
        }

        setSettings(nextSettings);
        setDraft(nextSettings);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Setting master gagal dibaca.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave() {
    if (!draft || !canEdit) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const savedSettings = await updateMasterSettings({
        company: draft.company,
        payroll: draft.payroll,
        actor: {
          userId: session.user.id,
          displayName: session.user.displayName,
          role: session.user.role,
        },
      });

      setSettings(savedSettings);
      setDraft(savedSettings);
      setSuccessMessage("Setting master tersimpan dan audit perubahan tercatat.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Setting master gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateCompanyField(field: keyof MasterSettings["company"], value: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            company: {
              ...current.company,
              [field]: value,
            },
          }
        : current,
    );
  }

  function updatePayrollField<K extends keyof MasterSettings["payroll"]>(
    field: K,
    value: MasterSettings["payroll"][K],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            payroll: {
              ...current.payroll,
              [field]: value,
            },
          }
        : current,
    );
  }

  function updatePaydayType(paydayType: PayrollPaydayType) {
    setDraft((current) =>
      current
        ? {
            ...current,
            payroll: {
              ...current.payroll,
              paydayType,
              paydayDayOfMonth:
                paydayType === "day_of_month" ? (current.payroll.paydayDayOfMonth ?? 25) : null,
              paydayWeekday:
                paydayType === "weekday" ? (current.payroll.paydayWeekday ?? "friday") : null,
            },
          }
        : current,
    );
  }

  const disabled = !canEdit || isSaving || isLoading;

  return (
    <section className="panel" aria-label="Master perusahaan dan aturan payroll">
      <div className="panel-header">
        <h2>Master Perusahaan & Payroll</h2>
        <span className="status-pill">{canEdit ? "Admin bisa edit" : "Readonly"}</span>
      </div>

      {isLoading ? <p className="status-note">Membaca setting lokal...</p> : null}
      {!canEdit ? (
        <p className="readonly-note">Role saat ini hanya bisa melihat setting, tidak menyimpan perubahan.</p>
      ) : null}
      {errorMessage ? <p className="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="success-alert">{successMessage}</p> : null}

      {draft ? (
        <div className="settings-content">
          <div className="settings-form-grid">
            <fieldset className="settings-fieldset" disabled={disabled}>
              <legend>Perusahaan</legend>
              <label>
                Nama perusahaan
                <input
                  maxLength={120}
                  onChange={(event) => updateCompanyField("companyName", event.target.value)}
                  required
                  value={draft.company.companyName}
                />
              </label>
              <label>
                Alamat
                <textarea
                  maxLength={500}
                  onChange={(event) => updateCompanyField("address", event.target.value)}
                  rows={3}
                  value={draft.company.address}
                />
              </label>
              <div className="settings-two-columns">
                <label>
                  Telepon/kontak
                  <input
                    maxLength={60}
                    onChange={(event) => updateCompanyField("contactPhone", event.target.value)}
                    value={draft.company.contactPhone}
                  />
                </label>
                <label>
                  Email
                  <input
                    maxLength={120}
                    onChange={(event) => updateCompanyField("contactEmail", event.target.value)}
                    type="email"
                    value={draft.company.contactEmail}
                  />
                </label>
              </div>
              <label>
                Nama bendahara
                <input
                  maxLength={120}
                  onChange={(event) => updateCompanyField("treasurerName", event.target.value)}
                  value={draft.company.treasurerName}
                />
              </label>
            </fieldset>

            <fieldset className="settings-fieldset" disabled={disabled}>
              <legend>Aturan Payroll</legend>
              <div className="settings-two-columns">
                <label>
                  Tahun berjalan
                  <input
                    min={2020}
                    max={2100}
                    onChange={(event) =>
                      updatePayrollField("currentYear", readNumber(event.target.value, 2026))
                    }
                    type="number"
                    value={draft.payroll.currentYear}
                  />
                </label>
                <label>
                  Hari kerja per minggu
                  <input
                    min={1}
                    max={7}
                    onChange={(event) =>
                      updatePayrollField("workingDaysPerWeek", readNumber(event.target.value, 6))
                    }
                    type="number"
                    value={draft.payroll.workingDaysPerWeek}
                  />
                </label>
              </div>

              <div className="settings-two-columns">
                <label>
                  Tipe gajian
                  <select
                    onChange={(event) => {
                      const paydayType = event.target.value as PayrollPaydayType;
                      updatePaydayType(paydayType);
                    }}
                    value={draft.payroll.paydayType}
                  >
                    <option value="day_of_month">Tanggal setiap bulan</option>
                    <option value="weekday">Hari tertentu</option>
                  </select>
                </label>
                {draft.payroll.paydayType === "day_of_month" ? (
                  <label>
                    Tanggal gajian
                    <input
                      min={1}
                      max={31}
                      onChange={(event) =>
                        updatePayrollField("paydayDayOfMonth", readNumber(event.target.value, 25))
                      }
                      type="number"
                      value={draft.payroll.paydayDayOfMonth ?? 25}
                    />
                  </label>
                ) : (
                  <label>
                    Hari gajian
                    <select
                      onChange={(event) =>
                        updatePayrollField("paydayWeekday", event.target.value as PayrollWeekday)
                      }
                      value={draft.payroll.paydayWeekday ?? "friday"}
                    >
                      {weekdayOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="settings-two-columns">
                <label>
                  Toleransi telat (menit)
                  <input
                    min={0}
                    onChange={(event) =>
                      updatePayrollField("lateToleranceMinutes", readNumber(event.target.value, 0))
                    }
                    type="number"
                    value={draft.payroll.lateToleranceMinutes}
                  />
                </label>
                <label>
                  Denda telat
                  <input
                    min={0}
                    onChange={(event) =>
                      updatePayrollField("latePenaltyAmount", readNumber(event.target.value, 0))
                    }
                    type="number"
                    value={draft.payroll.latePenaltyAmount}
                  />
                </label>
              </div>

              <div className="settings-two-columns">
                <label>
                  Toleransi pulang cepat (menit)
                  <input
                    min={0}
                    onChange={(event) =>
                      updatePayrollField(
                        "earlyLeaveToleranceMinutes",
                        readNumber(event.target.value, 0),
                      )
                    }
                    type="number"
                    value={draft.payroll.earlyLeaveToleranceMinutes}
                  />
                </label>
                <label>
                  Denda pulang cepat
                  <input
                    min={0}
                    onChange={(event) =>
                      updatePayrollField(
                        "earlyLeavePenaltyAmount",
                        readNumber(event.target.value, 0),
                      )
                    }
                    type="number"
                    value={draft.payroll.earlyLeavePenaltyAmount}
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <div className="settings-actions">
            <button disabled={disabled || !settingsChanged(settings, draft)} onClick={handleSave} type="button">
              {isSaving ? "Menyimpan..." : "Simpan Setting"}
            </button>
          </div>

          <div className="audit-list" aria-label="Audit perubahan setting">
            <h3>Audit Terakhir</h3>
            {draft.recentAuditEvents.length > 0 ? (
              draft.recentAuditEvents.map((event) => (
                <div className="audit-row" key={event.id}>
                  <strong>{event.actorDisplayName}</strong>
                  <span>{event.changeSummary}</span>
                  <time>{formatLocalDateTimeFromUtc(event.createdAt)}</time>
                </div>
              ))
            ) : (
              <p>Belum ada perubahan setting yang tersimpan.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function readNumber(value: string, fallback: number): number {
  if (value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function settingsChanged(current: MasterSettings | null, draft: MasterSettings): boolean {
  if (!current) {
    return false;
  }

  return JSON.stringify(current.company) !== JSON.stringify(draft.company)
    || JSON.stringify(current.payroll) !== JSON.stringify(draft.payroll);
}
