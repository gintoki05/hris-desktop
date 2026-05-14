import { tauriOrganizationMasterRepository } from "../repositories/tauri-organization-master.repository";
import type { OrganizationMasterActor, OrganizationMasterData } from "../types";

export function getOrganizationMasterData(): Promise<OrganizationMasterData> {
  return tauriOrganizationMasterRepository.getOrganizationMasterData();
}

export function saveOrganizationMasterData(
  data: OrganizationMasterData,
  actor: OrganizationMasterActor,
): Promise<OrganizationMasterData> {
  return tauriOrganizationMasterRepository.saveOrganizationMasterData(data, actor);
}
