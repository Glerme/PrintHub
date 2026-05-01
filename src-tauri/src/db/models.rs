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
    // Metadata fields (populated from 3MF extraction or user input)
    pub notes: Option<String>,
    pub source_url: Option<String>,
    pub estimated_print_time_min: Option<i64>,
    pub estimated_filament_g: Option<f64>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct VirtualFolder {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub file_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FilamentRoll {
    pub id: i64,
    pub brand: Option<String>,
    pub material: String,
    pub color_name: Option<String>,
    pub color_hex: Option<String>,
    pub initial_weight_g: f64,
    pub remaining_weight_g: f64,
    pub cost: Option<f64>,
    pub purchased_at: Option<i64>,
    pub notes: Option<String>,
    pub is_active: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
}
