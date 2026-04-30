// Initial recursive scan of the watched folder.
// Uses walkdir + spawn_blocking to avoid blocking the async runtime.
// Emits "index-progress" and "index-done" Tauri events.
