use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::services::organization_master_service;

#[derive(Serialize, Deserialize)]
pub struct OrganizationReferenceItemDto {
    id: String,
    name: String,
    is_active: bool,
    sort_order: i32,
}

#[derive(Serialize, Deserialize)]
pub struct OrganizationMasterDataDto {
    departments: Vec<OrganizationReferenceItemDto>,
    positions: Vec<OrganizationReferenceItemDto>,
}

#[derive(Deserialize)]
pub struct OrganizationMasterActorDto {
    user_id: String,
    display_name: String,
    role: String,
}

#[tauri::command]
pub fn get_organization_master_data(app: AppHandle) -> Result<OrganizationMasterDataDto, String> {
    organization_master_service::get_organization_master_data(&app)
        .map(to_organization_master_data_dto)
        .map_err(|error| error.user_message())
}

#[tauri::command]
pub fn save_organization_master_data(
    app: AppHandle,
    data: OrganizationMasterDataDto,
    actor: OrganizationMasterActorDto,
) -> Result<OrganizationMasterDataDto, String> {
    organization_master_service::save_organization_master_data(
        &app,
        to_organization_master_data(data),
        to_organization_master_actor(actor),
    )
    .map(to_organization_master_data_dto)
    .map_err(|error| error.user_message())
}

fn to_organization_master_data_dto(
    data: organization_master_service::OrganizationMasterData,
) -> OrganizationMasterDataDto {
    OrganizationMasterDataDto {
        departments: data
            .departments
            .into_iter()
            .map(to_organization_reference_item_dto)
            .collect(),
        positions: data
            .positions
            .into_iter()
            .map(to_organization_reference_item_dto)
            .collect(),
    }
}

fn to_organization_reference_item_dto(
    item: organization_master_service::OrganizationReferenceItem,
) -> OrganizationReferenceItemDto {
    OrganizationReferenceItemDto {
        id: item.id,
        name: item.name,
        is_active: item.is_active,
        sort_order: item.sort_order,
    }
}

fn to_organization_master_data(
    data: OrganizationMasterDataDto,
) -> organization_master_service::OrganizationMasterData {
    organization_master_service::OrganizationMasterData {
        departments: data
            .departments
            .into_iter()
            .map(to_organization_reference_item)
            .collect(),
        positions: data
            .positions
            .into_iter()
            .map(to_organization_reference_item)
            .collect(),
    }
}

fn to_organization_reference_item(
    item: OrganizationReferenceItemDto,
) -> organization_master_service::OrganizationReferenceItem {
    organization_master_service::OrganizationReferenceItem {
        id: item.id,
        name: item.name,
        is_active: item.is_active,
        sort_order: item.sort_order,
    }
}

fn to_organization_master_actor(
    actor: OrganizationMasterActorDto,
) -> organization_master_service::OrganizationMasterActor {
    organization_master_service::OrganizationMasterActor {
        user_id: actor.user_id,
        display_name: actor.display_name,
        role: actor.role,
    }
}
