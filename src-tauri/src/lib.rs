mod commands;
mod db;
mod error;
mod indexer;
mod thumbnail;

use commands::indexer::WatcherStarted;
use sqlx::Row;
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

            // Initialize DB synchronously before webview loads
            let handle = app.handle().clone();
            let pool = tauri::async_runtime::block_on(db::init_db(&handle))
                .expect("DB initialization failed");
            handle.manage(pool);

            // Idempotency guard — shared between boot task and start_watching command
            let watcher_flag = WatcherStarted(std::sync::Arc::new(std::sync::Mutex::new(false)));
            handle.manage(watcher_flag.clone());

            // If a watched folder is already configured, start scan + watcher
            let pool2   = app.state::<sqlx::SqlitePool>().inner().clone();
            let flag2   = watcher_flag;
            let handle2 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let row = sqlx::query("SELECT value FROM settings WHERE key = 'watched_folder_path'")
                    .fetch_optional(&pool2)
                    .await;

                if let Ok(Some(row)) = row {
                    if let Some(folder) = row.get::<Option<String>, _>("value") {
                        if let Err(e) = indexer::scanner::initial_scan(&folder, &pool2, &handle2).await {
                            log::error!("boot scan failed: {}", e);
                        }
                        let mut started = flag2.0.lock().unwrap();
                        if !*started {
                            indexer::watcher::start_watcher(folder, pool2, handle2);
                            *started = true;
                        }
                    }
                }
            });

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
            commands::indexer::start_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
