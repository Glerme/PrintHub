import { useQuery } from '@tanstack/react-query'
import { listVirtualFolders } from '../lib/commands'
import { useLibraryStore } from '../store/library'

export default function FolderTree() {
  const { selectedFolderId, setSelectedFolderId } = useLibraryStore()

  const { data: folders = [] } = useQuery({
    queryKey: ['virtual_folders'],
    queryFn: listVirtualFolders,
  })

  const totalFiles = folders.reduce((sum, f) => sum + f.fileCount, 0)

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      <FolderItem
        label="Todos os arquivos"
        count={totalFiles}
        selected={selectedFolderId === null}
        onClick={() => setSelectedFolderId(null)}
        icon="📂"
      />

      <div className="mt-2 mb-1 px-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Pastas
      </div>

      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          label={folder.name}
          count={folder.fileCount}
          selected={selectedFolderId === folder.id}
          onClick={() => setSelectedFolderId(folder.id)}
          icon="📁"
        />
      ))}
    </nav>
  )
}

function FolderItem({
  label,
  count,
  selected,
  onClick,
  icon,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
  icon: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
        selected
          ? 'bg-violet-600/20 text-violet-300'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-xs text-zinc-600 tabular-nums">{count}</span>
    </button>
  )
}
