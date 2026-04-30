import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listVirtualFolders,
  createVirtualFolder,
  renameVirtualFolder,
  deleteVirtualFolder,
  type VirtualFolder,
} from '../lib/commands'
import { useLibraryStore } from '../store/library'

const INBOX_ID = 1

export default function FolderTree() {
  const { selectedFolderId, setSelectedFolderId } = useLibraryStore()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)

  const { data: folders = [] } = useQuery({
    queryKey: ['virtual_folders'],
    queryFn: listVirtualFolders,
  })

  const createMut = useMutation({
    mutationFn: (name: string) => createVirtualFolder(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['virtual_folders'] })
      setCreating(false)
      setNewName('')
    },
  })

  const totalFiles = folders.reduce((sum, f) => sum + f.fileCount, 0)

  useEffect(() => {
    if (creating) newInputRef.current?.focus()
  }, [creating])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setCreating(false); return }
    createMut.mutate(name)
  }

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      <FolderItem
        folder={{ id: 0, name: 'Todos os arquivos', color: null, fileCount: totalFiles }}
        selected={selectedFolderId === null}
        onClick={() => setSelectedFolderId(null)}
        icon="📂"
        isInbox={false}
        isAll
        onRename={() => {}}
        onDelete={() => {}}
      />

      <div className="mt-3 mb-1 px-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Pastas</span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="Nova pasta"
          className="text-zinc-600 hover:text-zinc-300 text-lg leading-none transition-colors"
        >
          +
        </button>
      </div>

      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          selected={selectedFolderId === folder.id}
          onClick={() => setSelectedFolderId(folder.id)}
          icon="📁"
          isInbox={folder.id === INBOX_ID}
          isAll={false}
          onRename={(name) => {
            useMutationHelper(qc, () => renameVirtualFolder(folder.id, name))
          }}
          onDelete={() => {
            if (folder.id === INBOX_ID) return
            useMutationHelper(qc, () => deleteVirtualFolder(folder.id), () => {
              if (selectedFolderId === folder.id) setSelectedFolderId(null)
            })
          }}
        />
      ))}

      {creating && (
        <form onSubmit={handleCreate} className="px-2 mt-1">
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => { if (!newName.trim()) setCreating(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
            placeholder="Nome da pasta…"
            className="w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm outline-none focus:border-violet-500"
          />
        </form>
      )}
    </nav>
  )
}

// ── FolderItem ────────────────────────────────────────────────────────────────

function FolderItem({
  folder,
  selected,
  onClick,
  icon,
  isInbox,
  isAll,
  onRename,
  onDelete,
}: {
  folder: VirtualFolder & { id: number }
  selected: boolean
  onClick: () => void
  icon: string
  isInbox: boolean
  isAll: boolean
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) editRef.current?.focus() }, [editing])

  function confirmEdit() {
    const name = editName.trim()
    if (name && name !== folder.name) onRename(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-2">
        <input
          ref={editRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={confirmEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmEdit()
            if (e.key === 'Escape') { setEditing(false); setEditName(folder.name) }
          }}
          className="w-full px-2 py-1 rounded bg-zinc-800 border border-violet-500 text-zinc-200 text-sm outline-none"
        />
      </div>
    )
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
          selected
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        }`}
      >
        <span className="text-base leading-none shrink-0">{icon}</span>
        <span className="flex-1 truncate text-left">{folder.name}</span>
        <span className="text-xs text-zinc-600 tabular-nums">{folder.fileCount}</span>
      </button>

      {/* Context menu button — only for non-special folders */}
      {!isAll && !isInbox && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
            className="text-zinc-500 hover:text-zinc-300 text-xs px-1 py-0.5 rounded"
          >
            ⋯
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setEditing(true); setEditName(folder.name) }}
                  className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
                >
                  Renomear
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 text-left"
                >
                  Excluir
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helper (avoids creating useMutation hooks inside callbacks) ───────────────

function useMutationHelper(
  qc: ReturnType<typeof useQueryClient>,
  fn: () => Promise<unknown>,
  onSuccess?: () => void,
) {
  fn().then(() => {
    qc.invalidateQueries({ queryKey: ['virtual_folders'] })
    qc.invalidateQueries({ queryKey: ['files'] })
    onSuccess?.()
  }).catch(console.warn)
}
