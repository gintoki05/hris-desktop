import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FormattedAmountInput } from "../../../components/shared/FormattedAmountInput";
import { formatRupiah } from "../../../lib/formatters/currency";
import type { AuthSession } from "../../auth/types";
import { listActiveEmployees } from "../../employees/services/employee.service";
import type { Employee } from "../../employees/types";
import { calculatePayrollSnapshot } from "../services/payroll-calculation.service";
import {
  finalizeManualPayrollDraft,
  getFinalizedManualPayroll,
  getManualPayrollDraft,
  saveManualPayrollDraftInput,
} from "../services/manual-payroll.service";
import type { PayrollComponentAmount } from "../types";

type ManualPayrollPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

type PayrollRowDraft = {
  selected: boolean;
  income: Record<string, number>;
  deductions: Record<string, number>;
};

type PayrollPeriodStatus = "new" | "draft" | "finalized";

const INCOME_COMPONENTS = [
  "Gaji Pokok",
  "Tunjangan Kinerja",
  "Tunjangan Tidak Tetap",
  "Jasa Tindakan",
  "Uang Makan",
  "Lembur",
] as const;

const DEDUCTION_COMPONENTS = [
  "Pajak PPh21",
  "BPJS Kesehatan",
  "BPJS TK",
  "Potongan Kasbon",
  "Potongan Absen",
  "Potongan Terlambat",
] as const;

