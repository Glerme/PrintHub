use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub id: i64,
    pub filename: String,
    pub ext: String,
    pub path: String,
    pub size_bytes: Option<i64>,
    pub file_created_at: Option<i64>,
    pub added_at: i64,
    pub virtual_folder_id: Option<i64>,
    pub thumbnail_path: Option<String>,
    pub is_favorite: i64,
    pub print_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct VirtualFolder {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub file_count: i64,
}
