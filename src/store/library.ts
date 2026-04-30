import { create } from 'zustand'

type SortBy = 'name' | 'date_added' | 'date_created' | 'ext'
type SortDir = 'asc' | 'desc'
type ViewMode = 'grid' | 'list'

interface LibraryStore {
  viewMode: ViewMode
  sortBy: SortBy
  sortDir: SortDir
  search: string
  selectedFolderId: number | null  // null = "Todos os arquivos"
  setViewMode: (mode: ViewMode) => void
  setSortBy: (sort: SortBy) => void
  setSortDir: (dir: SortDir) => void
  setSearch: (search: string) => void
  setSelectedFolderId: (id: number | null) => void
  toggleSortDir: () => void
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  viewMode: 'grid',
  sortBy: 'date_added',
  sortDir: 'desc',
  search: '',
  selectedFolderId: null,

  setViewMode: (viewMode) => set({ viewMode }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortDir: (sortDir) => set({ sortDir }),
  setSearch: (search) => set({ search }),
  setSelectedFolderId: (selectedFolderId) => set({ selectedFolderId }),
  toggleSortDir: () =>
    set((s) => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
}))
