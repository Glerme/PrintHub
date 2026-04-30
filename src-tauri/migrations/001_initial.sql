-- Print Hub — schema inicial
-- Timestamps: INTEGER (Unix epoch seconds)

CREATE TABLE IF NOT EXISTS virtual_folders (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    parent_id INTEGER REFERENCES virtual_folders(id) ON DELETE SET NULL,
    color     TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Pasta especial "Não categorizado" inserida por seed (id = 1)
INSERT OR IGNORE INTO virtual_folders (id, name, color, created_at)
VALUES (1, 'Não categorizado', '#6b7280', unixepoch());

CREATE TABLE IF NOT EXISTS files (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    path                    TEXT    NOT NULL UNIQUE,
    filename                TEXT    NOT NULL,
    ext                     TEXT    NOT NULL CHECK (ext IN ('stl', '3mf')),
    size_bytes              INTEGER,
    file_created_at         INTEGER,           -- mtime do arquivo no disco
    added_at                INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at              INTEGER,           -- soft delete
    virtual_folder_id       INTEGER REFERENCES virtual_folders(id) ON DELETE SET NULL DEFAULT 1,
    source_url              TEXT,
    notes                   TEXT,
    is_favorite             INTEGER NOT NULL DEFAULT 0,
    -- Metadados extraídos do 3MF (NULL para STL)
    estimated_print_time_min INTEGER,
    estimated_filament_g    REAL,
    thumbnail_path          TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(virtual_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_ext    ON files(ext);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted_at);

CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE,
    color TEXT
);

CREATE TABLE IF NOT EXISTS file_tags (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

CREATE TABLE IF NOT EXISTS filament_rolls (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    brand             TEXT,
    material          TEXT    NOT NULL,
    color_name        TEXT,
    color_hex         TEXT,
    initial_weight_g  REAL    NOT NULL,
    remaining_weight_g REAL   NOT NULL,
    cost              REAL,
    purchased_at      INTEGER,
    notes             TEXT,
    is_active         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS print_history (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id           INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    printed_at        INTEGER NOT NULL DEFAULT (unixepoch()),
    actual_time_min   INTEGER,
    actual_filament_g REAL,
    filament_cost     REAL,
    customer_name     TEXT,
    sale_value        REAL,
    currency          TEXT NOT NULL DEFAULT 'BRL',
    filament_roll_id  INTEGER REFERENCES filament_rolls(id) ON DELETE SET NULL,
    notes             TEXT,
    status            TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_print_history_file ON print_history(file_id);
CREATE INDEX IF NOT EXISTS idx_print_history_date ON print_history(printed_at);

CREATE TABLE IF NOT EXISTS print_queue (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id  INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE UNIQUE,
    position INTEGER NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Chaves padrão (inseridas se não existirem)
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('watched_folder_path', NULL),
    ('bambu_studio_path',   NULL),
    ('thumbnail_cache_dir', NULL),
    ('theme',               'dark');
