use crate::error::AppError;
use base64::Engine as _;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager, State};

/// Receives a base64-encoded PNG from the frontend (off-screen Canvas capture),
/// saves it to the thumbnail cache, updates the DB, and emits `thumbnail-ready`.
#[tauri::command]
pub async fn save_stl_thumbnail(
    file_id: i64,
    png_base64: String,
    pool: State<'_, SqlitePool>,
    app: AppHandle,
) -> Result<(), AppError> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&png_base64)
        .map_err(|e| AppError::Parse(format!("base64 decode: {e}")))?;

    let thumbnails_dir = app
        .path()
        .app_data_dir()
        .expect("no app data dir")
        .join("thumbnails");

    let thumb_path = crate::thumbnail::save(file_id, &bytes, &thumbnails_dir)?;
    let path_str = thumb_path.to_string_lossy().to_string();

    sqlx::query("UPDATE files SET thumbnail_path = ? WHERE id = ?")
        .bind(&path_str)
        .bind(file_id)
        .execute(&*pool)
        .await?;

    let _ = app.emit("thumbnail-ready", serde_json::json!({ "id": file_id, "path": path_str }));

    Ok(())
}
