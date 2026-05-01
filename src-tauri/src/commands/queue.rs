use crate::{db::models::QueueItem, error::AppError};
use sqlx::SqlitePool;
use tauri::State;

const QUEUE_SELECT: &str = r#"SELECT
    pq.id AS queue_id, pq.file_id, pq.position, pq.added_at,
    f.filename, f.ext, f.path, f.thumbnail_path,
    (SELECT COUNT(*) FROM print_history ph WHERE ph.file_id = f.id) AS print_count
FROM print_queue pq
INNER JOIN files f ON f.id = pq.file_id AND f.deleted_at IS NULL
ORDER BY pq.position ASC"#;

#[tauri::command]
pub async fn list_print_queue(pool: State<'_, SqlitePool>) -> Result<Vec<QueueItem>, AppError> {
    let items = sqlx::query_as::<_, QueueItem>(QUEUE_SELECT)
        .fetch_all(&*pool)
        .await?;
    Ok(items)
}

#[tauri::command]
pub async fn add_to_queue(file_id: i64, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    sqlx::query(
        "INSERT INTO print_queue (file_id, position, added_at)
         VALUES (?, (SELECT COALESCE(MAX(position), -1) + 1 FROM print_queue), ?)
         ON CONFLICT(file_id) DO NOTHING",
    )
    .bind(file_id)
    .bind(now)
    .execute(&*pool)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn remove_from_queue(file_id: i64, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    sqlx::query("DELETE FROM print_queue WHERE file_id = ?")
        .bind(file_id)
        .execute(&*pool)
        .await?;
    Ok(())
}

/// Accepts an ordered list of file_ids and sets their `position` in a single transaction.
#[tauri::command]
pub async fn reorder_queue(
    ordered_ids: Vec<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    for (pos, file_id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE print_queue SET position = ? WHERE file_id = ?")
            .bind(pos as i64)
            .bind(file_id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}
