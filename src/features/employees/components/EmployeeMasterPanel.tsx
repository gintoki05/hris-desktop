import { useEffect, useMemo, useState } from "react";
import type { AuthSession } from "../../auth/types";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeTable } from "./EmployeeTable";
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

const emptyEmployeeDraft: EmployeeInput = {
  nik: "",
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
  workSchedule: "Regular",
};

export function EmployeeMasterPanel({ canEdit, session }: EmployeeMasterPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmployeeInput>(emptyEmployeeDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

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
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleNewEmployee() {
    setSelectedEmployeeId(null);
    setDraft(emptyEmployeeDraft);
    setSuccessMessage(null);
    setErrorMessage(null);
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
      {errorMessage ? <p className="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="success-alert">{successMessage}</p> : null}

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
            employees={employees}
            isLoading={isLoading}
            onSelect={handleSelect}
            selectedEmployeeId={selectedEmployeeId}
          />

          <EmployeeForm
            disabled={disabled}
            draft={draft}
            isSaving={isSaving}
            onDeactivate={() => void handleDeactivate()}
            onSubmit={() => void handleSubmit()}
            onUpdateDraft={updateDraft}
            selectedEmployee={selectedEmployee}
          />
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

function toEmployeeInput(employee: Employee): EmployeeInput {
  return {
    nik: employee.nik,
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
