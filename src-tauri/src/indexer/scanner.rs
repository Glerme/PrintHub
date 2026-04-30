use crate::error::AppError;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

fn is_3d_file(path: &std::path::Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .as_deref(),
        Some("stl") | Some("3mf")
    )
}

/// Scans `folder` recursively and upserts all STL/3MF files into `files` table.
/// Emits `index-progress` and `index-done` events.
pub async fn initial_scan(
    folder: &str,
    pool: &SqlitePool,
    app: &AppHandle,
) -> Result<usize, AppError> {
    let folder_owned = folder.to_string();

    // Collect paths on a blocking thread (walkdir is sync IO)
    let paths: Vec<PathBuf> = tokio::task::spawn_blocking(move || {
        WalkDir::new(&folder_owned)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file() && is_3d_file(e.path()))
            .map(|e| e.path().to_path_buf())
            .collect()
    })
    .await?;

    let total = paths.len();
    let mut processed = 0usize;

    // Upsert in batches of 50 inside a transaction each
    for chunk in paths.chunks(50) {
        let mut tx = pool.begin().await?;

        for path in chunk {
            if let Ok(meta) = std::fs::metadata(path) {
                let filename = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let ext = path
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                let path_str = path.to_string_lossy().to_string();
                let size_bytes = meta.len() as i64;
                let mtime = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64);
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                sqlx::query(
                    r#"INSERT INTO files
                           (path, filename, ext, size_bytes, file_created_at, added_at, virtual_folder_id)
                       VALUES (?, ?, ?, ?, ?, ?, 1)
                       ON CONFLICT(path) DO UPDATE SET
                           size_bytes      = excluded.size_bytes,
                           file_created_at = excluded.file_created_at,
                           deleted_at      = NULL"#,
                )
                .bind(&path_str)
                .bind(&filename)
                .bind(ext.as_str())
                .bind(size_bytes)
                .bind(mtime)
                .bind(now)
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;
        processed += chunk.len();

        let _ = app.emit(
            "index-progress",
            serde_json::json!({ "current": processed, "total": total }),
        );
    }

    let _ = app.emit("index-done", serde_json::json!({ "total": total }));
    log::info!("initial scan complete: {} files indexed in {}", total, folder);

    // Extract 3MF thumbnails in background (non-blocking for the caller)
    let pool2 = pool.clone();
    let app2  = app.clone();
    tokio::spawn(async move {
        extract_pending_thumbnails(&pool2, &app2).await;
    });

    Ok(total)
}

/// Upserts a single file (used by the watcher when a file is created/modified).
pub async fn upsert_file(path: &std::path::Path, pool: &SqlitePool) -> Result<i64, AppError> {
    let meta = std::fs::metadata(path)?;
    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let path_str = path.to_string_lossy().to_string();
    let size_bytes = meta.len() as i64;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    sqlx::query(
        r#"INSERT INTO files
               (path, filename, ext, size_bytes, file_created_at, added_at, virtual_folder_id)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(path) DO UPDATE SET
               size_bytes      = excluded.size_bytes,
               file_created_at = excluded.file_created_at,
               deleted_at      = NULL
           RETURNING id"#,
    )
    .bind(&path_str)
    .bind(&filename)
    .bind(ext.as_str())
    .bind(size_bytes)
    .bind(mtime)
    .bind(now)
    .fetch_one(pool)
    .await
    .map(|r: sqlx::sqlite::SqliteRow| {
        use sqlx::Row;
        r.get::<i64, _>("id")
    })
    .map_err(Into::into)
}

// ── Thumbnail extraction ──────────────────────────────────────────────────────

/// Processes a single 3MF file: extracts thumbnail + estimates, saves to disk,
/// updates DB and emits `thumbnail-ready`. Called by the watcher for new files.
pub async fn extract_for_file(file_id: i64, file_path: &str, pool: &SqlitePool, app: &AppHandle) {
    use tauri::Manager;

    let thumbnails_dir = match app.path().app_data_dir() {
        Ok(d) => d.join("thumbnails"),
        Err(_) => return,
    };

    let path = std::path::PathBuf::from(file_path);
    let data = tokio::task::spawn_blocking(move || super::threemf::extract(&path))
        .await
        .unwrap_or_default();

    // Update metadata regardless of thumbnail
    let _ = sqlx::query(
        "UPDATE files SET estimated_print_time_min = ?, estimated_filament_g = ? WHERE id = ?",
    )
    .bind(data.estimated_print_time_min)
    .bind(data.estimated_filament_g)
    .bind(file_id)
    .execute(pool)
    .await;

    if let Some(bytes) = data.thumbnail_bytes {
        match crate::thumbnail::save(file_id, &bytes, &thumbnails_dir) {
            Ok(thumb_path) => {
                let path_str = thumb_path.to_string_lossy().to_string();
                // Only emit the event after the DB write is confirmed
                match sqlx::query("UPDATE files SET thumbnail_path = ? WHERE id = ?")
                    .bind(&path_str)
                    .bind(file_id)
                    .execute(pool)
                    .await
                {
                    Ok(_) => {
                        let _ = app.emit(
                            "thumbnail-ready",
                            serde_json::json!({ "id": file_id, "path": path_str }),
                        );
                    }
                    Err(e) => log::error!("update thumbnail_path for file {}: {}", file_id, e),
                }
            }
            Err(e) => log::error!("save thumbnail for file {}: {}", file_id, e),
        }
    }
}

/// Background task: processes all 3MF files in the DB that don't yet have a thumbnail.
/// Runs with limited concurrency (4 parallel extractions).
pub async fn extract_pending_thumbnails(pool: &SqlitePool, app: &AppHandle) {
    use sqlx::Row;

    let rows = match sqlx::query(
        "SELECT id, path FROM files WHERE ext = '3mf' AND thumbnail_path IS NULL AND deleted_at IS NULL",
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(_) => return,
    };

    if rows.is_empty() { return; }
    log::info!("extracting thumbnails for {} 3MF files…", rows.len());

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(4));

    for row in rows {
        let file_id: i64      = row.get("id");
        let file_path: String = row.get("path");
        let pool2 = pool.clone();
        let app2  = app.clone();

        // Acquire permit in the outer loop — caps spawned-but-pending tasks at 4
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        tokio::spawn(async move {
            let _permit = permit; // released when task completes
            extract_for_file(file_id, &file_path, &pool2, &app2).await;
        });
    }
}

/// Soft-deletes a file by path (sets deleted_at).
pub async fn soft_delete_file(path: &str, pool: &SqlitePool) -> Result<(), AppError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    sqlx::query("UPDATE files SET deleted_at = ? WHERE path = ? AND deleted_at IS NULL")
        .bind(now)
        .bind(path)
        .execute(pool)
        .await?;

    Ok(())
}
