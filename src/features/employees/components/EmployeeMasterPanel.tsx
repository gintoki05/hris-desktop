import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Upload } from "lucide-react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FeaturePanel, PanelBody, PanelNote, StatusBadge } from "../../../components/shared/FeaturePanel";
import { PaginationControls } from "../../../components/shared/PaginationControls";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { getAttendanceMasterData } from "../../attendance/services/attendance-master.service";
import type { WorkShift } from "../../attendance/types";
import type { AuthSession } from "../../auth/types";
import { getOrganizationMasterData } from "../../organization/services/organization-master.service";
import type { OrganizationMasterData } from "../../organization/types";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeImportPreviewPanel } from "./EmployeeImportPreviewPanel";
import { EmployeeTable } from "./EmployeeTable";
import { FOLLOW_MONTHLY_SCHEDULE_LABEL } from "../constants";
import {
  exportEmployeeImportTemplate,
  previewEmployeeImportWorkbook,
  type EmployeeImportPreview,
} from "../services/employee-excel.service";
import {
  createEmployee,
  deactivateEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
} from "../services/employee.service";
import type { Employee, EmployeeActor, EmployeeInput } from "../types";

type EmployeeMasterPanelProps = {
  canEdit: boolean;
  openEmployeeRequest?: { employeeId: string; requestId: number } | null;
  session: AuthSession;
};

const EMPLOYEE_PAGE_SIZE = 5;

