use crate::{db::models::{FileItem, VirtualFolder}, error::AppError};
use sqlx::SqlitePool;
use tauri::State;

const FILE_SELECT: &str = r#"SELECT
    f.id, f.filename, f.ext, f.path, f.size_bytes,
    f.file_created_at, f.added_at, f.virtual_folder_id,
    f.thumbnail_path, f.is_favorite,
    f.notes, f.source_url,
    f.estimated_print_time_min, f.estimated_filament_g,
    (SELECT COUNT(*) FROM print_history ph WHERE ph.file_id = f.id) AS print_count
FROM files f"#;

#[tauri::command]
pub async fn list_files(
    folder_id: Option<i64>,
    search: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    tag_ids: Vec<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<FileItem>, AppError> {
    let sort_col = match sort_by.as_deref().unwrap_or("date_added") {
        "name"         => "f.filename",
        "date_created" => "COALESCE(f.file_created_at, f.added_at)",
        "ext"          => "f.ext",
        _              => "f.added_at",
    };
    let dir = if sort_dir.as_deref() == Some("asc") { "ASC" } else { "DESC" };

    let search_pattern = search.map(|s| format!("%{s}%"));

    // Build optional tag filter (OR semantics: file has at least one selected tag)
    let tag_filter = if tag_ids.is_empty() {
        String::new()
    } else {
        let ph = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        format!("AND f.id IN (SELECT file_id FROM file_tags WHERE tag_id IN ({ph}))")
    };

    let sql = format!(
        "{FILE_SELECT}
         WHERE f.deleted_at IS NULL
           AND (? IS NULL OR f.virtual_folder_id = ?)
           AND (? IS NULL OR f.filename LIKE ?)
           {tag_filter}
         ORDER BY {sort_col} {dir}"
    );

    let mut query = sqlx::query_as::<_, FileItem>(&sql)
        .bind(folder_id)
        .bind(folder_id)
        .bind(&search_pattern)
        .bind(&search_pattern);

    for id in &tag_ids {
        query = query.bind(id);
    }

    Ok(query.fetch_all(&*pool).await?)
}

#[tauri::command]
pub async fn list_virtual_folders(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<VirtualFolder>, AppError> {
    let folders = sqlx::query_as::<_, VirtualFolder>(
        r#"SELECT vf.id, vf.name, vf.color,
                  COUNT(f.id) AS file_count
           FROM virtual_folders vf
           LEFT JOIN files f ON f.virtual_folder_id = vf.id AND f.deleted_at IS NULL
           GROUP BY vf.id
           ORDER BY vf.id ASC"#,
    )
    .fetch_all(&*pool)
    .await?;

    Ok(folders)
}

#[tauri::command]
pub async fn get_file(id: i64, pool: State<'_, SqlitePool>) -> Result<FileItem, AppError> {
    let sql = format!("{FILE_SELECT} WHERE f.id = ? AND f.deleted_at IS NULL");

    sqlx::query_as::<_, FileItem>(&sql)
        .bind(id)
        .fetch_optional(&*pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("file {id}")))
}
