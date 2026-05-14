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
const LOGO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

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

        setSettings(nextSettings);
        setDraft(nextSettings);
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

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const savedSettings = await updateMasterSettings({
        company: draft.company,
        payroll: draft.payroll,
        emailDelivery: draft.emailDelivery,
        actor: {
          userId: session.user.id,
          displayName: session.user.displayName,
          role: session.user.role,
        },
      });

      setSettings(savedSettings);
      setDraft(savedSettings);
      onSettingsSaved?.(savedSettings);
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
      setErrorMessage("Logo harus berupa file PNG, JPG, atau WebP.");
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
                        accept="image/png,image/jpeg,image/webp"
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
                <span className="field-help">PNG, JPG, atau WebP. Maksimal 512 KB.</span>
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
                <div className="text-sm font-semibold text-foreground">Pengiriman Email Resend</div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={draft.emailDelivery.enabled}
                  disabled={disabled}
                  onCheckedChange={(checked) => updateEmailDeliveryField("enabled", checked === true)}
                />
                Aktifkan pengiriman slip lewat email
              </label>
              <label>
                API key Resend
                <Input
                  autoComplete="off"
                  maxLength={220}
                  onChange={(event) => updateEmailDeliveryField("resendApiKey", event.target.value)}
                  placeholder={draft.emailDelivery.resendApiKeySet ? "API key sudah tersimpan. Isi untuk mengganti." : "re_xxxxxxxxx"}
                  type="password"
                  value={draft.emailDelivery.resendApiKey}
                />
              </label>
              <span className="field-help">
                API key disimpan lokal dan tidak ditampilkan ulang setelah tersimpan.
              </span>
              <div className="settings-two-columns">
                <label>
                  Nama pengirim
                  <Input
                    maxLength={120}
                    onChange={(event) => updateEmailDeliveryField("fromName", event.target.value)}
                    value={draft.emailDelivery.fromName}
                  />
                </label>
                <label>
                  Email pengirim
                  <Input
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
                  maxLength={160}
                  onChange={(event) => updateEmailDeliveryField("replyToEmail", event.target.value)}
                  placeholder="Opsional"
                  type="email"
                  value={draft.emailDelivery.replyToEmail}
                />
              </label>
              </fieldset>

            </div>

            <div className="flex justify-end">
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
    || JSON.stringify(current.emailDelivery) !== JSON.stringify(draft.emailDelivery);
}
