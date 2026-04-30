import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listFiles } from '../lib/commands'
import { useLibraryStore } from '../store/library'
import { useReactiveCache } from '../hooks/useReactiveCache'
import FileCard from '../components/FileCard'
import FilterBar from '../components/FilterBar'
import FolderTree from '../components/FolderTree'

export default function Library() {
  useReactiveCache()
  const navigate = useNavigate()

  const { viewMode, sortBy, sortDir, search, selectedFolderId } = useLibraryStore()

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files', { folderId: selectedFolderId, search, sortBy, sortDir }],
    queryFn: () =>
      listFiles({
        folderId: selectedFolderId,
        search: search || null,
        sortBy,
        sortDir,
      }),
    staleTime: 1000 * 10,
  })

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-y-auto">
        <div className="px-4 py-4 border-b border-zinc-800">
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">🖨️ Print Hub</h1>
        </div>
        <div className="py-2 flex-1">
          <FolderTree />
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <FilterBar total={files.length} />

        <main className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <LoadingSkeleton viewMode={viewMode} />
          ) : files.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'
                  : 'flex flex-col gap-2'
              }
            >
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  viewMode={viewMode}
                  onClick={() => navigate(`/file/${file.id}`)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyState() {
  const { selectedFolderId } = useLibraryStore()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-20">
      <span className="text-5xl">📂</span>
      <p className="text-zinc-300 font-medium">Nenhum arquivo encontrado</p>
      <p className="text-zinc-500 text-sm max-w-xs">
        {selectedFolderId !== null
          ? 'Esta pasta está vazia.'
          : 'Adicione arquivos STL ou 3MF à sua pasta monitorada e eles aparecerão aqui automaticamente.'}
      </p>
    </div>
  )
}

function LoadingSkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <div
      className={
        viewMode === 'grid'
          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'
          : 'flex flex-col gap-2'
      }
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className={`rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse ${
            viewMode === 'grid' ? 'aspect-square' : 'h-14'
          }`}
        />
      ))}
    </div>
  )
}
