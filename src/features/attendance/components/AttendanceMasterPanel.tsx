import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import {
  FeaturePanel,
  PanelBody,
  PanelNote,
  StatusBadge,
} from "../../../components/shared/FeaturePanel";
import { PaginationControls } from "../../../components/shared/PaginationControls";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
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
  WorkShift,
} from "../types";

type AttendanceMasterPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

type AddMasterKind = "shift" | "attendanceCode" | "overtimeRule";
type AddMasterDraft =
  | { kind: "shift"; value: WorkShift }
  | { kind: "attendanceCode"; value: AttendanceCode }
  | { kind: "overtimeRule"; value: OvertimeRule };

const MASTER_PAGE_SIZE = 5;

export function AttendanceMasterPanel({ canEdit, session }: AttendanceMasterPanelProps) {
  const [masterData, setMasterData] = useState<AttendanceMasterData | null>(null);
  const [draft, setDraft] = useState<AttendanceMasterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shiftPage, setShiftPage] = useState(1);
  const [attendanceCodePage, setAttendanceCodePage] = useState(1);
  const [overtimeRulePage, setOvertimeRulePage] = useState(1);
  const [addDraft, setAddDraft] = useState<AddMasterDraft | null>(null);
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

  useEffect(() => {
    if (!addDraft || isSaving) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCloseAddModal();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [addDraft, isSaving]);

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

  function handleOpenAddModal(kind: AddMasterKind) {
    if (!draft || !canEdit) {
      return;
    }

    if (kind === "shift") {
      setAddDraft({ kind, value: createNewShift(draft.shifts) });
      return;
    }

    if (kind === "attendanceCode") {
      setAddDraft({ kind, value: createNewAttendanceCode(draft.attendanceCodes) });
      return;
    }

    setAddDraft({ kind, value: createNewOvertimeRule(draft.overtimeRules) });
  }

  function handleCloseAddModal() {
    if (isSaving) {
      return;
    }

    setAddDraft(null);
  }

  function handleConfirmAddModal() {
    if (!draft || !addDraft || !canEdit) {
      return;
    }

    if (addDraft.kind === "shift") {
      setDraft({ ...draft, shifts: [...draft.shifts, addDraft.value] });
      setShiftPage(Math.max(1, Math.ceil((draft.shifts.length + 1) / MASTER_PAGE_SIZE)));
      setAddDraft(null);
      return;
    }

    if (addDraft.kind === "attendanceCode") {
      setDraft({ ...draft, attendanceCodes: [...draft.attendanceCodes, addDraft.value] });
      setAttendanceCodePage(Math.max(1, Math.ceil((draft.attendanceCodes.length + 1) / MASTER_PAGE_SIZE)));
      setAddDraft(null);
      return;
    }

    setDraft({ ...draft, overtimeRules: [...draft.overtimeRules, addDraft.value] });
    setOvertimeRulePage(Math.max(1, Math.ceil((draft.overtimeRules.length + 1) / MASTER_PAGE_SIZE)));
    setAddDraft(null);
  }

  function updateAddDraft(patch: Partial<WorkShift> | Partial<AttendanceCode> | Partial<OvertimeRule>) {
    setAddDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        value: {
          ...current.value,
          ...patch,
        },
      } as AddMasterDraft;
    });
  }

  const disabled = !canEdit || isSaving || isLoading;
  const hasShiftChanges = draft ? sectionChanged(masterData?.shifts, draft.shifts) : false;
  const hasAttendanceCodeChanges = draft
    ? sectionChanged(masterData?.attendanceCodes, draft.attendanceCodes)
    : false;
  const hasOvertimeRuleChanges = draft
    ? sectionChanged(masterData?.overtimeRules, draft.overtimeRules)
    : false;

  return (
    <FeaturePanel
      aria-label="Master shift dan kode absensi"
      badge={<StatusBadge>{canEdit ? "Admin bisa edit" : "Readonly"}</StatusBadge>}
      title="Master Shift & Absensi"
    >
      <PanelBody>
        {isLoading ? <PanelNote>Membaca master absensi lokal...</PanelNote> : null}
        {!canEdit ? (
          <PanelNote>Role saat ini hanya bisa melihat master shift dan absensi.</PanelNote>
        ) : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

        {draft ? (
          <div className="attendance-master-content">
          <MasterSection
            addDisabled={disabled}
            actionLabel="Tambah Shift"
            canEdit={canEdit}
            description="Gunakan Hari libur / off untuk jadwal tidak bekerja. Gunakan Masih digunakan untuk menentukan apakah shift masih boleh dipilih di data baru."
            itemCount={draft.shifts.length}
            saveDisabled={disabled || !hasShiftChanges}
            saveLabel={isSaving ? "Menyimpan..." : "Simpan Shift"}
            title="Shift & Jam Kerja"
            onAdd={() => handleOpenAddModal("shift")}
            onSave={() => void handleSave()}
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
                  <div className="master-shift-flags" aria-label="Status shift">
                    <span>Status shift</span>
                    <div>
                      <BooleanInput
                        checked={shift.isOff}
                        disabled={disabled}
                        label="Hari libur / off"
                        onChange={(value) => updateShift(draftIndex, { isOff: value }, setDraft)}
                      />
                      <BooleanInput
                        checked={shift.isActive}
                        disabled={disabled}
                        label="Masih digunakan"
                        onChange={(value) => updateShift(draftIndex, { isActive: value }, setDraft)}
                      />
                    </div>
                  </div>
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
            addDisabled={disabled}
            actionLabel="Tambah Kode"
            canEdit={canEdit}
            description="Gunakan dampak absensi untuk menentukan apakah kode dihitung sebagai hari kerja, tetap dibayar, dan masih tersedia untuk input baru."
            itemCount={draft.attendanceCodes.length}
            saveDisabled={disabled || !hasAttendanceCodeChanges}
            saveLabel={isSaving ? "Menyimpan..." : "Simpan Kode"}
            title="Kode Absensi"
            onAdd={() => handleOpenAddModal("attendanceCode")}
            onSave={() => void handleSave()}
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
                  <div className="master-attendance-flags" aria-label="Dampak absensi">
                    <span>Dampak absensi</span>
                    <div>
                      <BooleanInput
                        checked={code.countsAsWorkday}
                        disabled={disabled}
                        label="Dihitung hari kerja"
                        onChange={(value) =>
                          updateAttendanceCode(draftIndex, { countsAsWorkday: value }, setDraft)
                        }
                      />
                      <BooleanInput
                        checked={code.isPaid}
                        disabled={disabled}
                        label="Tetap dibayar"
                        onChange={(value) => updateAttendanceCode(draftIndex, { isPaid: value }, setDraft)}
                      />
                      <BooleanInput
                        checked={code.isActive}
                        disabled={disabled}
                        label="Masih digunakan"
                        onChange={(value) => updateAttendanceCode(draftIndex, { isActive: value }, setDraft)}
                      />
                    </div>
                  </div>
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
            addDisabled={disabled}
            actionLabel="Tambah Lembur"
            canEdit={canEdit}
            description="Gunakan multiplier untuk menghitung nilai lembur sesuai aturan klinik. Gunakan Masih digunakan untuk menentukan apakah aturan lembur masih boleh dipilih di input baru."
            itemCount={draft.overtimeRules.length}
            saveDisabled={disabled || !hasOvertimeRuleChanges}
            saveLabel={isSaving ? "Menyimpan..." : "Simpan Lembur"}
            title="Kode & Multiplier Lembur"
            onAdd={() => handleOpenAddModal("overtimeRule")}
            onSave={() => void handleSave()}
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
                  <div className="master-overtime-flags" aria-label="Status aturan lembur">
                    <span>Status aturan</span>
                    <div>
                      <BooleanInput
                        checked={rule.isActive}
                        disabled={disabled}
                        label="Masih digunakan"
                        onChange={(value) => updateOvertimeRule(draftIndex, { isActive: value }, setDraft)}
                      />
                    </div>
                  </div>
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

          {addDraft ? (
            <AddMasterModal
              disabled={disabled}
              draft={addDraft}
              onClose={handleCloseAddModal}
              onConfirm={handleConfirmAddModal}
              onUpdate={updateAddDraft}
            />
          ) : null}
        </div>
        ) : null}
      </PanelBody>
    </FeaturePanel>
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
        <Button
          className="master-row-action"
          disabled={disabled}
          onClick={onRemove}
          size="sm"
          type="button"
          variant="outline"
        >
          Hapus Baris
        </Button>
      ) : null}
    </div>
  );
}

