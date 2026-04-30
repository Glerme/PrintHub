use std::path::{Path, PathBuf};

/// Saves PNG `bytes` as `<file_id>.png` inside `dir`.
/// Returns the absolute path where the file was written.
pub fn save(file_id: i64, bytes: &[u8], dir: &Path) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(format!("{file_id}.png"));
    std::fs::write(&path, bytes)?;
    Ok(path)
}
