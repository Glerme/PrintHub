use crate::{db::models::VirtualFolder, error::AppError};
use sqlx::SqlitePool;
use tauri::State;

const INBOX_ID: i64 = 1; // "Não categorizado" — cannot be deleted

#[tauri::command]
pub async fn create_virtual_folder(
    name: String,
    color: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<VirtualFolder, AppError> {
    let id = sqlx::query(
        "INSERT INTO virtual_folders (name, color) VALUES (?, ?) RETURNING id",
    )
    .bind(&name)
    .bind(&color)
    .fetch_one(&*pool)
    .await
    .map(|r: sqlx::sqlite::SqliteRow| { use sqlx::Row; r.get::<i64, _>("id") })?;

    Ok(VirtualFolder { id, name, color, file_count: 0 })
}

#[tauri::command]
pub async fn rename_virtual_folder(
    id: i64,
    name: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    if id == INBOX_ID {
        return Err(AppError::NotFound("cannot rename the inbox folder".into()));
    }
    sqlx::query("UPDATE virtual_folders SET name = ? WHERE id = ?")
        .bind(&name)
        .bind(id)
        .execute(&*pool)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_virtual_folder(
    id: i64,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    if id == INBOX_ID {
        return Err(AppError::NotFound("cannot delete the inbox folder".into()));
    }
    // Wrap both statements in a transaction — partial failure leaves no orphaned state
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE files SET virtual_folder_id = ? WHERE virtual_folder_id = ?")
        .bind(INBOX_ID)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM virtual_folders WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

#[tauri::command]
pub async fn set_file_folder(
    file_id: i64,
    folder_id: i64,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    sqlx::query("UPDATE files SET virtual_folder_id = ? WHERE id = ?")
        .bind(folder_id)
        .bind(file_id)
        .execute(&*pool)
        .await?;
    Ok(())
}
