import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppSidebar from '../components/AppSidebar'
import { open } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'
import {
  getSetting, setSetting, startWatching, triggerRescan,
} from '../lib/commands'

export default function Settings() {
  const qc = useQueryClient()

  const { data: watchedFolder } = useQuery({
    queryKey: ['setting', 'watched_folder_path'],
    queryFn: () => getSetting('watched_folder_path'),
  })
  const { data: bambuPath } = useQuery({
    queryKey: ['setting', 'bambu_studio_path'],
    queryFn: () => getSetting('bambu_studio_path'),
  })

  const [rescanning, setRescanning] = useState(false)

  async function changeWatchedFolder() {
    const folder = await open({ directory: true, multiple: false })
    if (typeof folder !== 'string') return
    await setSetting('watched_folder_path', folder)
    await startWatching(folder)
    qc.invalidateQueries({ queryKey: ['setting', 'watched_folder_path'] })
    qc.invalidateQueries({ queryKey: ['files'] })
    qc.invalidateQueries({ queryKey: ['virtual_folders'] })
    toast.success('Pasta atualizada e reindexada')
  }

  async function changeBambuPath() {
    const file = await open({
      directory: false,
      multiple: false,
      filters: [{ name: 'Executável', extensions: ['exe', 'AppImage', ''] }],
    })
    if (typeof file !== 'string') return
    await setSetting('bambu_studio_path', file)
    qc.invalidateQueries({ queryKey: ['setting', 'bambu_studio_path'] })
    toast.success('Caminho do Bambu Studio salvo')
  }

  async function handleRescan() {
    setRescanning(true)
    try {
      const count = await triggerRescan()
      qc.invalidateQueries({ queryKey: ['files'] })
      qc.invalidateQueries({ queryKey: ['virtual_folders'] })
      toast.success(`Reindexação completa: ${count} arquivo${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}`)
    } catch (e: unknown) {
      toast.error(String(e))
    } finally {
      setRescanning(false)
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
        <h1 className="text-zinc-100 font-semibold">Configurações</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-xl space-y-8">

        {/* Watched folder */}
        <SettingSection title="Pasta monitorada" description="Onde seus arquivos STL e 3MF estão armazenados.">
          <div className="space-y-2">
            {watchedFolder && (
              <p className="text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 truncate">
                {watchedFolder}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={changeWatchedFolder}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">
                Alterar pasta
              </button>
              <button type="button" onClick={handleRescan} disabled={rescanning || !watchedFolder}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors disabled:opacity-40">
                {rescanning ? 'Reindexando…' : '↻ Reindexar'}
              </button>
            </div>
          </div>
        </SettingSection>

        {/* Bambu Studio */}
        <SettingSection title="Bambu Studio" description="Caminho do executável. Deixe em branco para detecção automática.">
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 truncate min-h-[36px]">
              {bambuPath ?? <span className="text-zinc-600">Detecção automática</span>}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={changeBambuPath}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">
                Alterar caminho
              </button>
              {bambuPath && (
                <button type="button" onClick={async () => {
                  await setSetting('bambu_studio_path', null)
                  qc.invalidateQueries({ queryKey: ['setting', 'bambu_studio_path'] })
                  toast.success('Usando detecção automática')
                }}
                  className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors">
                  Usar automático
                </button>
              )}
            </div>
          </div>
        </SettingSection>

        {/* App info */}
        <SettingSection title="Sobre" description="">
          <div className="space-y-1 text-xs text-zinc-500">
            <p>Print Hub v0.1.0</p>
            <p>Tauri v2 · React · Rust · SQLite</p>
          </div>
        </SettingSection>

      </main>
      </div>
    </div>
  )
}

function SettingSection({ title, description, children }: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}
