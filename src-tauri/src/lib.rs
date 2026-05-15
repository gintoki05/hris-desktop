mod commands;
mod error;
mod services;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::database::initialize_local_database,
            commands::backup::create_local_database_backup,
            commands::backup::list_local_database_backups,
            commands::backup::restore_local_database_backup,
            commands::settings::get_master_settings,
            commands::settings::update_master_settings,
            commands::employees::list_employees,
            commands::employees::create_employee,
            commands::employees::update_employee,
            commands::employees::deactivate_employee,
            commands::organization_master::get_organization_master_data,
            commands::organization_master::save_organization_master_data,
            commands::attendance_master::get_attendance_master_data,
            commands::attendance_master::save_attendance_master_data,
            commands::attendance_import::save_attendance_import_batch,
            commands::work_schedules::get_work_schedule_period,
            commands::work_schedules::save_work_schedule_period,
            commands::payroll::finalize_manual_payroll,
            commands::payroll::save_manual_payroll_draft,
            commands::payroll::get_manual_payroll_draft,
            commands::payroll::get_finalized_manual_payroll,
            commands::payslip_manager::list_payslip_periods,
            commands::payslip_manager::save_payslip_period,
            commands::payslip_manager::save_payslip_import_batch,
            commands::payslip_manager::list_payslip_snapshots,
            commands::payslip_manager::update_payslip_snapshot_send_status,
            commands::payslip_manager::export_payslip_template_file,
            commands::payslip_manager::generate_payslip_pdfs,
            commands::payslip_manager::send_payslip_manager_email,
            commands::payslip_portal_publish::publish_final_payslips_to_portal,
            commands::payslip_delivery::list_payslip_delivery_queue,
            commands::payslip_delivery::update_payslip_delivery_status,
            commands::payslip_delivery::send_payslip_email
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("Failed to start HRIS Payroll desktop app: {error}");
    }
}
