import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { PaginationControls } from "../../../components/shared/PaginationControls";
import { getAttendanceMasterData } from "../../attendance/services/attendance-master.service";
import type { WorkShift } from "../../attendance/types";
import type { AuthSession } from "../../auth/types";
import { getOrganizationMasterData } from "../../organization/services/organization-master.service";
import type { OrganizationMasterData } from "../../organization/types";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeTable } from "./EmployeeTable";
import { FOLLOW_MONTHLY_SCHEDULE_LABEL } from "../constants";
import { exportEmployeeCsv } from "../services/employee-export.service";
import {
  createEmployee,
  deactivateEmployee,
  listEmployees,
  updateEmployee,
} from "../services/employee.service";
import type { Employee, EmployeeActor, EmployeeInput } from "../types";

type EmployeeMasterPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

const EMPLOYEE_PAGE_SIZE = 5;

export function EmployeeMasterPanel({ canEdit, session }: EmployeeMasterPanelProps) {
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );
  const totalPages = Math.max(1, Math.ceil(employees.length / EMPLOYEE_PAGE_SIZE));
  const paginatedEmployees = useMemo(
    () => employees.slice((currentPage - 1) * EMPLOYEE_PAGE_SIZE, currentPage * EMPLOYEE_PAGE_SIZE),
    [currentPage, employees],
  );

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
    if (!isEmployeeModalOpen || isSaving) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCloseEmployeeModal();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEmployeeModalOpen, isSaving]);

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

  const disabled = !canEdit || isSaving;

  return (
    <section className="panel" aria-label="Master karyawan dan struktur organisasi">
      <div className="panel-header">
        <h2>Master Karyawan</h2>
        <span className="status-pill">{canEdit ? "Admin bisa edit" : "Readonly"}</span>
      </div>

      {!canEdit ? (
        <p className="readonly-note">Role saat ini hanya bisa melihat dan mencari data karyawan.</p>
      ) : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      <div className="employee-content">
        <div className="employee-toolbar">
          <label className="employee-search">
            Cari karyawan
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nama, NIK, departemen, jabatan"
              value={query}
            />
          </label>
          <label className="inline-check">
            <input
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              type="checkbox"
            />
            Tampilkan nonaktif
          </label>
          <button disabled={employees.length === 0} onClick={() => exportEmployeeCsv(employees)} type="button">
            Export CSV Audit
          </button>
          {canEdit ? (
            <button onClick={handleNewEmployee} type="button">
              Karyawan Baru
            </button>
          ) : null}
        </div>

        <div className="employee-grid">
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

          {isEmployeeModalOpen ? (
            <div
              className="employee-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  handleCloseEmployeeModal();
                }
              }}
            >
              <div
                aria-labelledby="employee-modal-title"
                aria-modal="true"
                className="employee-modal"
                role="dialog"
              >
                <div className="employee-modal-header">
                  <div>
                    <h3 id="employee-modal-title">
                      {selectedEmployee ? "Edit Karyawan" : "Tambah Karyawan"}
                    </h3>
                    <p>{selectedEmployee ? selectedEmployee.name : "Lengkapi data master karyawan baru."}</p>
                  </div>
                  <button disabled={isSaving} onClick={handleCloseEmployeeModal} type="button">
                    Tutup
                  </button>
                </div>

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
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
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
    name: "",
    hireDate: new Date().toISOString().slice(0, 10),
    npwp: "",
    maritalStatus: "single",
    dependents: 0,
    department: "",
    position: "",
    status: "active",
    employmentType: "monthly",
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
    name: employee.name,
    hireDate: employee.hireDate,
    npwp: employee.npwp,
    maritalStatus: employee.maritalStatus,
    dependents: employee.dependents,
    department: employee.department,
    position: employee.position,
    status: employee.status,
    employmentType: employee.employmentType,
    paymentMethod: employee.paymentMethod,
    pph21Enabled: employee.pph21Enabled,
    shiftType: employee.shiftType,
    workSchedule: employee.workSchedule,
  };
}
