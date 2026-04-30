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
