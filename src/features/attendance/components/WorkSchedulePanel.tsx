import { useEffect, useMemo, useState } from "react";
import type { AuthSession } from "../../auth/types";
import { listActiveEmployees } from "../../employees/services/employee.service";
import type { Employee } from "../../employees/types";
import { getAttendanceMasterData } from "../services/attendance-master.service";
import {
  createEmptyWorkSchedulePeriod,
  createWorkScheduleEntry,
  getWorkSchedulePeriod,
  saveWorkSchedulePeriod,
} from "../services/work-schedule.service";
import type {
  AttendanceMasterData,
  WorkScheduleActor,
  WorkScheduleEntryInput,
  WorkSchedulePeriod,
  WorkSchedulePeriodInput,
  WorkShift,
} from "../types";

type WorkSchedulePanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

export function WorkSchedulePanel({ canEdit, session }: WorkSchedulePanelProps) {
  const [startDate, setStartDate] = useState(getCurrentMonthStart());
  const [endDate, setEndDate] = useState(getCurrentMonthEnd());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [masterData, setMasterData] = useState<AttendanceMasterData | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<WorkSchedulePeriod | null>(null);
  const [draft, setDraft] = useState<WorkSchedulePeriodInput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      listActiveEmployees(),
      getAttendanceMasterData(),
      getWorkSchedulePeriod(startDate, endDate),
    ])
      .then(([nextEmployees, nextMasterData, period]) => {
        if (!isMounted) {
          return;
        }

        setEmployees(nextEmployees);
        setMasterData(nextMasterData);
        setCurrentPeriod(period);
        setDraft(period ? toInput(period) : createEmptyWorkSchedulePeriod(startDate, endDate));
        setErrorMessage(null);
        setSuccessMessage(null);
        setNoticeMessage((currentNotice) =>
          period && (period.startDate !== startDate || period.endDate !== endDate)
            ? `Rentang yang dipilih overlap dengan periode "${period.label}", jadi periode existing itu dibuka.`
            : currentNotice?.startsWith("Rentang yang dipilih overlap")
              ? currentNotice
              : null,
        );
        if (period && (period.startDate !== startDate || period.endDate !== endDate)) {
          setStartDate(period.startDate);
          setEndDate(period.endDate);
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getErrorMessage(error, "Jadwal kerja gagal dibaca."));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [startDate, endDate]);

  const activeShifts = useMemo(
    () => (masterData?.shifts ?? []).filter((shift) => shift.isActive),
    [masterData],
  );
  const disabled = !canEdit || isSaving || isLoading || currentPeriod?.isLocked === true;

  async function handleSave() {
    if (!draft || !canEdit) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const saved = await saveWorkSchedulePeriod(draft, toActor(session));
      setCurrentPeriod(saved);
      setDraft(toInput(saved));
      setSuccessMessage("Jadwal kerja tersimpan.");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Jadwal kerja gagal disimpan."));
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddEntry() {
    if (!draft || employees.length === 0 || activeShifts.length === 0) {
      return;
    }

    const employee = employees[0];
    const shift = findDefaultShift(activeShifts, employee);
    setDraft({
      ...draft,
      entries: [
        ...draft.entries,
        createWorkScheduleEntry(employee.id, startDate, shift.id),
      ],
    });
  }

  function handleEntryChange(index: number, patch: Partial<WorkScheduleEntryInput>) {
    if (!draft) {
      return;
    }

    setDraft({
      ...draft,
      entries: draft.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    });
  }

  function handleRemoveEntry(index: number) {
    if (!draft) {
      return;
    }

    setDraft({
      ...draft,
      entries: draft.entries.filter((_, entryIndex) => entryIndex !== index),
    });
  }

  return (
    <section className="panel" aria-label="Jadwal kerja karyawan">
      <div className="panel-header">
        <h2>Jadwal Multi-shift Karyawan</h2>
        <span className="status-pill">{canEdit ? "Admin bisa edit" : "Readonly"}</span>
      </div>

      <div className="schedule-toolbar">
        <label>
          Label Periode
          <input
            disabled={disabled || !draft}
            value={draft?.label ?? ""}
            onChange={(event) => draft && setDraft({ ...draft, label: event.target.value })}
          />
        </label>
        <label>
          Mulai
          <input
            disabled={isLoading || isSaving}
            type="date"
            value={startDate}
            onChange={(event) => {
              setNoticeMessage(null);
              setStartDate(event.target.value);
            }}
          />
        </label>
        <label>
          Selesai
          <input
            disabled={isLoading || isSaving}
            type="date"
            value={endDate}
            onChange={(event) => {
              setNoticeMessage(null);
              setEndDate(event.target.value);
            }}
          />
        </label>
        <button
          disabled={disabled || employees.length === 0 || activeShifts.length === 0}
          onClick={handleAddEntry}
          type="button"
        >
          Tambah Jadwal Harian
        </button>
      </div>

      {isLoading ? <p className="status-note">Membaca jadwal kerja lokal...</p> : null}
      {!canEdit ? <p className="readonly-note">Role saat ini hanya bisa melihat jadwal kerja.</p> : null}
      {currentPeriod?.isLocked ? (
        <p className="readonly-note">Periode ini sudah terkunci oleh payroll final.</p>
      ) : null}
      {noticeMessage ? <p className="readonly-note">{noticeMessage}</p> : null}
      {errorMessage ? <p className="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="success-alert">{successMessage}</p> : null}

      {draft ? (
        <div className="schedule-content">
          <div className="schedule-table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Karyawan Aktif</th>
                  <th>Tipe</th>
                  <th>Shift</th>
                  <th>Catatan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {draft.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Belum ada jadwal untuk periode ini.</td>
                  </tr>
                ) : (
                  draft.entries.map((entry, index) => {
                    const employee = employees.find((item) => item.id === entry.employeeId);
                    const shift = activeShifts.find((item) => item.id === entry.shiftId);

                    return (
                      <tr key={entry.id ?? `${entry.employeeId}-${entry.workDate}-${index}`}>
                        <td>
                          <input
                            disabled={disabled}
                            max={endDate}
                            min={startDate}
                            type="date"
                            value={entry.workDate}
                            onChange={(event) =>
                              handleEntryChange(index, { workDate: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <select
                            disabled={disabled}
                            value={entry.employeeId}
                            onChange={(event) =>
                              handleEntryChange(index, { employeeId: event.target.value })
                            }
                          >
                            {employees.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} - {item.position}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className="schedule-type-text">
                            {employee ? formatShiftType(employee.shiftType) : "Tidak aktif"}
                          </span>
                        </td>
                        <td>
                          <div className="schedule-shift-cell">
                            <select
                              disabled={disabled}
                              value={entry.shiftId}
                              onChange={(event) =>
                                handleEntryChange(index, { shiftId: event.target.value })
                              }
                            >
                              {activeShifts.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.code} - {item.name}
                                </option>
                              ))}
                            </select>
                            {shift ? <span>{shift.startTime} - {shift.endTime}</span> : null}
                          </div>
                        </td>
                        <td>
                          <input
                            disabled={disabled}
                            placeholder="Opsional"
                            value={entry.notes}
                            onChange={(event) =>
                              handleEntryChange(index, { notes: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <button
                            disabled={disabled || Boolean(entry.id)}
                            onClick={() => handleRemoveEntry(index)}
                            type="button"
                          >
                            {entry.id ? "Tersimpan" : "Hapus Baris"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="settings-actions">
            <button
              disabled={disabled || !scheduleChanged(currentPeriod, draft)}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? "Menyimpan..." : "Simpan Jadwal Kerja"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function toInput(period: WorkSchedulePeriod): WorkSchedulePeriodInput {
  return {
    id: period.id,
    label: period.label,
    startDate: period.startDate,
    endDate: period.endDate,
    entries: period.entries.map((entry) => ({
      id: entry.id,
      employeeId: entry.employeeId,
      workDate: entry.workDate,
      shiftId: entry.shiftId,
      notes: entry.notes,
    })),
  };
}

function toActor(session: AuthSession): WorkScheduleActor {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}

function findDefaultShift(shifts: WorkShift[], employee: Employee): WorkShift {
  const preferredCode = employee.shiftType === "non_shift" ? "NONSHIFT" : "";
  return (
    shifts.find((shift) => shift.code === preferredCode)
    ?? shifts.find((shift) => !shift.isOff)
    ?? shifts[0]
  );
}

function formatShiftType(value: Employee["shiftType"]): string {
  return value === "non_shift" ? "Non-shift" : "Shift";
}

function scheduleChanged(
  current: WorkSchedulePeriod | null,
  draft: WorkSchedulePeriodInput,
): boolean {
  return JSON.stringify(current ? toInput(current) : null) !== JSON.stringify(draft);
}

function getCurrentMonthStart(): string {
  const now = new Date();
  return formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function getCurrentMonthEnd(): string {
  const now = new Date();
  return formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }

  return fallback;
}
