// Thumbnail cache management.
// STL thumbnails are rendered off-screen in the frontend (react-three-fiber)
// and written here via a Tauri command.
// 3MF thumbnails are extracted from the ZIP by indexer/threemf.rs.
// Cache location: app_data_dir()/thumbnails/<file_id>.png
