use crate::{db::models::Tag, error::AppError};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_tags(pool: State<'_, SqlitePool>) -> Result<Vec<Tag>, AppError> {
    let tags = sqlx::query_as::<_, Tag>("SELECT id, name, color FROM tags ORDER BY name ASC")
        .fetch_all(&*pool)
        .await?;
    Ok(tags)
}

#[tauri::command]
pub async fn list_file_tags(
    file_id: i64,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Tag>, AppError> {
    let tags = sqlx::query_as::<_, Tag>(
        "SELECT t.id, t.name, t.color FROM tags t
         INNER JOIN file_tags ft ON ft.tag_id = t.id
         WHERE ft.file_id = ?
         ORDER BY t.name ASC",
    )
    .bind(file_id)
    .fetch_all(&*pool)
    .await?;
    Ok(tags)
}

#[tauri::command]
pub async fn create_tag(
    name: String,
    color: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Tag, AppError> {
    use sqlx::Row;

    // Find-or-create: never overwrites an existing tag's color
    if let Some(row) = sqlx::query("SELECT id, name, color FROM tags WHERE name = ?")
        .bind(&name)
        .fetch_optional(&*pool)
        .await?
    {
        return Ok(Tag {
            id:    row.get("id"),
            name:  row.get("name"),
            color: row.get("color"),
        });
    }

    let id = sqlx::query("INSERT INTO tags (name, color) VALUES (?, ?) RETURNING id")
        .bind(&name)
        .bind(&color)
        .fetch_one(&*pool)
        .await
        .map(|r: sqlx::sqlite::SqliteRow| r.get::<i64, _>("id"))?;

    Ok(Tag { id, name, color })
}

#[tauri::command]
pub async fn add_file_tag(
    file_id: i64,
    tag_id: i64,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?, ?)",
    )
    .bind(file_id)
    .bind(tag_id)
    .execute(&*pool)
    .await?;
    Ok(())
}

#[tauri::command]
pub async fn remove_file_tag(
    file_id: i64,
    tag_id: i64,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?")
        .bind(file_id)
        .bind(tag_id)
        .execute(&*pool)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_tag(id: i64, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    // file_tags has ON DELETE CASCADE so file associations are removed automatically
    sqlx::query("DELETE FROM tags WHERE id = ?")
        .bind(id)
        .execute(&*pool)
        .await?;
    Ok(())
}
