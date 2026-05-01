use crate::{db::models::PrintHistory, error::AppError};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_print_history(
    file_id: i64,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<PrintHistory>, AppError> {
    let history = sqlx::query_as::<_, PrintHistory>(
        "SELECT id, file_id, printed_at, actual_time_min, actual_filament_g,
                filament_cost, customer_name, sale_value, currency,
                filament_roll_id, notes, status
         FROM print_history
         WHERE file_id = ?
         ORDER BY printed_at DESC",
    )
    .bind(file_id)
    .fetch_all(&*pool)
    .await?;
    Ok(history)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn add_print_history(
    file_id: i64,
    printed_at: i64,
    actual_time_min: Option<i64>,
    actual_filament_g: Option<f64>,
    filament_cost: Option<f64>,
    customer_name: Option<String>,
    sale_value: Option<f64>,
    filament_roll_id: Option<i64>,
    notes: Option<String>,
    status: String,
    pool: State<'_, SqlitePool>,
) -> Result<PrintHistory, AppError> {
    use sqlx::Row;

    let mut tx = pool.begin().await?;

    // Insert print record
    let id = sqlx::query(
        "INSERT INTO print_history
             (file_id, printed_at, actual_time_min, actual_filament_g,
              filament_cost, customer_name, sale_value, currency,
              filament_roll_id, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?)
         RETURNING id",
    )
    .bind(file_id)
    .bind(printed_at)
    .bind(actual_time_min)
    .bind(actual_filament_g)
    .bind(filament_cost)
    .bind(&customer_name)
    .bind(sale_value)
    .bind(filament_roll_id)
    .bind(&notes)
    .bind(&status)
    .fetch_one(&mut *tx)
    .await
    .map(|r: sqlx::sqlite::SqliteRow| r.get::<i64, _>("id"))?;

    // Decrement filament roll if provided
    if let (Some(roll_id), Some(used_g)) = (filament_roll_id, actual_filament_g) {
        sqlx::query(
            "UPDATE filament_rolls
             SET remaining_weight_g = MAX(0.0, remaining_weight_g - ?)
             WHERE id = ?",
        )
        .bind(used_g)
        .bind(roll_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(PrintHistory {
        id,
        file_id,
        printed_at,
        actual_time_min,
        actual_filament_g,
        filament_cost,
        customer_name,
        sale_value,
        currency: "BRL".into(),
        filament_roll_id,
        notes,
        status,
    })
}

#[tauri::command]
pub async fn delete_print_history(
    id: i64,
    restore_filament: bool,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    use sqlx::Row;

    let mut tx = pool.begin().await?;

    if restore_filament {
        // Propagate query errors — don't silently skip restore on DB failure
        let row = sqlx::query(
            "SELECT filament_roll_id, actual_filament_g FROM print_history WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(row) = row {
            let roll_id: Option<i64> = row.get("filament_roll_id");
            let used_g: Option<f64>  = row.get("actual_filament_g");

            if let (Some(roll_id), Some(used_g)) = (roll_id, used_g) {
                sqlx::query(
                    "UPDATE filament_rolls
                     SET remaining_weight_g = MIN(initial_weight_g, remaining_weight_g + ?)
                     WHERE id = ?",
                )
                .bind(used_g)
                .bind(roll_id)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    sqlx::query("DELETE FROM print_history WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}
