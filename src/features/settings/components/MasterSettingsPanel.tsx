import { type ChangeEvent, useEffect, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FeaturePanel, PanelBody, PanelNote, StatusBadge } from "../../../components/shared/FeaturePanel";
import { Button, buttonVariants } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { formatLocalDateTimeFromUtc } from "../../../lib/formatters/date-time";
import type { AuthSession } from "../../auth/types";
import { getMasterSettings, updateMasterSettings } from "../services/master-settings.service";
import type { MasterSettings } from "../types";

type MasterSettingsPanelProps = {
  canEdit: boolean;
  onSettingsSaved?: (settings: MasterSettings) => void;
  session: AuthSession;
};

const LOGO_MAX_SIZE_BYTES = 512 * 1024;
const LOGO_ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;
const EMAIL_DELIVERY_DISABLED_MESSAGE =
  "Pengiriman email sedang dinonaktifkan sementara. Gunakan pengiriman WhatsApp manual.";

export function MasterSettingsPanel({ canEdit, onSettingsSaved, session }: MasterSettingsPanelProps) {
  const [settings, setSettings] = useState<MasterSettings | null>(null);
  const [draft, setDraft] = useState<MasterSettings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getMasterSettings()
      .then((nextSettings) => {
        if (!isMounted) {
          return;
        }

        const disabledEmailSettings = disableEmailDeliveryForSettings(nextSettings);
        setSettings(disabledEmailSettings);
        setDraft(disabledEmailSettings);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Setting master gagal dibaca.");
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

  async function handleSave() {
    if (!draft || !canEdit) {
      return;
    }

    if (
      draft.portalPublish.enabled
      && (!draft.portalPublish.supabaseUrl.trim()
        || (!draft.portalPublish.supabaseSecretKey.trim() && !draft.portalPublish.supabaseSecretKeySet))
    ) {
      setErrorMessage("Alamat portal dan kunci akses wajib diisi sebelum Portal Employees diaktifkan.");
      setSuccessMessage(null);
      return;
    }
    if (
      draft.portalPublish.enabled
      && !draft.portalPublish.payslipsEnabled
      && !draft.portalPublish.ownerSummaryEnabled
    ) {
      setErrorMessage("Pilih minimal satu jenis data portal: slip karyawan atau laporan manajemen.");
      setSuccessMessage(null);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const savedSettings = await updateMasterSettings({
        company: draft.company,
        payroll: draft.payroll,
        emailDelivery: disableEmailDelivery(draft.emailDelivery),
        portalPublish: draft.portalPublish,
        actor: {
          userId: session.user.id,
          displayName: session.user.displayName,
          role: session.user.role,
        },
      });

      const disabledEmailSettings = disableEmailDeliveryForSettings(savedSettings);
      setSettings(disabledEmailSettings);
      setDraft(disabledEmailSettings);
      onSettingsSaved?.(disabledEmailSettings);
      setSuccessMessage("Setting master tersimpan dan audit perubahan tercatat.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Setting master gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateCompanyField(field: keyof MasterSettings["company"], value: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            company: {
              ...current.company,
              [field]: value,
            },
          }
        : current,
    );
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!LOGO_ACCEPTED_TYPES.includes(file.type as (typeof LOGO_ACCEPTED_TYPES)[number])) {
      setErrorMessage("Logo harus berupa file PNG atau JPG.");
      return;
    }

    if (file.size > LOGO_MAX_SIZE_BYTES) {
      setErrorMessage("Ukuran logo maksimal 512 KB agar database lokal tetap ringan.");
      return;
    }

    try {
      const logoDataUrl = await readFileAsDataUrl(file);
      updateCompanyField("logoDataUrl", logoDataUrl);
    } catch {
      setErrorMessage("Logo gagal dibaca. Coba pilih file gambar lain.");
    }
  }

  function updateEmailDeliveryField<K extends keyof MasterSettings["emailDelivery"]>(
    field: K,
    value: MasterSettings["emailDelivery"][K],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            emailDelivery: {
              ...current.emailDelivery,
              [field]: value,
            },
          }
        : current,
    );
  }

  function updatePortalPublishField<K extends keyof MasterSettings["portalPublish"]>(
    field: K,
    value: MasterSettings["portalPublish"][K],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            portalPublish: {
              ...current.portalPublish,
              [field]: value,
            },
          }
        : current,
    );
  }

  const disabled = !canEdit || isSaving || isLoading;

  return (
    <FeaturePanel
      aria-label="Master perusahaan dan pengiriman slip"
      badge={<StatusBadge>{canEdit ? "Admin bisa edit" : "Readonly"}</StatusBadge>}
      title="Master Perusahaan & Pengiriman Slip"
    >
      <PanelBody>
        {isLoading ? <PanelNote>Membaca setting lokal...</PanelNote> : null}
        {!canEdit ? (
          <PanelNote tone="warning">Role saat ini hanya bisa melihat setting, tidak menyimpan perubahan.</PanelNote>
        ) : null}
        {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
        {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

        {draft ? (
          <div className="settings-content">
            <div className="settings-form-grid">
              <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
                <legend className="visually-hidden">Perusahaan</legend>
                <div className="text-sm font-semibold text-foreground">Perusahaan</div>
              <label>
                Nama perusahaan
                <Input
                  maxLength={120}
                  onChange={(event) => updateCompanyField("companyName", event.target.value)}
                  required
                  value={draft.company.companyName}
                />
              </label>
              <div className="logo-upload-field">
                <span className="logo-upload-label">Logo perusahaan</span>
                <div className="logo-upload-control">
                  <div className="logo-preview" aria-label="Preview logo perusahaan">
                    {draft.company.logoDataUrl ? (
                      <img alt="Logo perusahaan" src={draft.company.logoDataUrl} />
                    ) : (
                      <span>Belum ada logo</span>
                    )}
                  </div>
                  <div className="logo-upload-actions">
                    <label className={buttonVariants({ variant: "outline" })}>
                      Pilih Logo
                      <input
                        className="sr-only"
                        accept="image/png,image/jpeg"
                        disabled={disabled}
                        onChange={handleLogoChange}
                        type="file"
                      />
                    </label>
                    <Button
                      disabled={disabled || !draft.company.logoDataUrl}
                      onClick={() => updateCompanyField("logoDataUrl", "")}
                      type="button"
                      variant="outline"
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
                <span className="field-help">PNG atau JPG. Maksimal 512 KB.</span>
              </div>
              <label>
                Alamat
                <Textarea
                  maxLength={500}
                  onChange={(event) => updateCompanyField("address", event.target.value)}
                  rows={3}
                  value={draft.company.address}
                />
              </label>
              <div className="settings-two-columns">
                <label>
                  Telepon/kontak
                  <Input
                    maxLength={60}
                    onChange={(event) => updateCompanyField("contactPhone", event.target.value)}
                    value={draft.company.contactPhone}
                  />
                </label>
                <label>
                  Email
                  <Input
                    maxLength={120}
                    onChange={(event) => updateCompanyField("contactEmail", event.target.value)}
                    type="email"
                    value={draft.company.contactEmail}
                  />
                </label>
              </div>
              <label>
                Nama bendahara
                <Input
                  maxLength={120}
                  onChange={(event) => updateCompanyField("treasurerName", event.target.value)}
                  value={draft.company.treasurerName}
                />
              </label>
              </fieldset>

              <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
                <legend className="visually-hidden">Pengiriman Email</legend>
                <div className="text-sm font-semibold text-foreground">Pengiriman Email</div>
              <PanelNote tone="warning">{EMAIL_DELIVERY_DISABLED_MESSAGE}</PanelNote>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={false}
                  disabled
                  onCheckedChange={() => updateEmailDeliveryField("enabled", false)}
                />
                Pengiriman slip lewat email dinonaktifkan
              </label>
              <label>
                Kunci akses email
                <Input
                  autoComplete="off"
                  disabled
                  maxLength={220}
                  onChange={(event) => updateEmailDeliveryField("resendApiKey", event.target.value)}
                  placeholder={draft.emailDelivery.resendApiKeySet ? "Kunci akses sudah tersimpan. Isi untuk mengganti." : "Masukkan kunci akses email"}
                  type="password"
                  value={draft.emailDelivery.resendApiKey}
                />
              </label>
              <span className="field-help">
                Kunci akses disimpan lokal dan tidak ditampilkan ulang setelah tersimpan.
              </span>
              <div className="settings-two-columns">
                <label>
                  Nama pengirim
                  <Input
                    disabled
                    maxLength={120}
                    onChange={(event) => updateEmailDeliveryField("fromName", event.target.value)}
                    value={draft.emailDelivery.fromName}
                  />
                </label>
                <label>
                  Email pengirim
                  <Input
                    disabled
                    maxLength={160}
                    onChange={(event) => updateEmailDeliveryField("fromEmail", event.target.value)}
                    type="email"
                    value={draft.emailDelivery.fromEmail}
                  />
                </label>
              </div>
              <label>
                Reply-to email
                <Input
                  disabled
                  maxLength={160}
                  onChange={(event) => updateEmailDeliveryField("replyToEmail", event.target.value)}
                  placeholder="Opsional"
                  type="email"
                  value={draft.emailDelivery.replyToEmail}
                />
              </label>
              </fieldset>

              <fieldset className="grid gap-4 rounded-lg border border-border p-4" disabled={disabled}>
                <legend className="visually-hidden">Portal Employees</legend>
                <div className="text-sm font-semibold text-foreground">Portal Employees</div>
                <PanelNote>
                  Konfigurasi ini dipakai hanya saat admin mengirim slip dan laporan ringkas ke portal.
                </PanelNote>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Checkbox
                    checked={draft.portalPublish.enabled}
                    onCheckedChange={(checked) => updatePortalPublishField("enabled", checked === true)}
                  />
                  Aktifkan pengiriman ke portal
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Checkbox
                    checked={draft.portalPublish.payslipsEnabled}
                    disabled={!draft.portalPublish.enabled}
                    onCheckedChange={(checked) => updatePortalPublishField("payslipsEnabled", checked === true)}
                  />
                  Kirim slip karyawan final
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Checkbox
                    checked={draft.portalPublish.ownerSummaryEnabled}
                    disabled={!draft.portalPublish.enabled}
                    onCheckedChange={(checked) => updatePortalPublishField("ownerSummaryEnabled", checked === true)}
                  />
                  Kirim laporan manajemen ringkas
                </label>
                <label>
                  Alamat portal
                  <Input
                    autoComplete="off"
                    maxLength={220}
                    onChange={(event) => updatePortalPublishField("supabaseUrl", event.target.value)}
                    placeholder="https://alamat-koneksi-portal"
                    value={draft.portalPublish.supabaseUrl}
                  />
                </label>
                <label>
                  Kunci akses portal
                  <Input
                    autoComplete="off"
                    maxLength={260}
                    onChange={(event) => updatePortalPublishField("supabaseSecretKey", event.target.value)}
                    placeholder={
                      draft.portalPublish.supabaseSecretKeySet
                        ? "Kunci akses sudah tersimpan. Isi untuk mengganti."
                        : "Masukkan kunci akses portal"
                    }
                    type="password"
                    value={draft.portalPublish.supabaseSecretKey}
                  />
                </label>
                <span className="field-help">
                  Kosongkan kunci akses saat menyimpan jika tidak ingin mengganti kunci yang sudah tersimpan.
                </span>
              </fieldset>

            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button disabled={disabled || !settingsChanged(settings, draft)} onClick={handleSave} type="button">
                {isSaving ? "Menyimpan..." : "Simpan Setting"}
              </Button>
            </div>

            <div className="audit-list" aria-label="Audit perubahan setting">
              <h3>Audit Terakhir</h3>
              {draft.recentAuditEvents.length > 0 ? (
                draft.recentAuditEvents.map((event) => (
                  <div className="audit-row" key={event.id}>
                    <strong>{event.actorDisplayName}</strong>
                    <span>{event.changeSummary}</span>
                    <time>{formatLocalDateTimeFromUtc(event.createdAt)}</time>
                  </div>
                ))
              ) : (
                <p>Belum ada perubahan setting yang tersimpan.</p>
              )}
            </div>
          </div>
        ) : null}
      </PanelBody>
    </FeaturePanel>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("file result is not a data URL"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("file read failed")));
    reader.readAsDataURL(file);
  });
}

function settingsChanged(current: MasterSettings | null, draft: MasterSettings): boolean {
  if (!current) {
    return false;
  }

  return JSON.stringify(current.company) !== JSON.stringify(draft.company)
    || JSON.stringify(current.payroll) !== JSON.stringify(draft.payroll)
    || JSON.stringify(disableEmailDelivery(current.emailDelivery)) !== JSON.stringify(disableEmailDelivery(draft.emailDelivery))
    || JSON.stringify(current.portalPublish) !== JSON.stringify(draft.portalPublish);
}

function disableEmailDeliveryForSettings(settings: MasterSettings): MasterSettings {
  return {
    ...settings,
    emailDelivery: disableEmailDelivery(settings.emailDelivery),
  };
}

function disableEmailDelivery(settings: MasterSettings["emailDelivery"]): MasterSettings["emailDelivery"] {
  return {
    ...settings,
    enabled: false,
    resendApiKey: "",
  };
}
