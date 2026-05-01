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

export interface PrintHistory {
  id: number
  fileId: number
  printedAt: number
  actualTimeMin: number | null
  actualFilamentG: number | null
  filamentCost: number | null
  customerName: string | null
  saleValue: number | null
  currency: string
  filamentRollId: number | null
  notes: string | null
  status: 'success' | 'failed' | 'partial'
}

export interface FilamentRoll {
  id: number
  brand: string | null
  material: string
  colorName: string | null
  colorHex: string | null
  initialWeightG: number
  remainingWeightG: number
  cost: number | null
  purchasedAt: number | null
  notes: string | null
  isActive: number // 0 | 1
}

export interface Tag {
  id: number
  name: string
  color: string | null
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

// ── Folders (CRUD) ────────────────────────────────────────────────────────────
export function createVirtualFolder(name: string, color?: string | null): Promise<VirtualFolder> {
  return invoke('create_virtual_folder', { name, color: color ?? null })
}

export function renameVirtualFolder(id: number, name: string): Promise<void> {
  return invoke('rename_virtual_folder', { id, name })
}

export function deleteVirtualFolder(id: number): Promise<void> {
  return invoke('delete_virtual_folder', { id })
}

export function setFileFolder(fileId: number, folderId: number): Promise<void> {
  return invoke('set_file_folder', { fileId, folderId })
}

// ── Tags (CRUD) ───────────────────────────────────────────────────────────────
export function listTags(): Promise<Tag[]> {
  return invoke('list_tags')
}

export function listFileTags(fileId: number): Promise<Tag[]> {
  return invoke('list_file_tags', { fileId })
}

export function createTag(name: string, color?: string | null): Promise<Tag> {
  return invoke('create_tag', { name, color: color ?? null })
}

export function addFileTag(fileId: number, tagId: number): Promise<void> {
  return invoke('add_file_tag', { fileId, tagId })
}

export function removeFileTag(fileId: number, tagId: number): Promise<void> {
  return invoke('remove_file_tag', { fileId, tagId })
}

export function deleteTag(id: number): Promise<void> {
  return invoke('delete_tag', { id })
}

// ── Print queue ───────────────────────────────────────────────────────────────
export interface QueueItem {
  queueId: number
  fileId: number
  position: number
  addedAt: number
  filename: string
  ext: 'stl' | '3mf'
  path: string
  thumbnailPath: string | null
  printCount: number
}

export function listPrintQueue(): Promise<QueueItem[]> {
  return invoke('list_print_queue')
}

export function addToQueue(fileId: number): Promise<void> {
  return invoke('add_to_queue', { fileId })
}

export function removeFromQueue(fileId: number): Promise<void> {
  return invoke('remove_from_queue', { fileId })
}

export function reorderQueue(orderedIds: number[]): Promise<void> {
  return invoke('reorder_queue', { orderedIds })
}

// ── Print history ─────────────────────────────────────────────────────────────
export function listPrintHistory(fileId: number): Promise<PrintHistory[]> {
  return invoke('list_print_history', { fileId })
}

export function addPrintHistory(params: {
  fileId: number
  printedAt: number
  actualTimeMin?: number | null
  actualFilamentG?: number | null
  filamentCost?: number | null
  customerName?: string | null
  saleValue?: number | null
  filamentRollId?: number | null
  notes?: string | null
  status: 'success' | 'failed' | 'partial'
}): Promise<PrintHistory> {
  return invoke('add_print_history', {
    fileId:           params.fileId,
    printedAt:        params.printedAt,
    actualTimeMin:    params.actualTimeMin ?? null,
    actualFilamentG:  params.actualFilamentG ?? null,
    filamentCost:     params.filamentCost ?? null,
    customerName:     params.customerName ?? null,
    saleValue:        params.saleValue ?? null,
    filamentRollId:   params.filamentRollId ?? null,
    notes:            params.notes ?? null,
    status:           params.status,
  })
}

export function deletePrintHistory(id: number, restoreFilament: boolean): Promise<void> {
  return invoke('delete_print_history', { id, restoreFilament })
}

// ── Filament ──────────────────────────────────────────────────────────────────
export function listFilamentRolls(): Promise<FilamentRoll[]> {
  return invoke('list_filament_rolls')
}

export function createFilamentRoll(params: {
  brand?: string | null
  material: string
  colorName?: string | null
  colorHex?: string | null
  initialWeightG: number
  cost?: number | null
  notes?: string | null
}): Promise<FilamentRoll> {
  return invoke('create_filament_roll', {
    brand:          params.brand ?? null,
    material:       params.material,
    colorName:      params.colorName ?? null,
    colorHex:       params.colorHex ?? null,
    initialWeightG: params.initialWeightG,
    cost:           params.cost ?? null,
    notes:          params.notes ?? null,
  })
}

export function updateFilamentRoll(params: {
  id: number
  brand: string | null
  material: string
  colorName: string | null
  colorHex: string | null
  initialWeightG: number
  remainingWeightG: number
  cost: number | null
  notes: string | null
}): Promise<void> {
  return invoke('update_filament_roll', params)
}

export function adjustFilamentRemaining(id: number, remainingG: number): Promise<void> {
  return invoke('adjust_filament_remaining', { id, remainingG })
}

export function toggleFilamentRoll(id: number): Promise<void> {
  return invoke('toggle_filament_roll', { id })
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
