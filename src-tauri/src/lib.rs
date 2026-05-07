mod commands;
mod error;
mod services;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::database::initialize_local_database,
            commands::backup::create_local_database_backup,
            commands::backup::restore_local_database_backup,
            commands::settings::get_master_settings,
            commands::settings::update_master_settings,
            commands::employees::list_employees,
            commands::employees::create_employee,
            commands::employees::update_employee,
            commands::employees::deactivate_employee,
            commands::attendance_master::get_attendance_master_data,
            commands::attendance_master::save_attendance_master_data,
            commands::work_schedules::get_work_schedule_period,
            commands::work_schedules::save_work_schedule_period
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("Failed to start HRIS Payroll desktop app: {error}");
    }
}
