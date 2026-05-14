import { useEffect, useMemo, useState } from "react";
import { AppNotice } from "../../../components/shared/AppNotice";
import { PaginationControls } from "../../../components/shared/PaginationControls";
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
    <section className="panel" aria-label="Master departemen dan jabatan">
      <div className="panel-header">
        <h2>Master Referensi Karyawan</h2>
        <span className="status-pill">{canEdit ? "Admin bisa edit" : "Readonly"}</span>
      </div>

      {isLoading ? <p className="status-note">Membaca master referensi lokal...</p> : null}
      {!canEdit ? (
        <p className="readonly-note">Role saat ini hanya bisa melihat master referensi.</p>
      ) : null}
      {errorMessage ? <AppNotice variant="error">{errorMessage}</AppNotice> : null}
      {successMessage ? <AppNotice variant="success">{successMessage}</AppNotice> : null}

      {draft ? (
        <div className="attendance-master-content">
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

          <div className="settings-actions">
            <button disabled={disabled || !masterChanged(masterData, draft)} onClick={handleSave} type="button">
              {isSaving ? "Menyimpan..." : "Simpan Master Referensi"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
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
    <div className="master-section">
      <div className="master-section-header">
        <div className="master-section-title">
          <h3>{title}</h3>
          <span>{items.length} item tersimpan di master</span>
        </div>
        {canEdit ? (
          <button disabled={disabled} onClick={handleAdd} type="button">
            Tambah {title}
          </button>
        ) : null}
      </div>
      <div className="master-row-list">
        {paginatedItems.map((item, index) => (
          <div className="master-row master-row-reference" key={item.id}>
            <label>
              Nama
              <input
                disabled={disabled}
                maxLength={100}
                onChange={(event) => onUpdate(pageStartIndex + index, { name: event.target.value })}
                value={item.name}
              />
            </label>
            <label>
              Urutan
              <input
                disabled={disabled}
                onChange={(event) =>
                  onUpdate(pageStartIndex + index, { sortOrder: readNumber(event.target.value, 0) })
                }
                type="number"
                value={item.sortOrder}
              />
            </label>
            <label className="inline-check">
              <input
                checked={item.isActive}
                disabled={disabled}
                onChange={(event) => onUpdate(pageStartIndex + index, { isActive: event.target.checked })}
                type="checkbox"
              />
              Aktif
            </label>
            <div className="master-row-actions">
              {canRemove(item.id) ? (
                <button
                  className="master-row-action"
                  disabled={disabled}
                  onClick={() => onRemove(item.id)}
                  type="button"
                >
                  Hapus Baris
                </button>
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
