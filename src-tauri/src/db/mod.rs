pub mod models;

// SqlitePool is stored in tauri::State.
// Initialized in lib.rs setup: sqlx::migrate!() runs on boot, WAL mode enabled.
// DB path: app_data_dir()/db.sqlite (resolved by Tauri per OS).