type AddMasterModalProps = {
  disabled: boolean;
  draft: AddMasterDraft;
  onClose: () => void;
  onConfirm: () => void;
  onUpdate: (patch: Partial<WorkShift> | Partial<AttendanceCode> | Partial<OvertimeRule>) => void;
};

function AddMasterModal({ disabled, draft, onClose, onConfirm, onUpdate }: AddMasterModalProps) {
  const title = modalTitleFor(draft.kind);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl p-0" showCloseButton={false}>
        <DialogHeader className="border-b bg-muted/40 p-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Isi data baru, lalu tambahkan ke draft. Klik simpan di section untuk menyimpan ke database lokal.
          </DialogDescription>
        </DialogHeader>

        <div className="master-modal-content">
          {draft.kind === "shift" ? (
            <ShiftModalFields disabled={disabled} shift={draft.value} onUpdate={onUpdate} />
          ) : null}
          {draft.kind === "attendanceCode" ? (
            <AttendanceCodeModalFields disabled={disabled} code={draft.value} onUpdate={onUpdate} />
          ) : null}
          {draft.kind === "overtimeRule" ? (
            <OvertimeRuleModalFields disabled={disabled} rule={draft.value} onUpdate={onUpdate} />
          ) : null}
        </div>

        <DialogFooter className="px-4">
          <Button disabled={disabled} onClick={onClose} type="button" variant="outline">
            Batal
          </Button>
          <Button disabled={disabled} onClick={onConfirm} type="button">
            Tambahkan ke Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ModalFieldProps<T> = {
  disabled: boolean;
  onUpdate: (patch: Partial<T>) => void;
};

function ShiftModalFields({
  disabled,
  onUpdate,
  shift,
}: ModalFieldProps<WorkShift> & { shift: WorkShift }) {
  return (
    <>
      <TextInput disabled={disabled} label="Kode" value={shift.code} onChange={(code) => onUpdate({ code })} />
      <TextInput disabled={disabled} label="Nama" value={shift.name} onChange={(name) => onUpdate({ name })} />
      <TextInput
        disabled={disabled}
        label="Mulai"
        type="time"
        value={shift.startTime}
        onChange={(startTime) => onUpdate({ startTime })}
      />
      <TextInput
        disabled={disabled}
        label="Selesai"
        type="time"
        value={shift.endTime}
        onChange={(endTime) => onUpdate({ endTime })}
      />
      <NumberInput
        disabled={disabled}
        label="Istirahat"
        value={shift.breakMinutes}
        onChange={(breakMinutes) => onUpdate({ breakMinutes })}
      />
      <div className="master-modal-checks">
        <BooleanInput
          checked={shift.isOff}
          disabled={disabled}
          label="Hari libur / off"
          onChange={(isOff) => onUpdate({ isOff })}
        />
        <BooleanInput
          checked={shift.isActive}
          disabled={disabled}
          label="Masih digunakan"
          onChange={(isActive) => onUpdate({ isActive })}
        />
      </div>
    </>
  );
}

function AttendanceCodeModalFields({
  code,
  disabled,
  onUpdate,
}: ModalFieldProps<AttendanceCode> & { code: AttendanceCode }) {
  return (
    <>
      <TextInput disabled={disabled} label="Kode" value={code.code} onChange={(value) => onUpdate({ code: value })} />
      <TextInput disabled={disabled} label="Nama" value={code.name} onChange={(name) => onUpdate({ name })} />
      <SelectInput
        disabled={disabled}
        label="Kategori"
        options={ATTENDANCE_CODE_CATEGORY_OPTIONS}
        value={code.category}
        onChange={(category) => onUpdate({ category: category as AttendanceCode["category"] })}
      />
      <div className="master-modal-checks">
        <BooleanInput
          checked={code.countsAsWorkday}
          disabled={disabled}
          label="Dihitung hari kerja"
          onChange={(countsAsWorkday) => onUpdate({ countsAsWorkday })}
        />
        <BooleanInput
          checked={code.isPaid}
          disabled={disabled}
          label="Tetap dibayar"
          onChange={(isPaid) => onUpdate({ isPaid })}
        />
        <BooleanInput
          checked={code.isActive}
          disabled={disabled}
          label="Masih digunakan"
          onChange={(isActive) => onUpdate({ isActive })}
        />
      </div>
    </>
  );
}

function OvertimeRuleModalFields({
  disabled,
  onUpdate,
  rule,
}: ModalFieldProps<OvertimeRule> & { rule: OvertimeRule }) {
  return (
    <>
      <TextInput disabled={disabled} label="Kode" value={rule.code} onChange={(code) => onUpdate({ code })} />
      <TextInput disabled={disabled} label="Nama" value={rule.name} onChange={(name) => onUpdate({ name })} />
      <SelectInput
        disabled={disabled}
        label="Berlaku"
        options={OVERTIME_APPLIES_TO_OPTIONS}
        value={rule.appliesTo}
        onChange={(appliesTo) => onUpdate({ appliesTo: appliesTo as OvertimeRule["appliesTo"] })}
      />
      <NumberInput
        disabled={disabled}
        label="Multiplier"
        step="0.1"
        value={rule.multiplier}
        onChange={(multiplier) => onUpdate({ multiplier })}
      />
      <div className="master-modal-checks">
        <BooleanInput
          checked={rule.isActive}
          disabled={disabled}
          label="Masih digunakan"
          onChange={(isActive) => onUpdate({ isActive })}
        />
      </div>
    </>
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

function sectionChanged<T>(current: T[] | undefined, draft: T[]): boolean {
  return current ? JSON.stringify(current) !== JSON.stringify(draft) : false;
}

function clampPage(page: number, totalItems: number): number {
  return Math.min(page, Math.max(1, Math.ceil(totalItems / MASTER_PAGE_SIZE)));
}

function createNewShift(shifts: WorkShift[]): WorkShift {
  return {
    id: `shift-${Date.now()}`,
    code: "BARU",
    name: "Shift Baru",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 0,
    isOff: false,
    isActive: true,
    sortOrder: nextSortOrder(shifts),
  };
}

function createNewAttendanceCode(attendanceCodes: AttendanceCode[]): AttendanceCode {
  return {
    id: `attendance-${Date.now()}`,
    code: "BARU",
    name: "Kode Baru",
    category: "present",
    countsAsWorkday: true,
    isPaid: true,
    isActive: true,
    sortOrder: nextSortOrder(attendanceCodes),
  };
}

function createNewOvertimeRule(overtimeRules: OvertimeRule[]): OvertimeRule {
  return {
    id: `overtime-${Date.now()}`,
    code: "LEMBUR_BARU",
    name: "Lembur Baru",
    appliesTo: "workday",
    multiplier: 1,
    isActive: true,
    sortOrder: nextSortOrder(overtimeRules),
  };
}

function nextSortOrder(items: Array<{ sortOrder: number }>): number {
  return Math.max(0, ...items.map((item) => item.sortOrder)) + 10;
}

function modalTitleFor(kind: AddMasterKind): string {
  if (kind === "shift") {
    return "Tambah Shift";
  }

  if (kind === "attendanceCode") {
    return "Tambah Kode Absensi";
  }

  return "Tambah Aturan Lembur";
}

function toActor(session: AuthSession): AttendanceMasterActor {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}
