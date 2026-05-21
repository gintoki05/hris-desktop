import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { AppNotice } from "../../../components/shared/AppNotice";
import {
  FeaturePanel,
  PanelBody,
  PanelNote,
  StatusBadge,
} from "../../../components/shared/FeaturePanel";
import { FormattedAmountInput } from "../../../components/shared/FormattedAmountInput";
import { formatRupiah } from "../../../lib/formatters/currency";
import {
  createCurrentMonthPeriodDefaults,
  formatDisplayDateText,
} from "../../../lib/formatters/date-time";
import {
  listAttendanceSummariesByPeriod,
  type AttendanceSummary,
} from "../../attendance/services/attendance-summary.service";
import type { AuthSession } from "../../auth/types";
import { listActiveEmployees } from "../../employees/services/employee.service";
import type { Employee } from "../../employees/types";
import { calculatePayrollSnapshot } from "../services/payroll-calculation.service";
import {
  finalizeManualPayrollDraft,
  getFinalizedManualPayroll,
  getLatestManualPayrollBefore,
  getManualPayrollDraft,
  saveManualPayrollDraftInput,
} from "../services/manual-payroll.service";
import { BASE_SALARY_COMPONENT_NAME, DEDUCTION_COMPONENT_NAMES, INCOME_COMPONENT_NAMES } from "../constants";
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

const LAST_PAYROLL_PERIOD_STORAGE_KEY = "hris_last_payroll_period";

