use std::collections::HashSet;

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::{error::AppError, services::database_service};

#[derive(Clone, Serialize, Deserialize)]
pub struct OrganizationReferenceItem {
    pub id: String,
    pub name: String,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Serialize, Deserialize)]
pub struct OrganizationMasterData {
    pub departments: Vec<OrganizationReferenceItem>,
    pub positions: Vec<OrganizationReferenceItem>,
}

#[derive(Deserialize)]
pub struct OrganizationMasterActor {
    pub user_id: String,
    pub display_name: String,
    pub role: String,
}

pub fn get_organization_master_data(app: &AppHandle) -> Result<OrganizationMasterData, AppError> {
    database_service::initialize_local_database(app)?;
    let connection = database_service::open_local_connection(app)?;

    Ok(OrganizationMasterData {
        departments: list_reference_items(&connection, "departments")?,
        positions: list_reference_items(&connection, "positions")?,
    })
}

pub fn save_organization_master_data(
    app: &AppHandle,
    data: OrganizationMasterData,
    actor: OrganizationMasterActor,
) -> Result<OrganizationMasterData, AppError> {
    database_service::initialize_local_database(app)?;
    validate_actor(&actor)?;
    validate_items("departemen", &data.departments)?;
    validate_items("jabatan", &data.positions)?;

    let mut connection = database_service::open_local_connection(app)?;
    let transaction = connection.transaction()?;

    upsert_reference_items(&transaction, "departments", &data.departments)?;
    upsert_reference_items(&transaction, "positions", &data.positions)?;

    transaction.commit()?;
    get_organization_master_data(app)
}

fn list_reference_items(
    connection: &rusqlite::Connection,
    table_name: &str,
) -> Result<Vec<OrganizationReferenceItem>, AppError> {
    let sql = format!(
        "
        SELECT id, name, is_active, sort_order
        FROM {table_name}
        ORDER BY sort_order ASC, name ASC
        "
    );
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map([], |row| {
        let is_active: i32 = row.get(2)?;

        Ok(OrganizationReferenceItem {
            id: row.get(0)?,
            name: row.get(1)?,
            is_active: is_active == 1,
            sort_order: row.get(3)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(items)
}

fn upsert_reference_items(
    transaction: &rusqlite::Transaction<'_>,
    table_name: &str,
    items: &[OrganizationReferenceItem],
) -> Result<(), AppError> {
    let sql = format!(
        "
        INSERT INTO {table_name} (id, name, is_active, sort_order, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            is_active = excluded.is_active,
            sort_order = excluded.sort_order,
            updated_at = datetime('now')
        "
    );

    for item in items {
        transaction.execute(
            &sql,
            params![
                item.id.trim(),
                item.name.trim(),
                if item.is_active { 1 } else { 0 },
                item.sort_order,
            ],
        )?;
    }

    Ok(())
}

fn validate_items(label: &str, items: &[OrganizationReferenceItem]) -> Result<(), AppError> {
    let mut names = HashSet::new();

    for item in items {
        if item.id.trim().is_empty() {
            return Err(AppError::Database(format!("id master {label} tidak valid")));
        }

        let name = item.name.trim();
        if name.is_empty() {
            return Err(AppError::Database(format!("nama master {label} wajib diisi")));
        }

        if name.len() > 100 {
            return Err(AppError::Database(format!(
                "nama master {label} maksimal 100 karakter"
            )));
        }

        if !names.insert(name.to_lowercase()) {
            return Err(AppError::Database(format!(
                "nama master {label} tidak boleh duplikat"
            )));
        }
    }

    Ok(())
}

fn validate_actor(actor: &OrganizationMasterActor) -> Result<(), AppError> {
    if actor.role != "admin_payroll" {
        return Err(AppError::Database(
            "hanya Admin Payroll yang boleh mengubah master referensi".to_string(),
        ));
    }

    if actor.user_id.trim().is_empty() || actor.display_name.trim().is_empty() {
        return Err(AppError::Database(
            "identitas pengguna lokal tidak valid".to_string(),
        ));
    }

    Ok(())
}
