import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FeaturePanel, PanelBody, StatusBadge } from "../../../components/shared/FeaturePanel";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
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
import { formatLocalDateTimeFromUtc } from "../../../lib/formatters/date-time";
import { AUTH_ROLE_LABELS } from "../constants";
import {
  createManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} from "../services/auth.service";
import type { AuthRole, AuthUserStatus, UserManagementItem } from "../types";

type UserManagementPanelProps = {
  canManage: boolean;
};

type DialogMode = "create" | "edit" | "reset";

type UserFormState = {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
  status: AuthUserStatus;
  password: string;
};

const ROLE_OPTIONS: AuthRole[] = ["admin_payroll", "owner_management", "viewer"];
const STATUS_LABELS: Record<AuthUserStatus, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
};
const CREDENTIAL_SOURCE_LABELS: Record<UserManagementItem["credentialSource"], string> = {
  local_seed: "Seed lokal",
  sqlite: "SQLite lokal",
};

const EMPTY_FORM: UserFormState = {
  id: "",
  username: "",
  displayName: "",
  role: "viewer",
  status: "active",
  password: "",
};

export function UserManagementPanel({ canManage }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserManagementItem[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshUsers();
  }, []);

  const summary = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.status === "active").length,
      admins: users.filter((user) => user.role === "admin_payroll" && user.status === "active").length,
    }),
    [users],
  );

  async function refreshUsers() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setUsers(await listManagedUsers());
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Daftar user gagal dibaca."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!canManage || !dialogMode) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (dialogMode === "create") {
        await createManagedUser({
          username: form.username,
          displayName: form.displayName,
          role: form.role,
          password: form.password,
        });
        setSuccessMessage("User aplikasi berhasil dibuat.");
      }

      if (dialogMode === "edit") {
        await updateManagedUser({
          id: form.id,
          displayName: form.displayName,
          role: form.role,
          status: form.status,
        });
        setSuccessMessage("User aplikasi berhasil diperbarui.");
      }

      if (dialogMode === "reset") {
        await resetManagedUserPassword({
          id: form.id,
          password: form.password,
        });
        setSuccessMessage("Password user berhasil direset.");
      }

      await refreshUsers();
      closeDialog();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Perubahan user gagal disimpan."));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setDialogMode("create");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function openEditDialog(user: UserManagementItem) {
    setForm({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      password: "",
    });
    setDialogMode("edit");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function openResetDialog(user: UserManagementItem) {
    setForm({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      password: "",
    });
    setDialogMode("reset");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function closeDialog() {
    setDialogMode(null);
    setForm(EMPTY_FORM);
  }

  const isPasswordRequired = dialogMode === "create" || dialogMode === "reset";
  const canSubmit = canManage
    && !isSubmitting
    && form.displayName.trim().length > 0
    && (dialogMode !== "create" || form.username.trim().length >= 3)
    && (!isPasswordRequired || form.password.length >= 8);

  return (
    <FeaturePanel
      aria-label="Manajemen user aplikasi"
      badge={<StatusBadge>{canManage ? "Admin Payroll" : "Readonly"}</StatusBadge>}
      title="Manajemen User"
    >
      <PanelBody>
        {!canManage ? (
          <AppNotice variant="warning">Role saat ini tidak bisa mengelola user aplikasi.</AppNotice>
        ) : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}
        <AppNotice variant="info">
          User aplikasi disimpan di SQLite lokal. Minimal satu Admin Payroll aktif wajib tersisa agar aplikasi
          tidak terkunci.
        </AppNotice>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryItem label="Total user" value={String(summary.total)} />
          <SummaryItem label="User aktif" value={String(summary.active)} />
          <SummaryItem label="Admin aktif" value={String(summary.admins)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!canManage} onClick={openCreateDialog} type="button">
            Tambah User
          </Button>
          <Button disabled={isLoading} onClick={() => void refreshUsers()} type="button" variant="outline">
            {isLoading ? "Membaca..." : "Refresh"}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Login Terakhir</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>{AUTH_ROLE_LABELS[user.role]}</TableCell>
                  <TableCell>
                    <StatusBadge>{STATUS_LABELS[user.status]}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {user.lastLoginAt ? formatLocalDateTimeFromUtc(user.lastLoginAt) : "-"}
                  </TableCell>
                  <TableCell>{CREDENTIAL_SOURCE_LABELS[user.credentialSource]}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={!canManage}
                        onClick={() => openEditDialog(user)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Edit
                      </Button>
                      <Button
                        disabled={!canManage}
                        onClick={() => openResetDialog(user)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Reset
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>Belum ada user aplikasi.</TableCell>
                </TableRow>
              ) : null}
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>Membaca daftar user...</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <Dialog
          open={dialogMode !== null}
          onOpenChange={(open) => {
            if (!open && !isSubmitting) {
              closeDialog();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getDialogTitle(dialogMode)}</DialogTitle>
              <DialogDescription>
                Password disimpan sebagai hash di database lokal dan tidak ditampilkan ulang.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              {dialogMode === "create" ? (
                <div className="grid gap-2">
                  <Label htmlFor="user-username">Username</Label>
                  <Input
                    autoComplete="username"
                    disabled={isSubmitting}
                    id="user-username"
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="contoh: admin.cabang"
                    value={form.username}
                  />
                </div>
              ) : (
                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">{form.username}</span>
                  <span className="text-xs text-muted-foreground">Username tidak diubah setelah user dibuat.</span>
                </div>
              )}

              {dialogMode !== "reset" ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="user-display-name">Nama</Label>
                    <Input
                      autoComplete="name"
                      disabled={isSubmitting}
                      id="user-display-name"
                      onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                      value={form.displayName}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Role</Label>
                    <Select
                      disabled={isSubmitting}
                      onValueChange={(value) => setForm((current) => ({ ...current, role: value as AuthRole }))}
                      value={form.role}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role} value={role}>
                            {AUTH_ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}

              {dialogMode === "edit" ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    disabled={isSubmitting}
                    onValueChange={(value) => setForm((current) => ({ ...current, status: value as AuthUserStatus }))}
                    value={form.status}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="inactive">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {isPasswordRequired ? (
                <div className="grid gap-2">
                  <Label htmlFor="user-password">
                    {dialogMode === "reset" ? "Password baru" : "Password sementara"}
                  </Label>
                  <Input
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    id="user-password"
                    minLength={8}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Minimal 8 karakter"
                    type="password"
                    value={form.password}
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button disabled={isSubmitting} onClick={closeDialog} type="button" variant="outline">
                  Batal
                </Button>
                <Button disabled={!canSubmit} onClick={() => void handleSubmit()} type="button">
                  {isSubmitting ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PanelBody>
    </FeaturePanel>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
};

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <span className="block text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-sm font-semibold text-foreground">{value}</strong>
    </div>
  );
}

function getDialogTitle(mode: DialogMode | null): string {
  if (mode === "create") {
    return "Tambah User";
  }

  if (mode === "edit") {
    return "Edit User";
  }

  if (mode === "reset") {
    return "Reset Password";
  }

  return "Manajemen User";
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
