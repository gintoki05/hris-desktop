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
            commands::backup::restore_local_database_backup
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("Failed to start HRIS Payroll desktop app: {error}");
    }
}
