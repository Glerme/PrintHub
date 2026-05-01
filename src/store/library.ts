import { create } from 'zustand'

type SortBy = 'name' | 'date_added' | 'date_created' | 'ext'
type SortDir = 'asc' | 'desc'
type ViewMode = 'grid' | 'list'

interface LibraryStore {
  viewMode: ViewMode
  sortBy: SortBy
  sortDir: SortDir
  search: string
  selectedFolderId: number | null
  selectedTagIds: number[]
  setViewMode: (mode: ViewMode) => void
  setSortBy: (sort: SortBy) => void
  setSortDir: (dir: SortDir) => void
  setSearch: (search: string) => void
  setSelectedFolderId: (id: number | null) => void
  toggleSortDir: () => void
  toggleTagFilter: (id: number) => void
  clearTagFilters: () => void
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  viewMode: 'grid',
  sortBy: 'date_added',
  sortDir: 'desc',
  search: '',
  selectedFolderId: null,
  selectedTagIds: [],

  setViewMode: (viewMode) => set({ viewMode }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortDir: (sortDir) => set({ sortDir }),
  setSearch: (search) => set({ search }),
  setSelectedFolderId: (selectedFolderId) => set({ selectedFolderId }),
  toggleSortDir: () => set((s) => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
  toggleTagFilter: (id) =>
    set((s) => ({
      selectedTagIds: s.selectedTagIds.includes(id)
        ? s.selectedTagIds.filter((t) => t !== id)
        : [...s.selectedTagIds, id],
    })),
  clearTagFilters: () => set({ selectedTagIds: [] }),
}))
