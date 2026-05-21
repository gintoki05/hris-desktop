import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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
import { formatRupiah } from "../../../lib/formatters/currency";
import {
  formatDisplayDateRange,
  formatLocalDateTimeFromUtc,
} from "../../../lib/formatters/date-time";
import {
  getPayrollPeriodReport,
  listPayrollReportPeriods,
} from "../services/payroll-report.service";
import type { PayrollPeriodReport, PayrollReportPeriod } from "../types";

const EMPLOYEE_PAGE_SIZE = 10;

export function ReportsPanel() {
  const [periods, setPeriods] = useState<PayrollReportPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [report, setReport] = useState<PayrollPeriodReport | null>(null);
  const [employeePage, setEmployeePage] = useState(1);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPeriods() {
      setIsLoadingPeriods(true);
      setErrorMessage(null);

      try {
        const nextPeriods = await listPayrollReportPeriods();
        if (!isMounted) {
          return;
        }

        setPeriods(nextPeriods);
        setSelectedPeriodId((current) => current || nextPeriods[0]?.id || "");
      } catch (error: unknown) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Daftar periode laporan gagal dibaca.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPeriods(false);
        }
      }
    }

    void loadPeriods();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      if (!selectedPeriod) {
        setReport(null);
        return;
      }

      setIsLoadingReport(true);
      setErrorMessage(null);
      setEmployeePage(1);

      try {
        const nextReport = await getPayrollPeriodReport(selectedPeriod);
        if (isMounted) {
          setReport(nextReport);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setReport(null);
          setErrorMessage(error instanceof Error ? error.message : "Laporan payroll gagal dibaca.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingReport(false);
        }
      }
    }

    void loadReport();

    return () => {
      isMounted = false;
    };
  }, [selectedPeriod]);

  const pagedEmployees = useMemo(() => {
    const startIndex = (employeePage - 1) * EMPLOYEE_PAGE_SIZE;
    return report?.employees.slice(startIndex, startIndex + EMPLOYEE_PAGE_SIZE) ?? [];
  }, [employeePage, report]);

  function handleRefresh() {
    setSelectedPeriodId("");
    setReport(null);
    setIsLoadingPeriods(true);
    setErrorMessage(null);

    listPayrollReportPeriods()
      .then((nextPeriods) => {
        setPeriods(nextPeriods);
        setSelectedPeriodId(nextPeriods[0]?.id || "");
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : "Daftar periode laporan gagal dibaca.");
      })
      .finally(() => {
        setIsLoadingPeriods(false);
      });
  }

  return (
    <FeaturePanel
      aria-label="Laporan payroll"
      badge={<StatusBadge>Readonly</StatusBadge>}
      title="Laporan Payroll"
    >
      <PanelBody>
        <PanelNote>
          Laporan membaca snapshot slip/payroll yang sudah siap PDF, sehingga angka periode lama tidak berubah saat master data diperbarui.
        </PanelNote>

        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-background p-4">
          <label className="grid gap-1 text-sm font-medium text-foreground">
            Periode laporan
            <Select
              disabled={isLoadingPeriods || periods.length === 0}
              onValueChange={setSelectedPeriodId}
              value={selectedPeriodId}
            >
              <SelectTrigger className="min-w-72">
                <SelectValue placeholder={isLoadingPeriods ? "Membaca periode..." : "Pilih periode"} />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <Button
            disabled={isLoadingPeriods || isLoadingReport}
            onClick={handleRefresh}
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {!isLoadingPeriods && periods.length === 0 ? (
          <PanelNote tone="default">
            Belum ada laporan. Finalisasi payroll terlebih dahulu, lalu buka kembali menu ini untuk melihat ringkasan periode.
          </PanelNote>
        ) : null}

        {report ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryMetric label="Karyawan" value={`${report.employeeCount} orang`} />
              <SummaryMetric label="Total Komponen Gaji" value={formatRupiah(report.grossPay)} />
              <SummaryMetric label="Total Potongan" value={formatRupiah(report.totalDeductions)} />
              <SummaryMetric label="Total Gaji Bersih Dibayarkan" value={formatRupiah(report.netPay)} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <ComponentSummaryTable
                items={report.incomeComponents}
                title="Rekap Komponen Gaji"
              />
              <ComponentSummaryTable
                items={report.deductionComponents}
                title="Rekap Potongan"
              />
            </div>

            <div className="rounded-lg border bg-background">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Daftar Transfer Gaji</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayDateRange(report.period.startDate, report.period.endDate)}
                    {" | "}
                    Update {formatLocalDateTimeFromUtc(report.period.updatedAt)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIK</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Jabatan</TableHead>
                      <TableHead className="text-right">Total Komponen Gaji</TableHead>
                      <TableHead className="text-right">Potongan</TableHead>
                      <TableHead className="text-right">Gaji Bersih Dibayarkan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedEmployees.map((employee) => (
                      <TableRow key={employee.snapshotId}>
                        <TableCell>{employee.employeeNik}</TableCell>
                        <TableCell className="font-medium">{employee.employeeName}</TableCell>
                        <TableCell>{employee.employeePosition || "-"}</TableCell>
                        <TableCell className="text-right">{formatRupiah(employee.grossPay)}</TableCell>
                        <TableCell className="text-right">{formatRupiah(employee.totalDeductions)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatRupiah(employee.netPay)}</TableCell>
                      </TableRow>
                    ))}
                    {pagedEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>Snapshot payroll periode ini belum memiliki baris karyawan.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>

            <PaginationControls
              ariaLabel="Pagination daftar transfer gaji"
              currentPage={employeePage}
              itemLabel="karyawan"
              onPageChange={setEmployeePage}
              pageSize={EMPLOYEE_PAGE_SIZE}
              totalItems={report.employees.length}
            />
          </>
        ) : null}

        {isLoadingReport ? <PanelNote>Membaca laporan payroll...</PanelNote> : null}
      </PanelBody>
    </FeaturePanel>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-4 py-3">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-base font-semibold text-foreground">{value}</strong>
    </div>
  );
}

function ComponentSummaryTable({
  items,
  title,
}: {
  items: Array<{
    name: string;
    amount: number;
  }>;
  title: string;
}) {
  return (
    <div className="rounded-lg border bg-background">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Komponen</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.name}>
              <TableCell>{item.name}</TableCell>
              <TableCell className="text-right">{formatRupiah(item.amount)}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2}>Belum ada komponen.</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
