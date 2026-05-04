import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listTags,
  listFileTags,
  createTag,
  addFileTag,
  removeFileTag,
  type Tag,
} from '../lib/commands'

// Palette of colors for new tags
const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
]

function randomTagColor() {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
}

interface Props {
  fileId: number
}

export default function TagPicker({ fileId }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: fileTags = [] } = useQuery({
    queryKey: ['file_tags', fileId],
    queryFn: () => listFileTags(fileId),
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
    enabled: open,
  })

  const fileTagIds = new Set(fileTags.map((t) => t.id))
  const available = allTags.filter(
    (t) => !fileTagIds.has(t.id) && t.name.toLowerCase().includes(query.toLowerCase()),
  )
  const canCreate = query.trim() && !allTags.some((t) => t.name.toLowerCase() === query.toLowerCase())

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  async function toggleTag(tag: Tag) {
    if (fileTagIds.has(tag.id)) {
      await removeFileTag(fileId, tag.id)
    } else {
      await addFileTag(fileId, tag.id)
    }
    invalidate()
  }

  async function handleCreate() {
    const name = query.trim()
    if (!name) return
    const color = randomTagColor()
    const tag = await createTag(name, color)
    await addFileTag(fileId, tag.id)
    setQuery('')
    invalidate()
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['file_tags', fileId] })
    qc.invalidateQueries({ queryKey: ['tags'] })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tags</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors"
        >
          + adicionar
        </button>
      </div>

      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {fileTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
            style={{ backgroundColor: `${tag.color ?? '#6366f1'}30`, color: tag.color ?? '#a5b4fc', border: `1px solid ${tag.color ?? '#6366f1'}50` }}
            onClick={() => removeFileTag(fileId, tag.id).then(invalidate)}
          >
            {tag.name}
            <span className="text-[10px]">✕</span>
          </span>
        ))}
        {fileTags.length === 0 && !open && (
          <span className="text-xs text-zinc-600">Nenhuma tag</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="relative">
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setQuery('') }} />
          <div className="relative z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 space-y-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Buscar ou criar tag…"
              className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs outline-none focus:border-violet-500"
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {available.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-700 text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color ?? '#6366f1' }}
                  />
                  <span className="text-xs text-zinc-300">{tag.name}</span>
                </button>
              ))}
              {canCreate && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-700 text-left"
                >
                  <span className="text-violet-400 text-xs">+ Criar "{query.trim()}"</span>
                </button>
              )}
              {!canCreate && available.length === 0 && (
                <p className="text-xs text-zinc-600 px-2 py-1">Nenhuma tag encontrada</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
