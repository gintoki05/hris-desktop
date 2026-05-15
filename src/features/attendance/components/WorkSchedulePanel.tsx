import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import {
  FeaturePanel,
  PanelBody,
  PanelNote,
  StatusBadge,
} from "../../../components/shared/FeaturePanel";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  formatDisplayDateText,
  getCurrentMonthDateRange,
} from "../../../lib/formatters/date-time";
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
  const initialDateRange = useMemo(() => getCurrentMonthDateRange(), []);
  const [startDate, setStartDate] = useState(initialDateRange.startDate);
  const [endDate, setEndDate] = useState(initialDateRange.endDate);
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
            ? `Rentang yang dipilih overlap dengan periode "${formatDisplayDateText(period.label)}", jadi periode existing itu dibuka.`
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
    <FeaturePanel
      aria-label="Jadwal kerja karyawan"
      badge={<StatusBadge>{canEdit ? "Admin bisa edit" : "Readonly"}</StatusBadge>}
      title="Jadwal Multi-shift Karyawan"
    >
      <PanelBody>
        <div className="grid gap-3 md:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] md:items-end">
          <label>
            Label Periode
            <Input
              disabled={disabled || !draft}
              value={draft?.label ?? ""}
              onChange={(event) => draft && setDraft({ ...draft, label: event.target.value })}
            />
          </label>
          <label>
            Mulai
            <Input
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
            <Input
              disabled={isLoading || isSaving}
              type="date"
              value={endDate}
              onChange={(event) => {
                setNoticeMessage(null);
                setEndDate(event.target.value);
              }}
            />
          </label>
          <Button
            disabled={disabled || employees.length === 0 || activeShifts.length === 0}
            onClick={handleAddEntry}
            type="button"
            variant="outline"
          >
            Tambah Jadwal Harian
          </Button>
        </div>

        {isLoading ? <PanelNote>Membaca jadwal kerja lokal...</PanelNote> : null}
        {!canEdit ? <PanelNote>Role saat ini hanya bisa melihat jadwal kerja.</PanelNote> : null}
        {currentPeriod?.isLocked ? (
          <PanelNote tone="warning">Periode ini sudah terkunci oleh payroll final.</PanelNote>
        ) : null}
        {noticeMessage ? <PanelNote>{noticeMessage}</PanelNote> : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

        {draft ? (
          <div className="grid gap-3">
            <div className="overflow-x-auto rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Karyawan Aktif</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>Belum ada jadwal untuk periode ini.</TableCell>
                    </TableRow>
                  ) : (
                    draft.entries.map((entry, index) => {
                      const employee = employees.find((item) => item.id === entry.employeeId);
                      const shift = activeShifts.find((item) => item.id === entry.shiftId);

                      return (
                        <TableRow key={entry.id ?? `${entry.employeeId}-${entry.workDate}-${index}`}>
                          <TableCell>
                            <Input
                              disabled={disabled}
                              max={endDate}
                              min={startDate}
                              type="date"
                              value={entry.workDate}
                              onChange={(event) =>
                                handleEntryChange(index, { workDate: event.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={disabled}
                              onValueChange={(employeeId) => handleEntryChange(index, { employeeId })}
                              value={entry.employeeId}
                            >
                              <SelectTrigger className="min-w-56">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {employees.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name} - {item.position}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {employee ? formatShiftType(employee.shiftType) : "Tidak aktif"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="grid gap-1">
                              <Select
                                disabled={disabled}
                                onValueChange={(shiftId) => handleEntryChange(index, { shiftId })}
                                value={entry.shiftId}
                              >
                                <SelectTrigger className="min-w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeShifts.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.code} - {item.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {shift ? <span>{shift.startTime} - {shift.endTime}</span> : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              disabled={disabled}
                              placeholder="Opsional"
                              value={entry.notes}
                              onChange={(event) =>
                                handleEntryChange(index, { notes: event.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              disabled={disabled || Boolean(entry.id)}
                              onClick={() => handleRemoveEntry(index)}
                              type="button"
                              variant="outline"
                            >
                              {entry.id ? "Tersimpan" : "Hapus Baris"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                disabled={disabled || !scheduleChanged(currentPeriod, draft)}
                onClick={handleSave}
                type="button"
              >
                {isSaving ? "Menyimpan..." : "Simpan Jadwal Kerja"}
              </Button>
            </div>
          </div>
        ) : null}
      </PanelBody>
    </FeaturePanel>
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }

  return fallback;
}
