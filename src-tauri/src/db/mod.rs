pub mod models;

use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, sqlx::Error> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");

    std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");

    let db_path = app_dir.join("db.sqlite");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePool::connect(&db_url).await?;

    // Performance + integrity
    sqlx::query("PRAGMA journal_mode=WAL").execute(&pool).await?;
    sqlx::query("PRAGMA foreign_keys=ON").execute(&pool).await?;
    sqlx::query("PRAGMA synchronous=NORMAL").execute(&pool).await?;

    // Run versioned migrations from src-tauri/migrations/
    sqlx::migrate!("./migrations").run(&pool).await?;

    log::info!("DB initialized at {}", db_path.display());
    Ok(pool)
}
