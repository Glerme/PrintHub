import { useLibraryStore } from '../store/library'

type SortBy = 'name' | 'date_added' | 'date_created' | 'ext'

const SORT_LABELS: Record<SortBy, string> = {
  name: 'Nome',
  date_added: 'Adicionado',
  date_created: 'Criado',
  ext: 'Tipo',
}

export default function FilterBar({ total }: { total: number }) {
  const { viewMode, sortBy, sortDir, search, setViewMode, setSortBy, toggleSortDir, setSearch } =
    useLibraryStore()

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-zinc-500 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors"
        />
      </div>

      <span className="text-xs text-zinc-600 hidden sm:block">{total} arquivo{total !== 1 ? 's' : ''}</span>

      <div className="flex items-center gap-1 ml-auto">
        {/* Sort selector */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
        >
          {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>

        {/* Sort direction toggle */}
        <button
          type="button"
          onClick={toggleSortDir}
          title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'}
          className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
          {(['grid', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1.5 text-sm transition-colors ${
                viewMode === mode
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mode === 'grid' ? '⊞' : '☰'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
