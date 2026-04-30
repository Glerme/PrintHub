use super::scanner::{soft_delete_file, upsert_file};
use notify::{EventKind, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult};
use sqlx::SqlitePool;
use std::{path::PathBuf, time::Duration};
use tauri::{AppHandle, Emitter};

fn is_3d_file(path: &std::path::Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .as_deref(),
        Some("stl") | Some("3mf")
    )
}

async fn handle_events(result: DebounceEventResult, pool: SqlitePool, app: AppHandle) {
    let events = match result {
        Ok(events) => events,
        Err(errors) => {
            for e in errors {
                log::error!("watcher error: {:?}", e);
            }
            return;
        }
    };

    let mut added: Vec<PathBuf> = Vec::new();
    let mut removed: Vec<PathBuf> = Vec::new();

    for debounced in events {
        let ev = &debounced.event;
        match &ev.kind {
            EventKind::Create(_) | EventKind::Modify(_) => {
                for path in &ev.paths {
                    if is_3d_file(path) && path.is_file() {
                        added.push(path.clone());
                    }
                }
            }
            EventKind::Remove(_) => {
                for path in &ev.paths {
                    if is_3d_file(path) {
                        removed.push(path.clone());
                    }
                }
            }
            _ => {}
        }
    }

    // Process additions/modifications
    for path in added {
        match upsert_file(&path, &pool).await {
            Ok(id) => {
                let filename = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let _ = app.emit("file-added", serde_json::json!({ "id": id, "filename": filename }));

                // Extract thumbnail for new 3MF files
                if path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref() == Some("3mf") {
                    let path_str = path.to_string_lossy().to_string();
                    let pool2 = pool.clone();
                    let app2  = app.clone();
                    tokio::spawn(async move {
                        super::scanner::extract_for_file(id, &path_str, &pool2, &app2).await;
                    });
                }
            }
            Err(e) => log::error!("upsert_file error for {:?}: {}", path, e),
        }
    }

    // Process removals
    for path in removed {
        let path_str = path.to_string_lossy().to_string();
        if let Err(e) = soft_delete_file(&path_str, &pool).await {
            log::error!("soft_delete_file error for {:?}: {}", path, e);
        } else {
            let _ = app.emit("file-removed", serde_json::json!({ "path": path_str }));
        }
    }
}

/// Starts the file watcher in a background thread.
/// The debouncer lives for the lifetime of the thread (until process exit).
/// TODO: add a shutdown channel to stop/restart the watcher when the folder changes.
pub fn start_watcher(folder: String, pool: SqlitePool, app: AppHandle) {
    let rt = tokio::runtime::Handle::current();

    std::thread::spawn(move || {
        let pool_c = pool.clone();
        let app_c = app.clone();

        let mut debouncer = match new_debouncer(
            Duration::from_millis(500),
            None,
            move |result: DebounceEventResult| {
                let pool = pool_c.clone();
                let app = app_c.clone();
                rt.spawn(handle_events(result, pool, app));
            },
        ) {
            Ok(d) => d,
            Err(e) => {
                log::error!("failed to create file watcher: {}", e);
                return;
            }
        };

        if let Err(e) = debouncer
            .watch(std::path::Path::new(&folder), notify::RecursiveMode::Recursive)
        {
            log::error!("failed to watch folder '{}': {}", folder, e);
            return;
        }

        log::info!("file watcher started for: {}", folder);

        // Keep the thread alive so the debouncer isn't dropped
        loop {
            std::thread::sleep(Duration::from_secs(60));
        }
    });
}