export function ManualPayrollPanel({ canEdit, session }: ManualPayrollPanelProps) {
  const initialPeriod = useMemo(() => readLastPayrollPeriod(), []);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periodLabel, setPeriodLabel] = useState(initialPeriod.label);
  const [startDate, setStartDate] = useState(initialPeriod.startDate);
  const [endDate, setEndDate] = useState(initialPeriod.endDate);
  const [rows, setRows] = useState<Record<string, PayrollRowDraft>>({});
  const [attendanceSummaries, setAttendanceSummaries] = useState<AttendanceSummary[]>([]);
  const [payrollRunId, setPayrollRunId] = useState<string | null>(null);
  const [payrollStatus, setPayrollStatus] = useState<PayrollPeriodStatus>("new");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAttendanceSummary, setIsLoadingAttendanceSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopyingPreviousPayroll, setIsCopyingPreviousPayroll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [carryForwardMessage, setCarryForwardMessage] = useState<string | null>(null);

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
    saveLastPayrollPeriod({
      label: periodLabel,
      startDate,
      endDate,
    });
  }, [endDate, periodLabel, startDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadPayrollPeriod() {
      if (isLoading) {
        return;
      }

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

        if (payroll) {
          const isFinalized = payroll.status === "finalized";
          setPayrollRunId(payroll.payrollRunId);
          setPayrollStatus(isFinalized ? "finalized" : "draft");
          setRows((current) => applyDraftRows(initializeRows(employees, current), payroll.items));
          setCarryForwardMessage(null);
          setSuccessMessage(
            isFinalized
              ? `Data payroll ${formatDisplayDateText(payroll.periodLabel)} berhasil dibuka. Periode ini sudah final.`
              : `Draft payroll ${formatDisplayDateText(payroll.periodLabel)} dimuat.`,
          );
          return;
        }

        setPayrollRunId(null);
        setPayrollStatus("new");
        setSuccessMessage(null);
        setRows(initializeRows(employees, {}));
        setCarryForwardMessage(null);
      } catch (error: unknown) {
        if (isMounted) {
          setPayrollRunId(null);
          setPayrollStatus("new");
          setCarryForwardMessage(null);
          setErrorMessage(error instanceof Error ? error.message : "Draft payroll gagal dibaca.");
        }
      }
    }

    void loadPayrollPeriod();

    return () => {
      isMounted = false;
    };
  }, [employees, endDate, isLoading, periodLabel, startDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadAttendanceSummary() {
      if (isLoading || !startDate || !endDate) {
        return;
      }

      setIsLoadingAttendanceSummary(true);

      try {
        const summaries = await listAttendanceSummariesByPeriod({
          periodStart: startDate,
          periodEnd: endDate,
        });

        if (isMounted) {
          setAttendanceSummaries(summaries);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setAttendanceSummaries([]);
          setErrorMessage(error instanceof Error ? error.message : "Rekap absensi payroll gagal dibaca.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingAttendanceSummary(false);
        }
      }
    }

    void loadAttendanceSummary();

    return () => {
      isMounted = false;
    };
  }, [endDate, isLoading, startDate]);

  const canEditPayroll = canEdit && payrollStatus !== "finalized";

  const selectedCount = useMemo(
    () => Object.values(rows).filter((row) => row.selected).length,
    [rows],
  );
  const allEmployeesSelected = employees.length > 0 && selectedCount === employees.length;
  const selectAllChecked = allEmployeesSelected ? true : selectedCount > 0 ? "indeterminate" : false;

  const totalNetPay = useMemo(
    () =>
      employees.reduce((total, employee) => {
        const row = rows[employee.id];
        return row?.selected ? total + calculateRow(employee.id, row).netPay : total;
      }, 0),
    [employees, rows],
  );
  const attendanceSummaryByEmployee = useMemo(
    () => new Map(attendanceSummaries.map((summary) => [summary.employeeId, summary])),
    [attendanceSummaries],
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

  async function handleCopyPreviousPayroll() {
    if (!canEditPayroll || isSaving || isCopyingPreviousPayroll) {
      return;
    }

    setIsCopyingPreviousPayroll(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCarryForwardMessage(null);

    try {
      const previousPayroll = await getLatestManualPayrollBefore({
        periodStart: startDate,
      });

      if (!previousPayroll) {
        setCarryForwardMessage("Belum ada draft atau payroll final sebelum periode ini untuk disalin.");
        return;
      }

      setRows((current) => applyCarryForwardRows(initializeRows(employees, current), previousPayroll.items));
      const sourceStatus = previousPayroll.status === "finalized" ? "payroll final" : "draft payroll";
      setCarryForwardMessage(
        `Data berhasil diambil dari ${sourceStatus} ${formatDisplayDateText(previousPayroll.periodLabel)}. Periksa kembali sebelum simpan draft atau finalisasi.`,
      );
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Data payroll sebelumnya gagal diambil.");
    } finally {
      setIsCopyingPreviousPayroll(false);
    }
  }

  async function handleFinalize() {
    if (!canEditPayroll || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCarryForwardMessage(null);

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

      setSuccessMessage(`Payroll ${formatDisplayDateText(run.periodLabel)} final untuk ${run.employeeCount} karyawan.`);
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
    setCarryForwardMessage(null);

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
      setRows((current) => applyDraftRows(initializeRows(employees, current), draft.items));
      setSuccessMessage(`Draft payroll ${formatDisplayDateText(draft.periodLabel)} tersimpan.`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Draft payroll gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <FeaturePanel
      aria-label="Finalisasi payroll manual"
      badge={<StatusBadge>{canEditPayroll ? "Finalisasi batch" : "Readonly"}</StatusBadge>}
      title="Payroll Manual"
    >
      <PanelBody>
        {!canEdit ? <PanelNote>Role saat ini hanya bisa melihat payroll.</PanelNote> : null}
        {payrollStatus === "finalized" ? (
          <PanelNote tone="warning">
            Periode payroll ini sudah final. Angka yang tampil adalah data final slip gaji dan tidak bisa diedit.
          </PanelNote>
        ) : null}
        {carryForwardMessage ? <PanelNote>{carryForwardMessage}</PanelNote> : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

        <div className="grid gap-3 md:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto_auto] md:items-end">
          <label>
            Label periode
            <Input value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} />
          </label>
          <label>
            Periode mulai
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            Periode selesai
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <Button
            disabled={!canEditPayroll || isSaving || isCopyingPreviousPayroll || employees.length === 0}
            onClick={() => void handleCopyPreviousPayroll()}
            type="button"
            variant="outline"
          >
            {isCopyingPreviousPayroll ? "Mengambil..." : "Ambil Data Sebelumnya"}
          </Button>
          <Button disabled={!canEditPayroll || isSaving || selectedCount === 0} onClick={() => void handleSaveDraft()} type="button" variant="outline">
            {isSaving ? "Menyimpan..." : "Simpan Draft"}
          </Button>
          <Button disabled={!canEditPayroll || isSaving || selectedCount === 0} onClick={() => void handleFinalize()} type="button">
            {isSaving ? "Finalisasi..." : "Finalisasi Payroll"}
          </Button>
        </div>

        <div className="payroll-summary">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Checkbox
              checked={selectAllChecked}
              disabled={!canEditPayroll || isSaving || employees.length === 0}
              onCheckedChange={(checked) => updateAllSelected(checked === true)}
            />
            Pilih semua karyawan
          </label>
          <span>Karyawan dipilih: <strong>{selectedCount}</strong></span>
          <span>Total gaji bersih: <strong>{formatRupiah(totalNetPay)}</strong></span>
          <span>
            Rekap absensi: <strong>{isLoadingAttendanceSummary ? "Membaca..." : `${attendanceSummaries.length} karyawan`}</strong>
          </span>
          <span>Status: <strong>{getPayrollStatusLabel(payrollStatus, payrollRunId)}</strong></span>
        </div>

        <div className="payroll-table-wrap overflow-x-auto rounded-lg border bg-background">
          {isLoading ? <PanelNote>Membaca karyawan aktif...</PanelNote> : null}
          <Table className="payroll-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Pilih</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Rekap Absensi</TableHead>
                {INCOME_COMPONENT_NAMES.map((component) => <TableHead key={component}>{component}</TableHead>)}
                {DEDUCTION_COMPONENT_NAMES.map((component) => <TableHead key={component}>{component}</TableHead>)}
                <TableHead>Gaji Bersih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const row = rows[employee.id];
                const snapshot = row ? calculateRow(employee.id, row) : null;
                const attendanceSummary = attendanceSummaryByEmployee.get(employee.id);

                return (
                  <TableRow key={employee.id}>
                    <TableCell className="text-center">
                      <Checkbox
                        className="mx-auto"
                        checked={row?.selected ?? false}
                        disabled={!canEditPayroll || isSaving}
                        onCheckedChange={(checked) => updateSelected(employee.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell>
                      <strong className="block font-semibold">{employee.name}</strong>
                      <span className="block text-muted-foreground">{employee.nik}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block min-w-44 text-xs text-muted-foreground">
                        {formatAttendanceSummary(attendanceSummary)}
                      </span>
                    </TableCell>
                    {INCOME_COMPONENT_NAMES.map((component) => (
                      <TableCell key={component}>
                        <FormattedAmountInput
                          disabled={!canEditPayroll || isSaving}
                          onChange={(value) => updateAmount(employee.id, "income", component, value)}
                          value={row?.income[component] ?? 0}
                        />
                      </TableCell>
                    ))}
                    {DEDUCTION_COMPONENT_NAMES.map((component) => (
                      <TableCell key={component}>
                        <FormattedAmountInput
                          disabled={!canEditPayroll || isSaving}
                          onChange={(value) => updateAmount(employee.id, "deductions", component, value)}
                          value={row?.deductions[component] ?? 0}
                        />
                      </TableCell>
                    ))}
                    <TableCell>{formatRupiah(snapshot?.netPay ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16}>Belum ada karyawan aktif untuk payroll.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </PanelBody>
    </FeaturePanel>
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
        income: createEmptyIncome(),
        deductions: Object.fromEntries(DEDUCTION_COMPONENT_NAMES.map((name) => [name, 0])),
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

function applyCarryForwardRows(
  currentRows: Record<string, PayrollRowDraft>,
  items: Array<{
    employeeId: string;
    incomeComponents: PayrollComponentAmount[];
    deductionComponents: PayrollComponentAmount[];
  }>,
): Record<string, PayrollRowDraft> {
  const nextRows = { ...currentRows };

  for (const item of items) {
    if (!nextRows[item.employeeId]) {
      continue;
    }

    nextRows[item.employeeId] = {
      ...nextRows[item.employeeId],
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
        income: createDefaultIncome(employee),
        deductions: Object.fromEntries(DEDUCTION_COMPONENT_NAMES.map((name) => [name, 0])),
      },
    ]),
  );
}

function createEmptyIncome(): Record<string, number> {
  return Object.fromEntries(INCOME_COMPONENT_NAMES.map((name) => [name, 0]));
}

function createDefaultIncome(employee: Employee): Record<string, number> {
  return Object.fromEntries(
    INCOME_COMPONENT_NAMES.map((name) => [
      name,
      name === BASE_SALARY_COMPONENT_NAME ? employee.salaryAmount : 0,
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

function formatAttendanceSummary(summary: AttendanceSummary | undefined): string {
  if (!summary) {
    return "Belum ada data absensi";
  }

  const parts = [
    `Alpa ${summary.absenceDays} hari`,
    `Izin/Cuti ${summary.leaveDays} hari`,
    `Sakit ${summary.sickDays} hari`,
    `Telat ${summary.totalLateMinutes} menit`,
    `Pulang cepat ${summary.totalEarlyLeaveMinutes} menit`,
    `Lembur ${summary.totalOvertimeMinutes} menit`,
  ];

  return parts.join(" | ");
}

function toComponents(values: Record<string, number>): PayrollComponentAmount[] {
  return Object.entries(values).map(([name, amount]) => ({
    name,
    amount,
  }));
}

function readLastPayrollPeriod(): {
  label: string;
  startDate: string;
  endDate: string;
} {
  const fallback = createCurrentMonthPeriodDefaults("Payroll");

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = window.sessionStorage.getItem(LAST_PAYROLL_PERIOD_STORAGE_KEY);
    if (!rawValue) {
      return fallback;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<typeof fallback>;
    if (!parsedValue.label || !parsedValue.startDate || !parsedValue.endDate) {
      return fallback;
    }

    return {
      label: parsedValue.label,
      startDate: parsedValue.startDate,
      endDate: parsedValue.endDate,
    };
  } catch {
    return fallback;
  }
}

function saveLastPayrollPeriod(period: {
  label: string;
  startDate: string;
  endDate: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(LAST_PAYROLL_PERIOD_STORAGE_KEY, JSON.stringify(period));
}
