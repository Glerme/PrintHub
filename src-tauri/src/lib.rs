mod commands;
mod db;
mod error;
mod indexer;
mod thumbnail;

use tauri::Manager;

pub use error::AppError;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize DB synchronously before the webview loads
            let handle = app.handle().clone();
            let pool = tauri::async_runtime::block_on(db::init_db(&handle))
                .expect("DB initialization failed");
            handle.manage(pool);

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::files::list_files,
            commands::files::list_virtual_folders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
