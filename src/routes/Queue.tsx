import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppSidebar from '../components/AppSidebar'
import { convertFileSrc } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  listPrintQueue, removeFromQueue, reorderQueue, openInSlicer,
  type QueueItem,
} from '../lib/commands'

const EXT_STYLE: Record<string, string> = {
  stl:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  '3mf':'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

export default function Queue() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: items = [] } = useQuery({
    queryKey: ['print_queue'],
    queryFn: listPrintQueue,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const prevItems = items  // save for rollback
    const oldIndex  = items.findIndex((i) => i.fileId === active.id)
    const newIndex  = items.findIndex((i) => i.fileId === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)

    qc.setQueryData(['print_queue'], reordered)  // optimistic

    try {
      await reorderQueue(reordered.map((i) => i.fileId))
    } catch {
      qc.setQueryData(['print_queue'], prevItems)  // rollback on failure
      toast.error('Erro ao reordenar fila')
    }
  }

  async function handleRemove(fileId: number) {
    await removeFromQueue(fileId)
    qc.invalidateQueries({ queryKey: ['print_queue'] })
  }

  async function handleOpen(item: QueueItem) {
    try {
      await openInSlicer(item.path)  // use full filesystem path
    } catch {
      toast.error('Bambu Studio não encontrado. Configure o caminho em Configurações.')
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
        <h1 className="text-zinc-100 font-semibold">
          Fila de Impressão
          {items.length > 0 && (
            <span className="ml-2 text-zinc-500 font-normal text-sm">
              {items.length} arquivo{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.fileId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 max-w-2xl">
                {items.map((item, idx) => (
                  <SortableQueueItem
                    key={item.fileId}
                    item={item}
                    index={idx}
                    onRemove={() => handleRemove(item.fileId)}
                    onOpen={() => handleOpen(item)}
                    onNavigate={() => navigate(`/file/${item.fileId}`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
      </div>
    </div>
  )
}

// ── Sortable item ─────────────────────────────────────────────────────────────

function SortableQueueItem({
  item,
  index,
  onRemove,
  onOpen,
  onNavigate,
}: {
  item: QueueItem
  index: number
  onRemove: () => void
  onOpen: () => void
  onNavigate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.fileId })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 group"
    >
      <span className="text-zinc-700 text-sm font-mono w-5 shrink-0 text-center">{index + 1}</span>

      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Arrastar para reordenar"
      >
        ⠿
      </button>

      <div className="w-10 h-10 rounded-md bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center text-zinc-600">
        {item.thumbnailPath ? (
          <img src={convertFileSrc(item.thumbnailPath)} alt="" className="w-full h-full object-contain" />
        ) : (
          <span className="text-lg">{item.ext === '3mf' ? '🟩' : '🔷'}</span>
        )}
      </div>

      <button type="button" onClick={onNavigate} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-zinc-100 truncate hover:text-violet-300 transition-colors">
          {item.filename}
        </p>
        {item.printCount > 0 && (
          <p className="text-xs text-zinc-500">{item.printCount}× impresso</p>
        )}
      </button>

      <span className={`text-xs font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${EXT_STYLE[item.ext] ?? ''}`}>
        {item.ext}
      </span>

      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onOpen}
          title="Abrir no Bambu Studio"
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-violet-600 text-zinc-400 hover:text-white text-sm transition-colors"
        >
          🖨️
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Remover da fila"
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-red-300 text-sm transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <span className="text-5xl">⏳</span>
      <p className="text-zinc-300 font-medium">Fila vazia</p>
      <p className="text-zinc-500 text-sm max-w-xs">
        Adicione arquivos à fila abrindo um arquivo na biblioteca e clicando em "Adicionar à fila".
      </p>
    </div>
  )
}
