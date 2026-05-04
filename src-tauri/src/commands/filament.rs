use crate::{db::models::FilamentRoll, error::AppError};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_filament_rolls(pool: State<'_, SqlitePool>) -> Result<Vec<FilamentRoll>, AppError> {
    let rolls = sqlx::query_as::<_, FilamentRoll>(
        "SELECT id, brand, material, color_name, color_hex,
                initial_weight_g, remaining_weight_g, cost,
                purchased_at, notes, is_active
         FROM filament_rolls
         ORDER BY is_active DESC, purchased_at DESC",
    )
    .fetch_all(&*pool)
    .await?;
    Ok(rolls)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_filament_roll(
    brand: Option<String>,
    material: String,
    color_name: Option<String>,
    color_hex: Option<String>,
    initial_weight_g: f64,
    cost: Option<f64>,
    notes: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<FilamentRoll, AppError> {
    use sqlx::Row;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let id = sqlx::query(
        "INSERT INTO filament_rolls
             (brand, material, color_name, color_hex, initial_weight_g,
              remaining_weight_g, cost, purchased_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(&brand)
    .bind(&material)
    .bind(&color_name)
    .bind(&color_hex)
    .bind(initial_weight_g)
    .bind(initial_weight_g)
    .bind(cost)
    .bind(now)
    .bind(&notes)
    .fetch_one(&*pool)
    .await
    .map(|r: sqlx::sqlite::SqliteRow| r.get::<i64, _>("id"))?;

    Ok(FilamentRoll {
        id,
        brand,
        material,
        color_name,
        color_hex,
        initial_weight_g,
        remaining_weight_g: initial_weight_g,
        cost,
        purchased_at: Some(now),
        notes,
        is_active: 1,
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_filament_roll(
    id: i64,
    brand: Option<String>,
    material: String,
    color_name: Option<String>,
    color_hex: Option<String>,
    initial_weight_g: f64,
    remaining_weight_g: f64,
    cost: Option<f64>,
    notes: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    // Enforce invariant: 0 <= remaining <= initial
    let clamped_remaining = remaining_weight_g.clamp(0.0, initial_weight_g);

    sqlx::query(
        "UPDATE filament_rolls SET
             brand = ?, material = ?, color_name = ?, color_hex = ?,
             initial_weight_g = ?, remaining_weight_g = ?, cost = ?, notes = ?
         WHERE id = ?",
    )
    .bind(brand)
    .bind(material)
    .bind(color_name)
    .bind(color_hex)
    .bind(initial_weight_g)
    .bind(clamped_remaining)
    .bind(cost)
    .bind(notes)
    .bind(id)
    .execute(&*pool)
    .await?;
    Ok(())
}

/// Sets `remaining_weight_g` directly — used after taring/weighing the roll.
/// Clamps to [0, initial_weight_g] to prevent impossible stock states.
#[tauri::command]
pub async fn adjust_filament_remaining(
    id: i64,
    remaining_g: f64,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    use sqlx::Row;
    let initial: f64 = sqlx::query("SELECT initial_weight_g FROM filament_rolls WHERE id = ?")
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map(|r: sqlx::sqlite::SqliteRow| r.get::<f64, _>("initial_weight_g"))
        .unwrap_or(f64::MAX);

    let clamped = remaining_g.clamp(0.0, initial);

    sqlx::query("UPDATE filament_rolls SET remaining_weight_g = ? WHERE id = ?")
        .bind(clamped)
        .bind(id)
        .execute(&*pool)
        .await?;
    Ok(())
}

/// Toggles `is_active` (archive ↔ unarchive).
#[tauri::command]
pub async fn toggle_filament_roll(id: i64, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE filament_rolls SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?",
    )
    .bind(id)
    .execute(&*pool)
    .await?;
    Ok(())
}
