// File watcher using notify-debouncer-full (debounce: 500ms).
// Runs in its own tokio task; communicates with indexer_worker via mpsc channel.
// Emits Tauri events: "file-added", "file-removed", "thumbnail-ready".
// Handle stored in tauri::State<Mutex<Debouncer>> — dropping it silences the watcher.
