import { useQuery } from '@tanstack/react-query'
import { listTags } from '../lib/commands'
import { useLibraryStore } from '../store/library'

export default function TagFilter() {
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })
  const { selectedTagIds, toggleTagFilter, clearTagFilters } = useLibraryStore()

  if (tags.length === 0) return null

  return (
    <div className="px-3 py-2 border-t border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tags</span>
        {selectedTagIds.length > 0 && (
          <button
            type="button"
            onClick={clearTagFilters}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            limpar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const active = selectedTagIds.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTagFilter(tag.id)}
              className="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
              style={
                active
                  ? { backgroundColor: `${tag.color ?? '#6366f1'}40`, color: tag.color ?? '#a5b4fc', border: `1px solid ${tag.color ?? '#6366f1'}60` }
                  : { backgroundColor: 'transparent', color: '#52525b', border: '1px solid #27272a' }
              }
            >
              {tag.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
