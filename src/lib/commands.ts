// Typed IPC wrappers para os Tauri commands.
// Este arquivo é manual até adicionarmos tauri-specta para geração automática.
import { invoke } from '@tauri-apps/api/core'

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>('get_setting', { key })
}

export function setSetting(key: string, value: string | null): Promise<void> {
  return invoke('set_setting', { key, value })
}