export function EmployeeMasterPanel({ canEdit, openEmployeeRequest, session }: EmployeeMasterPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [organizationMaster, setOrganizationMaster] = useState<OrganizationMasterData>({
    departments: [],
    positions: [],
  });
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmployeeInput>(() => createEmptyEmployeeDraft([]));
  const [importPreview, setImportPreview] = useState<EmployeeImportPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );
  const totalPages = Math.max(1, Math.ceil(employees.length / EMPLOYEE_PAGE_SIZE));
  const paginatedEmployees = useMemo(
    () => employees.slice((currentPage - 1) * EMPLOYEE_PAGE_SIZE, currentPage * EMPLOYEE_PAGE_SIZE),
    [currentPage, employees],
  );
  const importSummary = useMemo(() => {
    const rows = importPreview?.rows ?? [];
    return {
      createCount: rows.filter((row) => row.status === "valid" && row.action === "create").length,
      errorCount: rows.filter((row) => row.status === "error").length,
      updateCount: rows.filter((row) => row.status === "valid" && row.action === "update").length,
      validCount: rows.filter((row) => row.status === "valid").length,
    };
  }, [importPreview]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getOrganizationMasterData(), getAttendanceMasterData()])
      .then(([nextOrganizationMaster, nextAttendanceMaster]) => {
        if (!isMounted) {
          return;
        }

        setOrganizationMaster(nextOrganizationMaster);
        setWorkShifts(nextAttendanceMaster.shifts);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Master referensi karyawan gagal dibaca.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [includeInactive, query]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    listEmployees({ query, includeInactive })
      .then((nextEmployees) => {
        if (!isMounted) {
          return;
        }

        setEmployees(nextEmployees);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Data karyawan gagal dibaca.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [includeInactive, query]);

  useEffect(() => {
    if (!openEmployeeRequest) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    getEmployeeById(openEmployeeRequest.employeeId)
      .then(async (employee) => {
        if (!isMounted) {
          return;
        }

        if (!employee) {
          setErrorMessage("Data karyawan tidak ditemukan.");
          return;
        }

        const nextIncludeInactive = employee.status === "inactive";
        const nextEmployees = await listEmployees({ query: "", includeInactive: nextIncludeInactive });
        if (!isMounted) {
          return;
        }

        const employeeIndex = nextEmployees.findIndex((item) => item.id === employee.id);
        setQuery("");
        setIncludeInactive(nextIncludeInactive);
        setEmployees(nextEmployees);
        setCurrentPage(employeeIndex >= 0 ? Math.floor(employeeIndex / EMPLOYEE_PAGE_SIZE) + 1 : 1);
        setSelectedEmployeeId(employee.id);
        setDraft(toEmployeeInput(employee));
        setIsEmployeeModalOpen(true);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Detail karyawan gagal dibuka.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [openEmployeeRequest?.employeeId, openEmployeeRequest?.requestId]);

  async function refreshEmployees(nextSelectedId?: string | null, nextIncludeInactive = includeInactive) {
    const nextEmployees = await listEmployees({ query, includeInactive: nextIncludeInactive });
    setEmployees(nextEmployees);
    setSelectedEmployeeId(nextSelectedId ?? null);
  }

  async function handleSubmit() {
    if (!canEdit) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const actor = toEmployeeActor(session);
      const savedEmployee = selectedEmployee
        ? await updateEmployee(selectedEmployee.id, draft, actor)
        : await createEmployee(draft, actor);

      await refreshEmployees(savedEmployee.id);
      setDraft(toEmployeeInput(savedEmployee));
      setIsEmployeeModalOpen(false);
      setSuccessMessage(selectedEmployee ? "Data karyawan diperbarui." : "Karyawan baru tersimpan.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Data karyawan gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!canEdit || !selectedEmployee || selectedEmployee.status === "inactive") {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const inactiveEmployee = await deactivateEmployee(selectedEmployee.id, toEmployeeActor(session));
      setIncludeInactive(true);
      await refreshEmployees(inactiveEmployee.id, true);
      setDraft(toEmployeeInput(inactiveEmployee));
      setIsEmployeeModalOpen(false);
      setSuccessMessage("Karyawan dinonaktifkan dan tidak masuk payroll baru secara default.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Karyawan gagal dinonaktifkan.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelect(employee: Employee) {
    setSelectedEmployeeId(employee.id);
    setDraft(toEmployeeInput(employee));
    setIsEmployeeModalOpen(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleNewEmployee() {
    setSelectedEmployeeId(null);
    setDraft(createEmptyEmployeeDraft(workShifts));
    setIsEmployeeModalOpen(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  async function handleImportFileChange(file: File | undefined) {
    if (!file) {
      return;
    }

    setIsImporting(true);
    setImportPreview(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const allEmployees = await listEmployees({ query: "", includeInactive: true });
      const existingNik = new Set(allEmployees.map((employee) => normalizeKey(employee.nik)));
      const preview = await previewEmployeeImportWorkbook(file, {
        hasNik: (nik) => existingNik.has(normalizeKey(nik)),
      });

      setImportPreview(preview);
      setSuccessMessage("Preview import karyawan siap dicek sebelum disimpan.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "File import karyawan gagal dibaca.");
    } finally {
      setIsImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  }

  async function handleSaveImportPreview() {
    if (!canEdit || !importPreview) {
      return;
    }

    const validRows = importPreview.rows.filter((row) => row.status === "valid" && row.input);
    if (validRows.length === 0) {
      setErrorMessage("Tidak ada baris valid untuk disimpan.");
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const actor = toEmployeeActor(session);
      const allEmployees = await listEmployees({ query: "", includeInactive: true });
      const employeesByNik = new Map(allEmployees.map((employee) => [normalizeKey(employee.nik), employee]));

      for (const row of validRows) {
        const input = row.input;
        if (!input) {
          continue;
        }

        const existingEmployee = employeesByNik.get(normalizeKey(input.nik));
        if (existingEmployee) {
          await updateEmployee(existingEmployee.id, input, actor);
        } else {
          const createdEmployee = await createEmployee(input, actor);
          employeesByNik.set(normalizeKey(createdEmployee.nik), createdEmployee);
        }
      }

      await refreshEmployees(null);
      setImportPreview(null);
      setSuccessMessage(
        `Import karyawan tersimpan: ${importSummary.createCount} baru, ${importSummary.updateCount} diperbarui.`,
      );
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Import karyawan gagal disimpan.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleCloseEmployeeModal() {
    if (isSaving) {
      return;
    }

    setIsEmployeeModalOpen(false);
    setSelectedEmployeeId(null);
    setDraft(createEmptyEmployeeDraft(workShifts));
  }

  function updateDraft<K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const disabled = !canEdit || isSaving || isImporting;

  return (
    <FeaturePanel
      aria-label="Master karyawan dan struktur organisasi"
      badge={<StatusBadge>{canEdit ? "Admin bisa edit" : "Readonly"}</StatusBadge>}
      title="Master Karyawan"
    >
      <PanelBody>

      {!canEdit ? (
        <PanelNote tone="warning">Role saat ini hanya bisa melihat dan mencari data karyawan.</PanelNote>
      ) : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-64 flex-1 gap-2 text-sm font-medium text-foreground">
            Cari karyawan
            <Input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nama, NIK, departemen, jabatan"
              value={query}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium text-foreground">
            <Checkbox
              checked={includeInactive}
              onCheckedChange={(checked) => setIncludeInactive(checked === true)}
            />
            Tampilkan nonaktif
          </label>
          <Button onClick={exportEmployeeImportTemplate} type="button" variant="outline">
            <FileDown aria-hidden="true" />
            Template Excel
          </Button>
          {canEdit ? (
            <>
              <Input
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => void handleImportFileChange(event.target.files?.[0])}
                ref={importFileInputRef}
                type="file"
              />
              <Button
                disabled={disabled}
                onClick={() => importFileInputRef.current?.click()}
                type="button"
                variant="outline"
              >
                <Upload aria-hidden="true" />
                Import Excel
              </Button>
            </>
          ) : null}
          {canEdit ? (
            <Button onClick={handleNewEmployee} type="button">
              Karyawan Baru
            </Button>
          ) : null}
        </div>

        <div className="employee-grid">
          {importPreview ? (
            <EmployeeImportPreviewPanel
              disabled={disabled}
              importPreview={importPreview}
              importSummary={importSummary}
              isImporting={isImporting}
              onCancel={() => setImportPreview(null)}
              onSave={() => void handleSaveImportPreview()}
            />
          ) : null}

          <EmployeeTable
            employees={paginatedEmployees}
            isLoading={isLoading}
            onSelect={handleSelect}
            selectedEmployeeId={selectedEmployeeId}
          />

          <PaginationControls
            ariaLabel="Pagination karyawan"
            currentPage={currentPage}
            itemLabel="karyawan"
            onPageChange={setCurrentPage}
            pageSize={EMPLOYEE_PAGE_SIZE}
            totalItems={employees.length}
          />

          <Dialog
            open={isEmployeeModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                handleCloseEmployeeModal();
              }
            }}
          >
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>{selectedEmployee ? "Edit Karyawan" : "Tambah Karyawan"}</DialogTitle>
                <DialogDescription>
                  {selectedEmployee ? selectedEmployee.name : "Lengkapi data master karyawan baru."}
                </DialogDescription>
              </DialogHeader>

              <EmployeeForm
                departments={organizationMaster.departments}
                disabled={disabled}
                draft={draft}
                isSaving={isSaving}
                onDeactivate={() => void handleDeactivate()}
                onSubmit={() => void handleSubmit()}
                onUpdateDraft={updateDraft}
                positions={organizationMaster.positions}
                selectedEmployee={selectedEmployee}
                workShifts={workShifts}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      </PanelBody>
    </FeaturePanel>
  );
}

function toEmployeeActor(session: AuthSession): EmployeeActor {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}

function createEmptyEmployeeDraft(workShifts: WorkShift[]): EmployeeInput {
  return {
    nik: "",
    whatsappNumber: "",
    email: "",
    portalUserId: "",
    name: "",
    hireDate: new Date().toISOString().slice(0, 10),
    npwp: "",
    maritalStatus: "single",
    dependents: 0,
    department: "",
    position: "",
    status: "active",
    employmentType: "monthly",
    salaryAmount: 0,
    paymentMethod: "cash",
    pph21Enabled: true,
    shiftType: "non_shift",
    workSchedule: getNonShiftDefaultSchedule(workShifts),
  };
}

function getNonShiftDefaultSchedule(workShifts: WorkShift[]): string {
  const nonShift = workShifts.find((shift) => shift.isActive && shift.code === "NONSHIFT");
  if (!nonShift) {
    return FOLLOW_MONTHLY_SCHEDULE_LABEL;
  }

  return nonShift.isOff
    ? `${nonShift.name} (Off)`
    : `${nonShift.name} (${nonShift.startTime}-${nonShift.endTime})`;
}

function toEmployeeInput(employee: Employee): EmployeeInput {
  return {
    nik: employee.nik,
    whatsappNumber: employee.whatsappNumber,
    email: employee.email,
    portalUserId: employee.portalUserId,
    name: employee.name,
    hireDate: employee.hireDate,
    npwp: employee.npwp,
    maritalStatus: employee.maritalStatus,
    dependents: employee.dependents,
    department: employee.department,
    position: employee.position,
    status: employee.status,
    employmentType: employee.employmentType,
    salaryAmount: employee.salaryAmount,
    paymentMethod: employee.paymentMethod,
    pph21Enabled: employee.pph21Enabled,
    shiftType: employee.shiftType,
    workSchedule: employee.workSchedule,
  };
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
