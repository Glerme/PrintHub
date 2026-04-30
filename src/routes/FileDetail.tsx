import { lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { convertFileSrc } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { getFile, openInSlicer, type FileItem } from '../lib/commands'
import { formatDate, formatFileSize } from '../lib/format'

const ThreeViewer = lazy(() => import('../components/ThreeViewer'))

const EXT_STYLE: Record<string, string> = {
  stl:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  '3mf':'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

export default function FileDetail() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const fileId    = Number(id)

  const { data: file, isLoading, error } = useQuery({
    queryKey: ['file', fileId],
    queryFn:  () => getFile(fileId),
    enabled:  !isNaN(fileId),
  })

  if (isLoading) return <LoadingState />
  if (error || !file) return <ErrorState onBack={() => navigate('/library')} />

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors shrink-0"
        >
          ← Biblioteca
        </button>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-100 font-medium truncate">{file.filename}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded border font-mono uppercase shrink-0 ${EXT_STYLE[file.ext] ?? ''}`}>
          {file.ext}
        </span>
        {file.isFavorite === 1 && <span className="text-amber-400 shrink-0">★</span>}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* 3D Viewer / Preview area */}
        <div className="flex-1 bg-zinc-900 overflow-hidden">
          <Suspense fallback={<ViewerSkeleton />}>
            {file.ext === 'stl' ? (
              <ThreeViewer filePath={file.path} fileExt="stl" />
            ) : (
              <ThreeMFPreview file={file} />
            )}
          </Suspense>
        </div>

        {/* Info panel */}
        <aside className="w-72 shrink-0 border-l border-zinc-800 overflow-y-auto">
          <InfoPanel file={file} onOpenSlicer={() => handleOpenSlicer(file.path)} />
        </aside>
      </div>
    </div>
  )

  async function handleOpenSlicer(path: string) {
    try {
      await openInSlicer(path)
    } catch (e: unknown) {
      const msg = e instanceof Object && 'message' in e ? String((e as { message: string }).message) : String(e)
      toast.error(msg)
    }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ThreeMFPreview({ file }: { file: FileItem }) {
  if (file.thumbnailPath) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <img
          src={convertFileSrc(file.thumbnailPath)}
          alt={file.filename}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-zinc-500 text-sm">Sem preview disponível para este arquivo.</p>
    </div>
  )
}

function InfoPanel({ file, onOpenSlicer }: { file: FileItem; onOpenSlicer: () => void }) {
  const dateLabel = file.fileCreatedAt ? formatDate(file.fileCreatedAt) : formatDate(file.addedAt)

  return (
    <div className="p-4 space-y-6">
      {/* Metadata */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Informações</h2>
        <InfoRow label="Adicionado"  value={formatDate(file.addedAt)} />
        {file.fileCreatedAt && <InfoRow label="Criado"  value={dateLabel} />}
        {file.sizeBytes !== null && <InfoRow label="Tamanho" value={formatFileSize(file.sizeBytes)} />}
        {file.estimatedPrintTimeMin !== null && (
          <InfoRow label="Tempo estimado" value={`${Math.floor(file.estimatedPrintTimeMin / 60)}h ${file.estimatedPrintTimeMin % 60}m`} />
        )}
        {file.estimatedFilamentG !== null && (
          <InfoRow label="Filamento estimado" value={`${file.estimatedFilamentG.toFixed(1)} g`} />
        )}
        {file.sourceUrl && (
          <div>
            <dt className="text-xs text-zinc-600">Origem</dt>
            <dd>
              <a href={file.sourceUrl} target="_blank" rel="noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 truncate block">
                {file.sourceUrl}
              </a>
            </dd>
          </div>
        )}
      </section>

      {/* Print stats */}
      <section className="space-y-2">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Impressões</h2>
        <p className="text-2xl font-bold text-zinc-100">{file.printCount}</p>
        <p className="text-xs text-zinc-500">
          {file.printCount === 0 ? 'Nunca impresso' : `${file.printCount}× impresso`}
        </p>
      </section>

      {/* Notes */}
      {file.notes && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Notas</h2>
          <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{file.notes}</p>
        </section>
      )}

      {/* Actions */}
      <section className="space-y-2 pt-2">
        <button
          type="button"
          onClick={onOpenSlicer}
          className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          Abrir no Bambu Studio
        </button>
        <button
          type="button"
          disabled
          className="w-full py-2.5 rounded-lg border border-zinc-700 text-zinc-400 text-sm transition-colors disabled:opacity-40 cursor-not-allowed"
        >
          + Marcar como impresso
        </button>
      </section>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className="text-xs text-zinc-300 mt-0.5">{value}</dd>
    </div>
  )
}

function ViewerSkeleton() {
  return (
    <div className="flex items-center justify-center h-full gap-3 flex-col">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-zinc-500 text-sm">Carregando modelo 3D…</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ErrorState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 flex-col gap-3">
      <p className="text-zinc-400">Arquivo não encontrado.</p>
      <button type="button" onClick={onBack} className="text-violet-400 text-sm hover:text-violet-300">
        ← Voltar à biblioteca
      </button>
    </div>
  )
}
