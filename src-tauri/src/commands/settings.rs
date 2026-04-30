use crate::error::AppError;
use sqlx::{Row, SqlitePool};
use tauri::State;

#[tauri::command]
pub async fn get_setting(
    key: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, AppError> {
    let row = sqlx::query("SELECT value FROM settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(&*pool)
        .await?;

    Ok(row.and_then(|r| r.get::<Option<String>, _>("value")))
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(&*pool)
    .await?;
    Ok(())
}
