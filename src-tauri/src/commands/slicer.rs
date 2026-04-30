use crate::error::AppError;
use sqlx::{Row, SqlitePool};
use tauri::State;

#[tauri::command]
pub async fn open_in_slicer(
    file_path: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    // Prefer user-configured path, then auto-detect
    let row = sqlx::query("SELECT value FROM settings WHERE key = 'bambu_studio_path'")
        .fetch_optional(&*pool)
        .await?;

    let configured = row.and_then(|r| r.get::<Option<String>, _>("value"));
    let exe = configured
        .or_else(detect_bambu)
        .ok_or_else(|| {
            AppError::Slicer(
                "Bambu Studio não encontrado. Configure o caminho em Configurações.".to_string(),
            )
        })?;

    std::process::Command::new(&exe)
        .arg(&file_path)
        .spawn()
        .map_err(|e| AppError::Slicer(format!("falha ao abrir '{exe}': {e}")))?;

    Ok(())
}

fn detect_bambu() -> Option<String> {
    // 1. Check PATH
    if let Ok(path) = which::which("bambu-studio") {
        return Some(path.to_string_lossy().to_string());
    }

    let home = std::env::var("HOME").unwrap_or_default();

    // 2. Common Linux paths
    for candidate in [
        format!("{home}/.local/bin/bambu-studio"),
        format!("{home}/Applications/Bambu_Studio.AppImage"),
        "/usr/bin/bambu-studio".to_string(),
        "/opt/bambu-studio/bambu-studio".to_string(),
    ] {
        if std::path::Path::new(&candidate).exists() {
            return Some(candidate);
        }
    }

    // 3. Windows paths (via LOCALAPPDATA env var)
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let win_path = format!("{local_app_data}\\Programs\\Bambu Studio\\bambu-studio.exe");
        if std::path::Path::new(&win_path).exists() {
            return Some(win_path);
        }
    }

    None
}
