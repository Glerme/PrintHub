import { convertFileSrc } from '@tauri-apps/api/core'
import type { FileItem } from '../lib/commands'
import { formatDate, formatFileSize } from '../lib/format'

interface Props {
  file: FileItem
  viewMode: 'grid' | 'list'
  onClick: () => void
}

const EXT_STYLE: Record<string, string> = {
  stl: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  '3mf': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

export default function FileCard({ file, viewMode, onClick }: Props) {
  const extStyle = EXT_STYLE[file.ext] ?? 'bg-zinc-700 text-zinc-300'
  const dateLabel = file.fileCreatedAt
    ? formatDate(file.fileCreatedAt)
    : formatDate(file.addedAt)

  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all text-left group"
      >
        {/* Thumbnail placeholder */}
        <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-600 text-lg">
          {file.ext === '3mf' ? '🟩' : '🔷'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
            {file.filename}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {dateLabel}
            {file.sizeBytes !== null ? ` · ${formatFileSize(file.sizeBytes)}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {file.printCount > 0 && (
            <span className="text-xs text-zinc-500">
              {file.printCount}× impresso
            </span>
          )}
          <span className={`text-xs font-mono px-1.5 py-0.5 rounded border uppercase ${extStyle}`}>
            {file.ext}
          </span>
          {file.isFavorite === 1 && <span className="text-amber-400">★</span>}
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all text-left group overflow-hidden"
    >
      {/* Thumbnail area */}
      <div className="aspect-square w-full bg-zinc-800 flex items-center justify-center text-4xl text-zinc-600 relative">
        {file.thumbnailPath ? (
          <img
            src={convertFileSrc(file.thumbnailPath)}
            alt={file.filename}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <span>{file.ext === '3mf' ? '🟩' : '🔷'}</span>
        )}
        {file.isFavorite === 1 && (
          <span className="absolute top-2 right-2 text-amber-400 text-sm">★</span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white leading-tight">
            {file.filename}
          </p>
          <span className={`text-xs font-mono px-1 py-0.5 rounded border uppercase shrink-0 ${extStyle}`}>
            {file.ext}
          </span>
        </div>

        <p className="text-xs text-zinc-500">{dateLabel}</p>

        {file.printCount > 0 && (
          <p className="text-xs text-emerald-500">✓ {file.printCount}× impresso</p>
        )}
      </div>
    </button>
  )
}
