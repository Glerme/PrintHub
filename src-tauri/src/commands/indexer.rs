use crate::{
    error::AppError,
    indexer::{scanner, watcher},
};
use sqlx::SqlitePool;
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// Triggers a manual re-scan of the configured watched folder.
#[tauri::command]
pub async fn trigger_rescan(pool: State<'_, SqlitePool>, app: AppHandle) -> Result<usize, AppError> {
    use sqlx::Row;
    let row = sqlx::query("SELECT value FROM settings WHERE key = 'watched_folder_path'")
        .fetch_optional(&*pool)
        .await?;
    if let Some(row) = row {
        if let Some(folder) = row.get::<Option<String>, _>("value") {
            return scanner::initial_scan(&folder, &pool, &app).await;
        }
    }
    Err(AppError::NotFound("pasta monitorada não configurada".into()))
}

/// Guards against starting multiple watchers (e.g., fast double-click or
/// concurrent calls from Settings + boot task). Arc allows cloning for async tasks.
#[derive(Clone)]
pub struct WatcherStarted(pub std::sync::Arc<Mutex<bool>>);

/// Called by the frontend after onboarding (or settings change).
/// Idempotent: if a watcher is already running, re-scans but does NOT
/// start a second background thread.
#[tauri::command]
pub async fn start_watching(
    folder: String,
    pool: State<'_, SqlitePool>,
    watcher_started: State<'_, WatcherStarted>,
    app: AppHandle,
) -> Result<(), AppError> {
    let pool_ref = pool.inner().clone();

    // Always re-scan (picks up changes since last run)
    scanner::initial_scan(&folder, &pool_ref, &app).await?;

    // Only start the background watcher thread once
    let mut started = watcher_started.0.lock().unwrap();
    if !*started {
        watcher::start_watcher(folder, pool_ref, app);
        *started = true;
    } else {
        log::info!("watcher already running — skipping thread spawn");
    }

    Ok(())
}
