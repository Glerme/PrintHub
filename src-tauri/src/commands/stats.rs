use crate::error::AppError;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthStat {
    pub month: String,      // "YYYY-MM"
    pub print_count: i64,
    pub revenue: f64,
    pub filament_cost: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerStat {
    pub name: String,
    pub print_count: i64,
    pub total_revenue: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialStat {
    pub material: String,
    pub total_g: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LowFilamentWarning {
    pub id: i64,
    pub label: String,      // brand · material · color
    pub color_hex: Option<String>,
    pub remaining_g: f64,
    pub initial_g: f64,
    pub pct: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_prints: i64,
    pub success_count: i64,
    pub failed_count: i64,
    pub partial_count: i64,
    pub total_revenue: f64,
    pub total_filament_cost: f64,
    pub total_filament_g: f64,
    pub profit: f64,
    pub by_month: Vec<MonthStat>,
    pub top_customers: Vec<CustomerStat>,
    pub by_material: Vec<MaterialStat>,
    pub low_filament: Vec<LowFilamentWarning>,
}

#[tauri::command]
pub async fn get_dashboard_stats(
    from_ts: Option<i64>,
    to_ts: Option<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<DashboardStats, AppError> {
    // Summary
    let summary = sqlx::query(
        r#"SELECT
            COUNT(*)                                                   AS total_prints,
            COALESCE(SUM(sale_value), 0.0)                            AS total_revenue,
            COALESCE(SUM(filament_cost), 0.0)                         AS total_filament_cost,
            COALESCE(SUM(actual_filament_g), 0.0)                     AS total_filament_g,
            COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success_count,
            COALESCE(SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END), 0) AS failed_count,
            COALESCE(SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END), 0) AS partial_count
        FROM print_history
        WHERE (? IS NULL OR printed_at >= ?)
          AND (? IS NULL OR printed_at <= ?)"#,
    )
    .bind(from_ts).bind(from_ts)
    .bind(to_ts).bind(to_ts)
    .fetch_one(&*pool)
    .await?;

    let total_prints:         i64 = summary.get("total_prints");
    let total_revenue:        f64 = summary.get("total_revenue");
    let total_filament_cost:  f64 = summary.get("total_filament_cost");
    let total_filament_g:     f64 = summary.get("total_filament_g");
    let success_count:        i64 = summary.get("success_count");
    let failed_count:         i64 = summary.get("failed_count");
    let partial_count:        i64 = summary.get("partial_count");

    // Prints + revenue by month
    let month_rows = sqlx::query(
        r#"SELECT
            strftime('%Y-%m', datetime(printed_at, 'unixepoch')) AS month,
            COUNT(*)                            AS print_count,
            COALESCE(SUM(sale_value), 0.0)      AS revenue,
            COALESCE(SUM(filament_cost), 0.0)   AS filament_cost
        FROM print_history
        WHERE (? IS NULL OR printed_at >= ?)
          AND (? IS NULL OR printed_at <= ?)
        GROUP BY month
        ORDER BY month ASC"#,
    )
    .bind(from_ts).bind(from_ts)
    .bind(to_ts).bind(to_ts)
    .fetch_all(&*pool)
    .await?;

    let by_month: Vec<MonthStat> = month_rows.iter().map(|r| MonthStat {
        month:         r.get("month"),
        print_count:   r.get("print_count"),
        revenue:       r.get("revenue"),
        filament_cost: r.get("filament_cost"),
    }).collect();

    // Top customers
    let customer_rows = sqlx::query(
        r#"SELECT customer_name AS name,
                  COUNT(*)                     AS print_count,
                  COALESCE(SUM(sale_value), 0.0) AS total_revenue
           FROM print_history
           WHERE customer_name IS NOT NULL
             AND (? IS NULL OR printed_at >= ?)
             AND (? IS NULL OR printed_at <= ?)
           GROUP BY customer_name
           ORDER BY total_revenue DESC
           LIMIT 10"#,
    )
    .bind(from_ts).bind(from_ts)
    .bind(to_ts).bind(to_ts)
    .fetch_all(&*pool)
    .await?;

    let top_customers: Vec<CustomerStat> = customer_rows.iter().map(|r| CustomerStat {
        name:          r.get("name"),
        print_count:   r.get("print_count"),
        total_revenue: r.get("total_revenue"),
    }).collect();

    // Filament used by material (from filament_rolls)
    let mat_rows = sqlx::query(
        r#"SELECT fr.material,
                  COALESCE(SUM(ph.actual_filament_g), 0.0) AS total_g
           FROM filament_rolls fr
           INNER JOIN print_history ph ON ph.filament_roll_id = fr.id
           WHERE (? IS NULL OR ph.printed_at >= ?)
             AND (? IS NULL OR ph.printed_at <= ?)
           GROUP BY fr.material
           ORDER BY total_g DESC"#,
    )
    .bind(from_ts).bind(from_ts)
    .bind(to_ts).bind(to_ts)
    .fetch_all(&*pool)
    .await?;

    let by_material: Vec<MaterialStat> = mat_rows.iter().map(|r| MaterialStat {
        material: r.get("material"),
        total_g:  r.get("total_g"),
    }).collect();

    // Low filament warnings (active rolls with < 20% remaining)
    let low_rows = sqlx::query(
        r#"SELECT id, brand, material, color_name, color_hex, remaining_weight_g, initial_weight_g
           FROM filament_rolls
           WHERE is_active = 1
             AND initial_weight_g > 0
             AND (remaining_weight_g / initial_weight_g) < 0.2
           ORDER BY (remaining_weight_g / initial_weight_g) ASC"#,
    )
    .fetch_all(&*pool)
    .await?;

    let low_filament: Vec<LowFilamentWarning> = low_rows.iter().map(|r| {
        let brand: Option<String>     = r.get("brand");
        let material: String          = r.get("material");
        let color_name: Option<String> = r.get("color_name");
        let remaining: f64            = r.get("remaining_weight_g");
        let initial: f64              = r.get("initial_weight_g");
        let parts: Vec<&str> = [brand.as_deref(), Some(material.as_str()), color_name.as_deref()]
            .iter().filter_map(|&x| x).collect();
        LowFilamentWarning {
            id: r.get("id"),
            label: parts.join(" · "),
            color_hex: r.get("color_hex"),
            remaining_g: remaining,
            initial_g: initial,
            pct: (remaining / initial * 100.0).round(),
        }
    }).collect();

    Ok(DashboardStats {
        total_prints,
        success_count,
        failed_count,
        partial_count,
        total_revenue,
        total_filament_cost,
        total_filament_g,
        profit: total_revenue - total_filament_cost,
        by_month,
        top_customers,
        by_material,
        low_filament,
    })
}