export function ManualPayrollPanel({ canEdit, session }: ManualPayrollPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periodLabel, setPeriodLabel] = useState(defaultPeriodLabel());
  const [startDate, setStartDate] = useState(defaultPeriodStart());
  const [endDate, setEndDate] = useState(defaultPeriodEnd());
  const [rows, setRows] = useState<Record<string, PayrollRowDraft>>({});
  const [payrollRunId, setPayrollRunId] = useState<string | null>(null);
  const [payrollStatus, setPayrollStatus] = useState<PayrollPeriodStatus>("new");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    listActiveEmployees()
      .then((nextEmployees) => {
        if (!isMounted) {
          return;
        }

        setEmployees(nextEmployees);
        setRows((current) => initializeRows(nextEmployees, current));
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Data karyawan gagal dibaca.");
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPayrollPeriod() {
      try {
        const query = {
          periodLabel,
          periodStart: startDate,
          periodEnd: endDate,
        };
        const draft = await getManualPayrollDraft(query);
        const payroll = draft ?? (await getFinalizedManualPayroll(query));

        if (!isMounted) {
          return;
        }

        if (!payroll) {
          if (isMounted) {
            setPayrollRunId(null);
            setPayrollStatus("new");
            setRows(initializeRows(employees, {}));
            setSuccessMessage(null);
          }
          return;
        }

        const isFinalized = payroll.status === "finalized";
        setPayrollRunId(payroll.payrollRunId);
        setPayrollStatus(isFinalized ? "finalized" : "draft");
        setRows((current) => applyDraftRows(initializeRows(employees, current), payroll.items));
        setSuccessMessage(
          isFinalized
            ? `Payroll final ${payroll.periodLabel} dimuat dari snapshot slip.`
            : `Draft payroll ${payroll.periodLabel} dimuat.`,
        );
      } catch {
        if (isMounted) {
          setPayrollRunId(null);
          setPayrollStatus("new");
        }
      }
    }

    void loadPayrollPeriod();

    return () => {
      isMounted = false;
    };
  }, [employees, endDate, periodLabel, startDate]);

  const canEditPayroll = canEdit && payrollStatus !== "finalized";

  const selectedCount = useMemo(
    () => Object.values(rows).filter((row) => row.selected).length,
    [rows],
  );
  const allEmployeesSelected = employees.length > 0 && selectedCount === employees.length;

  const totalNetPay = useMemo(
    () =>
      employees.reduce((total, employee) => {
        const row = rows[employee.id];
        return row?.selected ? total + calculateRow(employee.id, row).netPay : total;
      }, 0),
    [employees, rows],
  );

  function updateAmount(employeeId: string, group: "income" | "deductions", name: string, value: number) {
    setRows((current) => ({
      ...current,
      [employeeId]: {
        ...current[employeeId],
        [group]: {
          ...current[employeeId][group],
          [name]: value,
        },
      },
    }));
  }

  function updateSelected(employeeId: string, selected: boolean) {
    setRows((current) => ({
      ...current,
      [employeeId]: {
        ...current[employeeId],
        selected,
      },
    }));
  }

  function updateAllSelected(selected: boolean) {
    setRows((current) =>
      Object.fromEntries(
        Object.entries(current).map(([employeeId, row]) => [
          employeeId,
          {
            ...row,
            selected,
          },
        ]),
      ),
    );
  }

  async function handleFinalize() {
    if (!canEditPayroll || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const selectedItems = employees
        .filter((employee) => rows[employee.id]?.selected)
        .map((employee) => ({
          employeeId: employee.id,
          incomeComponents: toComponents(rows[employee.id].income),
          deductionComponents: toComponents(rows[employee.id].deductions),
        }));

      if (selectedItems.length === 0) {
        throw new Error("Pilih minimal satu karyawan untuk finalisasi payroll.");
      }

      const run = await finalizeManualPayrollDraft({
        payrollRunId,
        period: {
          label: periodLabel,
          startDate,
          endDate,
        },
        items: selectedItems,
        actor: {
          userId: session.user.id,
          displayName: session.user.displayName,
          role: session.user.role,
        },
      });

      setSuccessMessage(`Payroll ${run.periodLabel} final untuk ${run.employeeCount} karyawan.`);
      setPayrollRunId(run.id);
      setPayrollStatus("finalized");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Payroll gagal difinalisasi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (!canEditPayroll || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const selectedItems = employees
        .filter((employee) => rows[employee.id]?.selected)
        .map((employee) => ({
          employeeId: employee.id,
          incomeComponents: toComponents(rows[employee.id].income),
          deductionComponents: toComponents(rows[employee.id].deductions),
        }));

      if (selectedItems.length === 0) {
        throw new Error("Pilih minimal satu karyawan untuk menyimpan draft payroll.");
      }

      const draft = await saveManualPayrollDraftInput({
        payrollRunId,
        period: {
          label: periodLabel,
          startDate,
          endDate,
        },
        items: selectedItems,
        actor: {
          userId: session.user.id,
          displayName: session.user.displayName,
          role: session.user.role,
        },
      });

      setPayrollRunId(draft.payrollRunId);
      setPayrollStatus("draft");
      setSuccessMessage(`Draft payroll ${draft.periodLabel} tersimpan.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Draft payroll gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel" aria-label="Finalisasi payroll manual">
      <div className="panel-header">
        <h2>Payroll Manual</h2>
        <span className="status-pill">{canEditPayroll ? "Finalisasi batch" : "Readonly"}</span>
      </div>

      {!canEdit ? <p className="readonly-note">Role saat ini hanya bisa melihat payroll.</p> : null}
      {payrollStatus === "finalized" ? (
        <p className="readonly-note">Payroll periode ini sudah final. Data ditampilkan readonly dari snapshot slip.</p>
      ) : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      <div className="payroll-toolbar">
        <label>
          Label periode
          <input value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} />
        </label>
        <label>
          Tanggal mulai
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          Tanggal selesai
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <button disabled={!canEditPayroll || isSaving || selectedCount === 0} onClick={() => void handleSaveDraft()} type="button">
          {isSaving ? "Menyimpan..." : "Simpan Draft"}
        </button>
        <button disabled={!canEditPayroll || isSaving || selectedCount === 0} onClick={() => void handleFinalize()} type="button">
          {isSaving ? "Finalisasi..." : "Finalisasi Payroll"}
        </button>
      </div>

      <div className="payroll-summary">
        <label className="inline-check payroll-select-all">
          <input
            checked={allEmployeesSelected}
            disabled={!canEditPayroll || isSaving || employees.length === 0}
            onChange={(event) => updateAllSelected(event.target.checked)}
            type="checkbox"
          />
          Pilih semua karyawan
        </label>
        <span>Karyawan dipilih: <strong>{selectedCount}</strong></span>
        <span>Total gaji bersih: <strong>{formatRupiah(totalNetPay)}</strong></span>
        <span>Status: <strong>{getPayrollStatusLabel(payrollStatus, payrollRunId)}</strong></span>
      </div>

      <div className="payroll-table-wrap">
        {isLoading ? <p className="status-note">Membaca karyawan aktif...</p> : null}
        <table className="payroll-table">
          <thead>
            <tr>
              <th>Pilih</th>
              <th>Karyawan</th>
              {INCOME_COMPONENTS.map((component) => <th key={component}>{component}</th>)}
              {DEDUCTION_COMPONENTS.map((component) => <th key={component}>{component}</th>)}
              <th>Gaji Bersih</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const row = rows[employee.id];
              const snapshot = row ? calculateRow(employee.id, row) : null;

              return (
                <tr key={employee.id}>
                  <td>
                    <input
                      checked={row?.selected ?? false}
                      disabled={!canEditPayroll || isSaving}
                      onChange={(event) => updateSelected(employee.id, event.target.checked)}
                      type="checkbox"
                    />
                  </td>
                  <td>
                    <strong>{employee.name}</strong>
                    <span>{employee.nik}</span>
                  </td>
                  {INCOME_COMPONENTS.map((component) => (
                    <td key={component}>
                      <FormattedAmountInput
                        disabled={!canEditPayroll || isSaving}
                        onChange={(value) => updateAmount(employee.id, "income", component, value)}
                        value={row?.income[component] ?? 0}
                      />
                    </td>
                  ))}
                  {DEDUCTION_COMPONENTS.map((component) => (
                    <td key={component}>
                      <FormattedAmountInput
                        disabled={!canEditPayroll || isSaving}
                        onChange={(value) => updateAmount(employee.id, "deductions", component, value)}
                        value={row?.deductions[component] ?? 0}
                      />
                    </td>
                  ))}
                  <td>{formatRupiah(snapshot?.netPay ?? 0)}</td>
                </tr>
              );
            })}
            {!isLoading && employees.length === 0 ? (
              <tr>
                <td colSpan={15}>Belum ada karyawan aktif untuk payroll.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function applyDraftRows(
  currentRows: Record<string, PayrollRowDraft>,
  items: Array<{
    employeeId: string;
    incomeComponents: PayrollComponentAmount[];
    deductionComponents: PayrollComponentAmount[];
  }>,
): Record<string, PayrollRowDraft> {
  const nextRows = Object.fromEntries(
    Object.entries(currentRows).map(([employeeId, row]) => [
      employeeId,
      {
        ...row,
        selected: false,
      },
    ]),
  );

  for (const item of items) {
    if (!nextRows[item.employeeId]) {
      nextRows[item.employeeId] = {
        selected: true,
        income: Object.fromEntries(INCOME_COMPONENTS.map((name) => [name, 0])),
        deductions: Object.fromEntries(DEDUCTION_COMPONENTS.map((name) => [name, 0])),
      };
    }

    nextRows[item.employeeId] = {
      selected: true,
      income: {
        ...nextRows[item.employeeId].income,
        ...Object.fromEntries(item.incomeComponents.map((component) => [component.name, component.amount])),
      },
      deductions: {
        ...nextRows[item.employeeId].deductions,
        ...Object.fromEntries(item.deductionComponents.map((component) => [component.name, component.amount])),
      },
    };
  }

  return nextRows;
}

function getPayrollStatusLabel(status: PayrollPeriodStatus, payrollRunId: string | null): string {
  if (status === "finalized") {
    return "Final";
  }

  if (status === "draft" || payrollRunId) {
    return "Draft tersimpan";
  }

  return "Baru";
}

function initializeRows(
  employees: Employee[],
  currentRows: Record<string, PayrollRowDraft>,
): Record<string, PayrollRowDraft> {
  return Object.fromEntries(
    employees.map((employee) => [
      employee.id,
      currentRows[employee.id] ?? {
        selected: true,
        income: Object.fromEntries(INCOME_COMPONENTS.map((name) => [name, 0])),
        deductions: Object.fromEntries(DEDUCTION_COMPONENTS.map((name) => [name, 0])),
      },
    ]),
  );
}

function calculateRow(employeeId: string, row: PayrollRowDraft) {
  return calculatePayrollSnapshot({
    id: `draft-${employeeId}`,
    employeeId,
    period: {
      id: "draft",
      label: "",
      startDate: "",
      endDate: "",
    },
    incomeComponents: toComponents(row.income),
    deductionComponents: toComponents(row.deductions),
    finalizedAt: "",
  });
}

function toComponents(values: Record<string, number>): PayrollComponentAmount[] {
  return Object.entries(values).map(([name, amount]) => ({
    name,
    amount,
  }));
}

function defaultPeriodLabel(): string {
  return new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function defaultPeriodStart(): string {
  const now = new Date();
  return formatDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function defaultPeriodEnd(): string {
  const now = new Date();
  return formatDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
