import { invoke } from "@tauri-apps/api/core";
import type {
  OrganizationMasterActor,
  OrganizationMasterData,
  OrganizationReferenceItem,
} from "../types";

type OrganizationReferenceItemDto = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

type OrganizationMasterDataDto = {
  departments: OrganizationReferenceItemDto[];
  positions: OrganizationReferenceItemDto[];
};

type OrganizationMasterActorDto = {
  user_id: string;
  display_name: string;
  role: string;
};

const browserPreviewData: OrganizationMasterData = {
  departments: [
    createPreviewItem("department-poli-umum", "Poli Umum", 10),
    createPreviewItem("department-poli-gigi", "Poli Gigi", 20),
    createPreviewItem("department-farmasi", "Farmasi", 30),
    createPreviewItem("department-pendaftaran", "Pendaftaran", 40),
    createPreviewItem("department-kasir", "Kasir", 50),
    createPreviewItem("department-manajemen", "Manajemen", 60),
  ],
  positions: [
    createPreviewItem("position-dokter", "Dokter", 10),
    createPreviewItem("position-perawat", "Perawat", 20),
    createPreviewItem("position-bidan", "Bidan", 30),
    createPreviewItem("position-apoteker", "Apoteker", 40),
    createPreviewItem("position-admin-pendaftaran", "Admin Pendaftaran", 50),
    createPreviewItem("position-kasir", "Kasir", 60),
    createPreviewItem("position-manajemen", "Manajemen", 70),
  ],
};

export const tauriOrganizationMasterRepository = {
  async getOrganizationMasterData(): Promise<OrganizationMasterData> {
    if (!isTauriRuntime()) {
      return browserPreviewData;
    }

    const dto = await invoke<OrganizationMasterDataDto>("get_organization_master_data");
    return toOrganizationMasterData(dto);
  },

  async saveOrganizationMasterData(
    data: OrganizationMasterData,
    actor: OrganizationMasterActor,
  ): Promise<OrganizationMasterData> {
    ensureTauriRuntime();
    const dto = await invoke<OrganizationMasterDataDto>("save_organization_master_data", {
      data: toOrganizationMasterDataDto(data),
      actor: toOrganizationMasterActorDto(actor),
    });
    return toOrganizationMasterData(dto);
  },
};

function toOrganizationMasterData(dto: OrganizationMasterDataDto): OrganizationMasterData {
  return {
    departments: dto.departments.map(toOrganizationReferenceItem),
    positions: dto.positions.map(toOrganizationReferenceItem),
  };
}

function toOrganizationReferenceItem(dto: OrganizationReferenceItemDto): OrganizationReferenceItem {
  return {
    id: dto.id,
    name: dto.name,
    isActive: dto.is_active,
    sortOrder: dto.sort_order,
  };
}

function toOrganizationMasterDataDto(data: OrganizationMasterData): OrganizationMasterDataDto {
  return {
    departments: data.departments.map(toOrganizationReferenceItemDto),
    positions: data.positions.map(toOrganizationReferenceItemDto),
  };
}

function toOrganizationReferenceItemDto(
  item: OrganizationReferenceItem,
): OrganizationReferenceItemDto {
  return {
    id: item.id,
    name: item.name,
    is_active: item.isActive,
    sort_order: item.sortOrder,
  };
}

function toOrganizationMasterActorDto(actor: OrganizationMasterActor): OrganizationMasterActorDto {
  return {
    user_id: actor.userId,
    display_name: actor.displayName,
    role: actor.role,
  };
}

function createPreviewItem(id: string, name: string, sortOrder: number): OrganizationReferenceItem {
  return {
    id,
    name,
    isActive: true,
    sortOrder,
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function ensureTauriRuntime(): void {
  if (!isTauriRuntime()) {
    throw new Error("Master referensi hanya bisa disimpan saat aplikasi berjalan sebagai desktop app.");
  }
}
