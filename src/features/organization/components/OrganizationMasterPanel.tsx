import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { FeaturePanel, PanelBody, PanelNote, StatusBadge } from "../../../components/shared/FeaturePanel";
import { PaginationControls } from "../../../components/shared/PaginationControls";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import type { AuthSession } from "../../auth/types";
import {
  getOrganizationMasterData,
  saveOrganizationMasterData,
} from "../services/organization-master.service";
import type {
  OrganizationMasterActor,
  OrganizationMasterData,
  OrganizationReferenceItem,
} from "../types";

type OrganizationMasterPanelProps = {
  canEdit: boolean;
  session: AuthSession;
};

type ReferenceKind = "departments" | "positions";

const REFERENCE_PAGE_SIZE = 5;

export function OrganizationMasterPanel({ canEdit, session }: OrganizationMasterPanelProps) {
  const [masterData, setMasterData] = useState<OrganizationMasterData | null>(null);
  const [draft, setDraft] = useState<OrganizationMasterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getOrganizationMasterData()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setMasterData(data);
        setDraft(data);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Master referensi gagal dibaca.");
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
      const saved = await saveOrganizationMasterData(draft, toActor(session));
      setMasterData(saved);
      setDraft(saved);
      setSuccessMessage("Master departemen dan jabatan tersimpan.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Master referensi gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  function addItem(kind: ReferenceKind) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextItems = current[kind];
      const sortOrder = nextItems.length > 0
        ? Math.max(...nextItems.map((item) => item.sortOrder)) + 10
        : 10;

      return {
        ...current,
        [kind]: [
          ...nextItems,
          {
            id: `${kind}-${Date.now()}`,
            name: "",
            isActive: true,
            sortOrder,
          },
        ],
      };
    });
  }

  function updateItem(
    kind: ReferenceKind,
    index: number,
    patch: Partial<OrganizationReferenceItem>,
  ) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [kind]: current[kind].map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...patch } : item,
        ),
      };
    });
  }

  function removeNewItem(kind: ReferenceKind, id: string) {
    setDraft((current) => {
      if (!current || isSavedItem(masterData, kind, id)) {
        return current;
      }

      return {
        ...current,
        [kind]: current[kind].filter((item) => item.id !== id),
      };
    });
  }

  const disabled = !canEdit || isSaving || isLoading;

  return (
    <FeaturePanel
      aria-label="Master departemen dan jabatan"
      badge={<StatusBadge>{canEdit ? "Admin bisa edit" : "Readonly"}</StatusBadge>}
      title="Master Referensi Karyawan"
    >
      <PanelBody>

      {isLoading ? <PanelNote>Membaca master referensi lokal...</PanelNote> : null}
      {!canEdit ? (
        <PanelNote tone="warning">Role saat ini hanya bisa melihat master referensi.</PanelNote>
      ) : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      {draft ? (
        <div className="grid gap-4">
          <ReferenceSection
            canEdit={canEdit}
            disabled={disabled}
            items={draft.departments}
            title="Departemen"
            canRemove={(id) => !isSavedItem(masterData, "departments", id)}
            onAdd={() => addItem("departments")}
            onRemove={(id) => removeNewItem("departments", id)}
            onUpdate={(index, patch) => updateItem("departments", index, patch)}
          />
          <ReferenceSection
            canEdit={canEdit}
            disabled={disabled}
            items={draft.positions}
            title="Jabatan"
            canRemove={(id) => !isSavedItem(masterData, "positions", id)}
            onAdd={() => addItem("positions")}
            onRemove={(id) => removeNewItem("positions", id)}
            onUpdate={(index, patch) => updateItem("positions", index, patch)}
          />

          <div className="flex justify-end">
            <Button disabled={disabled || !masterChanged(masterData, draft)} onClick={handleSave} type="button">
              {isSaving ? "Menyimpan..." : "Simpan Master Referensi"}
            </Button>
          </div>
        </div>
      ) : null}
      </PanelBody>
    </FeaturePanel>
  );
}

type ReferenceSectionProps = {
  canEdit: boolean;
  disabled: boolean;
  items: OrganizationReferenceItem[];
  title: string;
  canRemove: (id: string) => boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (index: number, patch: Partial<OrganizationReferenceItem>) => void;
};

function ReferenceSection({
  canEdit,
  disabled,
  items,
  canRemove,
  onAdd,
  onRemove,
  onUpdate,
  title,
}: ReferenceSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / REFERENCE_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * REFERENCE_PAGE_SIZE;
  const paginatedItems = useMemo(
    () => items.slice(pageStartIndex, pageStartIndex + REFERENCE_PAGE_SIZE),
    [items, pageStartIndex],
  );

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  function handleAdd() {
    setCurrentPage(Math.max(1, Math.ceil((items.length + 1) / REFERENCE_PAGE_SIZE)));
    onAdd();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="font-semibold leading-none">{title}</h3>
          <span className="text-sm text-muted-foreground">{items.length} item tersimpan di master</span>
        </div>
        {canEdit ? (
          <Button disabled={disabled} onClick={handleAdd} type="button" variant="outline">
            Tambah {title}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {paginatedItems.map((item, index) => (
          <div
            className="grid gap-3 rounded-lg border border-border bg-card p-3 lg:grid-cols-[minmax(220px,1fr)_120px_100px_auto]"
            key={item.id}
          >
            <label>
              Nama
              <Input
                disabled={disabled}
                maxLength={100}
                onChange={(event) => onUpdate(pageStartIndex + index, { name: event.target.value })}
                value={item.name}
              />
            </label>
            <label>
              Urutan
              <Input
                disabled={disabled}
                onChange={(event) =>
                  onUpdate(pageStartIndex + index, { sortOrder: readNumber(event.target.value, 0) })
                }
                type="number"
                value={item.sortOrder}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Checkbox
                checked={item.isActive}
                disabled={disabled}
                onCheckedChange={(checked) => onUpdate(pageStartIndex + index, { isActive: checked === true })}
              />
              Aktif
            </label>
            <div className="flex items-end justify-end">
              {canRemove(item.id) ? (
                <Button
                  disabled={disabled}
                  onClick={() => onRemove(item.id)}
                  type="button"
                  variant="destructive"
                >
                  Hapus Baris
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <PaginationControls
        ariaLabel={`Pagination ${title.toLowerCase()}`}
        currentPage={currentPage}
        itemLabel={title.toLowerCase()}
        onPageChange={setCurrentPage}
        pageSize={REFERENCE_PAGE_SIZE}
        totalItems={items.length}
      />
    </div>
  );
}

function readNumber(value: string, fallback: number): number {
  if (value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function masterChanged(current: OrganizationMasterData | null, draft: OrganizationMasterData): boolean {
  return current ? JSON.stringify(current) !== JSON.stringify(draft) : false;
}

function isSavedItem(
  masterData: OrganizationMasterData | null,
  kind: ReferenceKind,
  id: string,
): boolean {
  return masterData ? masterData[kind].some((item) => item.id === id) : false;
}

function toActor(session: AuthSession): OrganizationMasterActor {
  return {
    userId: session.user.id,
    displayName: session.user.displayName,
    role: session.user.role,
  };
}
