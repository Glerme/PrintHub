// Typed IPC wrappers para os Tauri commands.
// Este arquivo é mantido manualmente até tauri-specta ser ativado.
import { invoke } from '@tauri-apps/api/core'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FileItem {
  id: number
  filename: string
  ext: 'stl' | '3mf'
  path: string
  sizeBytes: number | null
  fileCreatedAt: number | null
  addedAt: number
  virtualFolderId: number | null
  thumbnailPath: string | null
  isFavorite: number  // 0 | 1 (SQLite boolean)
  printCount: number
  notes: string | null
  sourceUrl: string | null
  estimatedPrintTimeMin: number | null
  estimatedFilamentG: number | null
}

export interface VirtualFolder {
  id: number
  name: string
  color: string | null
  fileCount: number
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key })
}

export function setSetting(key: string, value: string | null): Promise<void> {
  return invoke('set_setting', { key, value })
}

// ── Files ─────────────────────────────────────────────────────────────────────
export function listFiles(params: {
  folderId?: number | null
  search?: string | null
  sortBy?: 'name' | 'date_added' | 'date_created' | 'ext'
  sortDir?: 'asc' | 'desc'
}): Promise<FileItem[]> {
  return invoke('list_files', {
    folderId: params.folderId ?? null,
    search:   params.search ?? null,
    sortBy:   params.sortBy ?? 'date_added',
    sortDir:  params.sortDir ?? 'desc',
  })
}

export function listVirtualFolders(): Promise<VirtualFolder[]> {
  return invoke('list_virtual_folders')
}

export function getFile(id: number): Promise<FileItem> {
  return invoke('get_file', { id })
}

// ── Indexer ───────────────────────────────────────────────────────────────────
export function startWatching(folder: string): Promise<void> {
  return invoke('start_watching', { folder })
}

// ── Slicer ────────────────────────────────────────────────────────────────────
export function openInSlicer(filePath: string): Promise<void> {
  return invoke('open_in_slicer', { filePath })
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
export function saveStlThumbnail(fileId: number, pngBase64: string): Promise<void> {
  return invoke('save_stl_thumbnail', { fileId, pngBase64 })
}
