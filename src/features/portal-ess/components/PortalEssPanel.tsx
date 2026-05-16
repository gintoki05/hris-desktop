import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FeaturePanel, PanelBody, PanelNote, StatusBadge } from "../../../components/shared/FeaturePanel";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { formatLocalDateTimeFromUtc } from "../../../lib/formatters/date-time";
import type { AuthSession } from "../../auth/types";
import {
  createEmployeePortalAccount,
  listEmployeePortalStatus,
  syncEmployeePortalProfile,
} from "../services/portal-ess.service";
import type { PortalEmployeeStatusItem } from "../types";

type PortalEssPanelProps = {
  canManage: boolean;
  onOpenEmployeeDetail: (employeeId: string) => void;
  session: AuthSession;
};

const ACCOUNT_STATUS_LABELS: Record<PortalEmployeeStatusItem["authUserStatus"], string> = {
  found: "Ada",
  missing: "Belum",
};

const PROFILE_STATUS_LABELS: Record<PortalEmployeeStatusItem["employeeProfileStatus"], string> = {
  found: "Sinkron",
  missing: "Belum",
};

export function PortalEssPanel({ canManage, onOpenEmployeeDetail, session }: PortalEssPanelProps) {
  const [rows, setRows] = useState<PortalEmployeeStatusItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<PortalEmployeeStatusItem | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  const summary = useMemo(
    () => ({
      total: rows.length,
      accountReady: rows.filter((row) => row.authUserStatus === "found").length,
      profileReady: rows.filter((row) => row.employeeProfileStatus === "found").length,
      needsAction: rows.filter((row) => row.issueMessage.trim()).length,
    }),
    [rows],
  );

  async function refreshStatus() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await listEmployeePortalStatus(session);
      setRows(result.items);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Status Portal ESS gagal dibaca."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateAccount() {
    if (!selectedEmployee || !canManage) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = selectedEmployee.authUserStatus === "found"
        ? await syncEmployeePortalProfile(selectedEmployee.employeeId, session)
        : await createEmployeePortalAccount(
            selectedEmployee.employeeId,
            temporaryPassword,
            session,
          );
      await refreshStatus();
      setSelectedEmployee(null);
      setTemporaryPassword("");
      setSuccessMessage(
        result.accountStatus === "created"
          ? `Akun portal ${result.employeeName} dibuat dan profile ESS tersinkron.`
          : `Akun portal ${result.employeeName} sudah ada; profile ESS tersinkron ulang.`,
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Akun portal gagal dibuat atau disinkron."));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreateDialog(row: PortalEmployeeStatusItem) {
    setSelectedEmployee(row);
    setTemporaryPassword("");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return (
    <FeaturePanel
      aria-label="Portal Employee Self-Service"
      badge={<StatusBadge>{canManage ? "Admin Payroll" : "Readonly"}</StatusBadge>}
      title="Portal ESS"
    >
      <PanelBody>
        {!canManage ? (
          <PanelNote tone="warning">Role saat ini tidak bisa mengelola akun portal karyawan.</PanelNote>
        ) : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-4 text-sm">
            <span>Total: <strong>{summary.total}</strong></span>
            <span>Akun: <strong>{summary.accountReady}</strong></span>
            <span>Profile: <strong>{summary.profileReady}</strong></span>
            <span>Perlu aksi: <strong>{summary.needsAction}</strong></span>
            <Button
              disabled={isLoading}
              onClick={() => void refreshStatus()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isLoading ? "Membaca..." : "Refresh Status"}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-background">
            {isLoading ? <PanelNote>Membaca status akun portal...</PanelNote> : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Slip Published</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <button
                        className="block text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onOpenEmployeeDetail(row.employeeId)}
                        type="button"
                      >
                        {row.employeeName}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        {row.employeeCodeMasked} | {row.employeeStatus === "active" ? "Aktif" : "Nonaktif"}
                      </span>
                    </TableCell>
                    <TableCell>{row.employeeEmail || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge>{ACCOUNT_STATUS_LABELS[row.authUserStatus]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge>{PROFILE_STATUS_LABELS[row.employeeProfileStatus]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <span className="block">{row.payslipCount} slip</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.latestPayrollPeriod || "-"}
                        {row.latestPublishedAt ? ` | ${formatLocalDateTimeFromUtc(row.latestPublishedAt)}` : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.issueMessage ? (
                        <span className="text-xs text-destructive">{row.issueMessage}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Siap</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        disabled={!canManage || isSubmitting || !row.employeeEmail.trim()}
                        onClick={() => openCreateDialog(row)}
                        size="sm"
                        type="button"
                        variant={row.authUserStatus === "found" ? "outline" : "secondary"}
                      >
                        {row.authUserStatus === "found" ? "Sinkron Profile" : "Buat Akun"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>Belum ada data karyawan.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog
          open={selectedEmployee !== null}
          onOpenChange={(open) => {
            if (!open && !isSubmitting) {
              setSelectedEmployee(null);
              setTemporaryPassword("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedEmployee?.authUserStatus === "found" ? "Sinkron Profile Portal" : "Buat Akun Portal"}
              </DialogTitle>
              <DialogDescription>
                {selectedEmployee
                  ? `${selectedEmployee.employeeName} (${selectedEmployee.employeeEmail || "email kosong"})`
                  : "Karyawan belum dipilih."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Password sementara
                <Input
                  autoComplete="new-password"
                  disabled={isSubmitting || selectedEmployee?.authUserStatus === "found"}
                  minLength={8}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  placeholder={
                    selectedEmployee?.authUserStatus === "found"
                      ? "Tidak diperlukan untuk sinkron profile"
                      : "Minimal 8 karakter"
                  }
                  type="password"
                  value={temporaryPassword}
                />
              </label>
              <p className="text-xs leading-5 text-muted-foreground">
                Password ini hanya dikirim ke Supabase Auth saat akun dibuat. Aplikasi tidak menyimpannya.
                Jika akun sudah ada, password tidak diubah dan hanya profile ESS yang disinkron.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  disabled={isSubmitting}
                  onClick={() => {
                    setSelectedEmployee(null);
                    setTemporaryPassword("");
                  }}
                  type="button"
                  variant="outline"
                >
                  Batal
                </Button>
                <Button
                  disabled={
                    isSubmitting
                    || (selectedEmployee?.authUserStatus !== "found" && temporaryPassword.trim().length < 8)
                  }
                  onClick={() => void handleCreateAccount()}
                  type="button"
                >
                  {isSubmitting ? "Memproses..." : "Simpan"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PanelBody>
    </FeaturePanel>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
