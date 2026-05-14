import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { PaginationControls } from "../../../components/shared/PaginationControls";
import type { AuthSession } from "../../auth/types";
import { ATTENDANCE_CODE_CATEGORY_OPTIONS, OVERTIME_APPLIES_TO_OPTIONS } from "../constants";
import {
  BooleanInput,
  MasterSection,
  NumberInput,
  SelectInput,
  TextInput,
} from "./AttendanceMasterControls";
import {
  addAttendanceCode,
  addOvertimeRule,
  addShift,
  removeAttendanceCode,
  removeOvertimeRule,
  removeShift,
  updateAttendanceCode,
  updateOvertimeRule,
  updateShift,
} from "../services/attendance-master-draft.service";
import {
  getAttendanceMasterData,
  saveAttendanceMasterData,
} from "../services/attendance-master.service";
import type {
  AttendanceCode,
  AttendanceMasterActor,
  AttendanceMasterData,
  OvertimeRule,
} from "../types";

type AttendanceMasterPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

const MASTER_PAGE_SIZE = 5;

export function AttendanceMasterPanel({ canEdit, session }: AttendanceMasterPanelProps) {
  const [masterData, setMasterData] = useState<AttendanceMasterData | null>(null);
  const [draft, setDraft] = useState<AttendanceMasterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shiftPage, setShiftPage] = useState(1);
  const [attendanceCodePage, setAttendanceCodePage] = useState(1);
  const [overtimeRulePage, setOvertimeRulePage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const shiftPageStartIndex = (shiftPage - 1) * MASTER_PAGE_SIZE;
  const attendanceCodePageStartIndex = (attendanceCodePage - 1) * MASTER_PAGE_SIZE;
  const overtimeRulePageStartIndex = (overtimeRulePage - 1) * MASTER_PAGE_SIZE;
  const paginatedShifts = useMemo(
    () => draft?.shifts.slice(shiftPageStartIndex, shiftPageStartIndex + MASTER_PAGE_SIZE) ?? [],
    [draft?.shifts, shiftPageStartIndex],
  );
  const paginatedAttendanceCodes = useMemo(
    () =>
      draft?.attendanceCodes.slice(
        attendanceCodePageStartIndex,
        attendanceCodePageStartIndex + MASTER_PAGE_SIZE,
      ) ?? [],
    [attendanceCodePageStartIndex, draft?.attendanceCodes],
  );
  const paginatedOvertimeRules = useMemo(
    () =>
      draft?.overtimeRules.slice(overtimeRulePageStartIndex, overtimeRulePageStartIndex + MASTER_PAGE_SIZE) ??
      [],
    [draft?.overtimeRules, overtimeRulePageStartIndex],
  );

  useEffect(() => {
    let isMounted = true;

    getAttendanceMasterData()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setMasterData(data);
        setDraft(data);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Master absensi gagal dibaca.");
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

  useEffect(() => {
    setShiftPage((page) => clampPage(page, draft?.shifts.length ?? 0));
  }, [draft?.shifts.length]);

  useEffect(() => {
    setAttendanceCodePage((page) => clampPage(page, draft?.attendanceCodes.length ?? 0));
  }, [draft?.attendanceCodes.length]);

  useEffect(() => {
    setOvertimeRulePage((page) => clampPage(page, draft?.overtimeRules.length ?? 0));
  }, [draft?.overtimeRules.length]);

  async function handleSave() {
    if (!draft || !canEdit) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const saved = await saveAttendanceMasterData(draft, toActor(session));
      setMasterData(saved);
      setDraft(saved);
      setSuccessMessage("Master shift, absensi, dan lembur tersimpan.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Master absensi gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  const disabled = !canEdit || isSaving || isLoading;

  return (
    <section className="panel" aria-label="Master shift dan kode absensi">
      <div className="panel-header">
        <h2>Master Shift & Absensi</h2>
        <span className="status-pill">{canEdit ? "Admin bisa edit" : "Readonly"}</span>
      </div>

      {isLoading ? <p className="status-note">Membaca master absensi lokal...</p> : null}
      {!canEdit ? (
        <p className="readonly-note">Role saat ini hanya bisa melihat master shift dan absensi.</p>
      ) : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      {draft ? (
        <div className="attendance-master-content">
          <MasterSection
            actionLabel="Tambah Shift"
            canEdit={canEdit}
            title="Shift & Jam Kerja"
            onAdd={() => {
              setShiftPage(Math.max(1, Math.ceil((draft.shifts.length + 1) / MASTER_PAGE_SIZE)));
              addShift(draft, setDraft);
            }}
          >
            {paginatedShifts.map((shift, index) => {
              const draftIndex = shiftPageStartIndex + index;

              return (
                <div className="master-row master-row-shift" key={shift.id}>
                  <TextInput
                    disabled={disabled}
                    label="Kode"
                    value={shift.code}
                    onChange={(value) => updateShift(draftIndex, { code: value }, setDraft)}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Nama"
                    value={shift.name}
                    onChange={(value) => updateShift(draftIndex, { name: value }, setDraft)}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Mulai"
                    type="time"
                    value={shift.startTime}
                    onChange={(value) => updateShift(draftIndex, { startTime: value }, setDraft)}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Selesai"
                    type="time"
                    value={shift.endTime}
                    onChange={(value) => updateShift(draftIndex, { endTime: value }, setDraft)}
                  />
                  <NumberInput
                    disabled={disabled}
                    label="Istirahat"
                    value={shift.breakMinutes}
                    onChange={(value) => updateShift(draftIndex, { breakMinutes: value }, setDraft)}
                  />
                  <BooleanInput
                    checked={shift.isOff}
                    disabled={disabled}
                    label="Off"
                    onChange={(value) => updateShift(draftIndex, { isOff: value }, setDraft)}
                  />
                  <BooleanInput
                    checked={shift.isActive}
                    disabled={disabled}
                    label="Aktif"
                    onChange={(value) => updateShift(draftIndex, { isActive: value }, setDraft)}
                  />
                  <RowActionButton
                    canRemove={isNewShift(masterData, shift.id)}
                    disabled={disabled}
                    onRemove={() => removeShift(shift.id, setDraft)}
                  />
                </div>
              );
            })}
            <PaginationControls
              ariaLabel="Pagination shift"
              currentPage={shiftPage}
              itemLabel="shift"
              onPageChange={setShiftPage}
              pageSize={MASTER_PAGE_SIZE}
              totalItems={draft.shifts.length}
            />
          </MasterSection>

          <MasterSection
            actionLabel="Tambah Kode"
            canEdit={canEdit}
            title="Kode Absensi"
            onAdd={() => {
              setAttendanceCodePage(
                Math.max(1, Math.ceil((draft.attendanceCodes.length + 1) / MASTER_PAGE_SIZE)),
              );
              addAttendanceCode(draft, setDraft);
            }}
          >
            {paginatedAttendanceCodes.map((code, index) => {
              const draftIndex = attendanceCodePageStartIndex + index;

              return (
                <div className="master-row master-row-attendance" key={code.id}>
                  <TextInput
                    disabled={disabled}
                    label="Kode"
                    value={code.code}
                    onChange={(value) => updateAttendanceCode(draftIndex, { code: value }, setDraft)}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Nama"
                    value={code.name}
                    onChange={(value) => updateAttendanceCode(draftIndex, { name: value }, setDraft)}
                  />
                  <SelectInput
                    disabled={disabled}
                    label="Kategori"
                    options={ATTENDANCE_CODE_CATEGORY_OPTIONS}
                    value={code.category}
                    onChange={(value) =>
                      updateAttendanceCode(
                        draftIndex,
                        { category: value as AttendanceCode["category"] },
                        setDraft,
                      )
                    }
                  />
                  <BooleanInput
                    checked={code.countsAsWorkday}
                    disabled={disabled}
                    label="Hari kerja"
                    onChange={(value) =>
                      updateAttendanceCode(draftIndex, { countsAsWorkday: value }, setDraft)
                    }
                  />
                  <BooleanInput
                    checked={code.isPaid}
                    disabled={disabled}
                    label="Dibayar"
                    onChange={(value) => updateAttendanceCode(draftIndex, { isPaid: value }, setDraft)}
                  />
                  <BooleanInput
                    checked={code.isActive}
                    disabled={disabled}
                    label="Aktif"
                    onChange={(value) => updateAttendanceCode(draftIndex, { isActive: value }, setDraft)}
                  />
                  <RowActionButton
                    canRemove={isNewAttendanceCode(masterData, code.id)}
                    disabled={disabled}
                    onRemove={() => removeAttendanceCode(code.id, setDraft)}
                  />
                </div>
              );
            })}
            <PaginationControls
              ariaLabel="Pagination kode absensi"
              currentPage={attendanceCodePage}
              itemLabel="kode absensi"
              onPageChange={setAttendanceCodePage}
              pageSize={MASTER_PAGE_SIZE}
              totalItems={draft.attendanceCodes.length}
            />
          </MasterSection>

          <MasterSection
            actionLabel="Tambah Lembur"
            canEdit={canEdit}
            title="Kode & Multiplier Lembur"
            onAdd={() => {
              setOvertimeRulePage(
                Math.max(1, Math.ceil((draft.overtimeRules.length + 1) / MASTER_PAGE_SIZE)),
              );
              addOvertimeRule(draft, setDraft);
            }}
          >
            {paginatedOvertimeRules.map((rule, index) => {
              const draftIndex = overtimeRulePageStartIndex + index;

              return (
                <div className="master-row master-row-overtime" key={rule.id}>
                  <TextInput
                    disabled={disabled}
                    label="Kode"
                    value={rule.code}
                    onChange={(value) => updateOvertimeRule(draftIndex, { code: value }, setDraft)}
                  />
                  <TextInput
                    disabled={disabled}
                    label="Nama"
                    value={rule.name}
                    onChange={(value) => updateOvertimeRule(draftIndex, { name: value }, setDraft)}
                  />
                  <SelectInput
                    disabled={disabled}
                    label="Berlaku"
                    options={OVERTIME_APPLIES_TO_OPTIONS}
                    value={rule.appliesTo}
                    onChange={(value) =>
                      updateOvertimeRule(
                        draftIndex,
                        { appliesTo: value as OvertimeRule["appliesTo"] },
                        setDraft,
                      )
                    }
                  />
                  <NumberInput
                    disabled={disabled}
                    label="Multiplier"
                    step="0.1"
                    value={rule.multiplier}
                    onChange={(value) => updateOvertimeRule(draftIndex, { multiplier: value }, setDraft)}
                  />
                  <BooleanInput
                    checked={rule.isActive}
                    disabled={disabled}
                    label="Aktif"
                    onChange={(value) => updateOvertimeRule(draftIndex, { isActive: value }, setDraft)}
                  />
                  <RowActionButton
                    canRemove={isNewOvertimeRule(masterData, rule.id)}
                    disabled={disabled}
                    onRemove={() => removeOvertimeRule(rule.id, setDraft)}
                  />
                </div>
              );
            })}
            <PaginationControls
              ariaLabel="Pagination lembur"
              currentPage={overtimeRulePage}
              itemLabel="aturan lembur"
              onPageChange={setOvertimeRulePage}
              pageSize={MASTER_PAGE_SIZE}
              totalItems={draft.overtimeRules.length}
            />
          </MasterSection>

          <div className="settings-actions">
            <button disabled={disabled || !masterChanged(masterData, draft)} onClick={handleSave} type="button">
              {isSaving ? "Menyimpan..." : "Simpan Master Absensi"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type RowActionButtonProps = {
  canRemove: boolean;
  disabled: boolean;
  onRemove: () => void;
};

function RowActionButton({ canRemove, disabled, onRemove }: RowActionButtonProps) {
  return (
    <div className="master-row-actions">
      {canRemove ? (
        <button className="master-row-action" disabled={disabled} onClick={onRemove} type="button">
          Hapus Baris
        </button>
      ) : null}
    </div>
  );
}

function isNewShift(masterData: AttendanceMasterData | null, id: string): boolean {
  return masterData ? !masterData.shifts.some((shift) => shift.id === id) : false;
}

function isNewAttendanceCode(masterData: AttendanceMasterData | null, id: string): boolean {
  return masterData ? !masterData.attendanceCodes.some((code) => code.id === id) : false;
}

function isNewOvertimeRule(masterData: AttendanceMasterData | null, id: string): boolean {
  return masterData ? !masterData.overtimeRules.some((rule) => rule.id === id) : false;
}

function masterChanged(current: AttendanceMasterData | null, draft: AttendanceMasterData): boolean {
  return current ? JSON.stringify(current) !== JSON.stringify(draft) : false;
}

function clampPage(page: number, totalItems: number): number {
  return Math.min(page, Math.max(1, Math.ceil(totalItems / MASTER_PAGE_SIZE)));
}

function toActor(session: AuthSession): AttendanceMasterActor {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}
