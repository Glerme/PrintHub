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

    let configured = row
        .and_then(|r| r.get::<Option<String>, _>("value"))
        .and_then(|s| if s.trim().is_empty() { None } else { Some(s) });
    let cmd = configured
        .map(SlicerCmd::simple)
        .or_else(detect_bambu)
        .ok_or_else(|| {
            AppError::Slicer(
                "Bambu Studio não encontrado. Configure o caminho em Configurações.".to_string(),
            )
        })?;

    std::process::Command::new(&cmd.exe)
        .args(&cmd.pre_args)
        .arg("--")
        .arg(&file_path)
        .spawn()
        .map_err(|e| AppError::Slicer(format!("falha ao abrir '{}': {e}", cmd.exe)))?;

    Ok(())
}

struct SlicerCmd {
    exe: String,
    pre_args: Vec<String>,
}

impl SlicerCmd {
    fn simple(exe: impl Into<String>) -> Self {
        Self { exe: exe.into(), pre_args: vec![] }
    }
    fn flatpak(app_id: &str) -> Self {
        Self {
            exe: "/usr/bin/flatpak".to_string(),
            pre_args: vec!["run".to_string(), app_id.to_string()],
        }
    }
}

fn detect_bambu() -> Option<SlicerCmd> {
    // 1. Flatpak (common on Linux distros)
    if std::path::Path::new("/usr/bin/flatpak").exists() {
        let ok = std::process::Command::new("/usr/bin/flatpak")
            .args(["info", "com.bambulab.BambuStudio"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if ok {
            return Some(SlicerCmd::flatpak("com.bambulab.BambuStudio"));
        }
    }

    // 2. Check PATH
    if let Ok(path) = which::which("bambu-studio") {
        return Some(SlicerCmd::simple(path.to_string_lossy().to_string()));
    }

    let home = std::env::var("HOME").unwrap_or_default();

    // 3. Fixed Linux paths (binary installs)
    for candidate in [
        format!("{home}/.local/bin/bambu-studio"),
        "/usr/bin/bambu-studio".to_string(),
        "/opt/bambu-studio/bambu-studio".to_string(),
    ] {
        if std::path::Path::new(&candidate).exists() {
            return Some(SlicerCmd::simple(candidate));
        }
    }

    // 4. Scan common AppImage directories for Bambu_Studio*.AppImage
    for dir in [
        format!("{home}/Applications"),
        format!("{home}/Downloads"),
        format!("{home}/Desktop"),
        "/opt".to_string(),
    ] {
        if let Some(found) = find_appimage(&dir, "Bambu_Studio") {
            return Some(SlicerCmd::simple(found));
        }
    }

    // 5. Windows paths (via LOCALAPPDATA env var)
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let win_path = format!("{local_app_data}\\Programs\\Bambu Studio\\bambu-studio.exe");
        if std::path::Path::new(&win_path).exists() {
            return Some(SlicerCmd::simple(win_path));
        }
    }

    None
}

fn find_appimage(dir: &str, prefix: &str) -> Option<String> {
    let entries = std::fs::read_dir(dir).ok()?;
    let prefix_lower = prefix.to_lowercase();
    entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| {
            let name = p.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_lowercase();
            name.starts_with(&prefix_lower) && name.ends_with(".appimage")
        })
        .map(|p| p.to_string_lossy().to_string())
}
