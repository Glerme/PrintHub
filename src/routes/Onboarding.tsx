import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useNavigate } from 'react-router-dom'
import { setSetting, startWatching } from '../lib/commands'

export default function Onboarding() {
  const [folder, setFolder] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string>('')
  const navigate = useNavigate()

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false })
    if (typeof selected === 'string') {
      setFolder(selected)
    }
  }

  async function confirm() {
    if (!folder) return
    setSaving(true)
    try {
      setStatus('Salvando configuração...')
      await setSetting('watched_folder_path', folder)
      setStatus('Indexando arquivos...')
      await startWatching(folder)
      navigate('/library')
    } finally {
      setSaving(false)
      setStatus('')
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <img src="/logo-dark.svg" alt="Print Hub" className="h-24 w-auto" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            Bem-vindo ao <span className="text-orange-500">Print Hub</span>
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Selecione a pasta onde seus arquivos STL e 3MF estão armazenados.
            O app monitorará essa pasta automaticamente.
          </p>
        </div>

        {/* Folder picker */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Pasta dos arquivos
          </label>
          <button
            type="button"
            onClick={pickFolder}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-600 transition-all text-left group"
          >
            <span className="text-lg shrink-0">📁</span>
            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 truncate">
              {folder ?? 'Clique para selecionar...'}
            </span>
          </button>
          {folder && (
            <p className="text-xs text-zinc-600 px-1 truncate" title={folder}>
              {folder}
            </p>
          )}
        </div>

        {/* Confirm */}
        <button
          type="button"
          onClick={confirm}
          disabled={!folder || saving}
          className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {saving ? (status || 'Aguarde...') : 'Começar'}
        </button>
      </div>
    </div>
  )
}
