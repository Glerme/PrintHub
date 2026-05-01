import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addPrintHistory, listPrintHistory, deletePrintHistory,
  listFilamentRolls,
  type FileItem, type PrintHistory,
} from '../lib/commands'
import { formatDate, formatCurrency, formatDuration } from '../lib/format'

const STATUS_LABELS = {
  success: { label: 'Sucesso', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  failed:  { label: 'Falhou',  color: 'text-red-400',     dot: 'bg-red-500' },
  partial: { label: 'Parcial', color: 'text-amber-400',   dot: 'bg-amber-500' },
} as const

function todayUnix() {
  const d = new Date(); d.setHours(12, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function toDateInputValue(unix: number) {
  return new Date(unix * 1000).toISOString().split('T')[0]
}

// Parse "YYYY-MM-DD" as local noon to avoid UTC-midnight day-shift in BRT (UTC-3)
function dateInputToUnix(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T12:00:00`).getTime() / 1000)
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormProps {
  file: FileItem
  onClose: () => void
}

export function PrintHistoryForm({ file, onClose }: FormProps) {
  const qc = useQueryClient()

  const [date, setDate] = useState(toDateInputValue(todayUnix()))
  const [hours, setHours]   = useState('')
  const [mins, setMins]     = useState('')
  const [filamentG, setFilamentG] = useState(
    file.estimatedFilamentG ? String(file.estimatedFilamentG.toFixed(1)) : '',
  )
  const [costVal, setCostVal] = useState('')
  const [customer, setCustomer] = useState('')
  const [saleVal, setSaleVal]   = useState('')
  const [rollId, setRollId]     = useState<number | null>(null)
  const [notes, setNotes]       = useState('')
  const [status, setStatus]     = useState<'success' | 'failed' | 'partial'>('success')
  const [saving, setSaving]     = useState(false)

  const { data: rolls = [] } = useQuery({
    queryKey: ['filament_rolls'],
    queryFn: listFilamentRolls,
    select: (d) => d.filter((r) => r.isActive === 1),
  })

  // Auto-calculate cost when roll + filament are set
  function handleRollChange(id: number | null) {
    setRollId(id)
    if (!id) {
      setCostVal('')  // clear stale cost when roll is deselected
      return
    }
    const roll = rolls.find((r) => r.id === id)
    if (!roll || !roll.cost || !roll.initialWeightG) {
      setCostVal('')  // clear stale cost if new roll has no pricing
      return
    }
    const grams = parseFloat(filamentG)
    if (!isNaN(grams) && grams > 0) {
      setCostVal(((grams / roll.initialWeightG) * roll.cost).toFixed(2))
    }
  }

  function handleFilamentChange(val: string) {
    setFilamentG(val)
    if (!rollId) return
    const roll = rolls.find((r) => r.id === rollId)
    if (!roll || !roll.cost || !roll.initialWeightG) return
    const grams = parseFloat(val)
    if (!isNaN(grams) && grams > 0) {
      setCostVal(((grams / roll.initialWeightG) * roll.cost).toFixed(2))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const printedAt = dateInputToUnix(date)
      const h = parseInt(hours) || 0
      const m = parseInt(mins)  || 0
      const totalMin = h * 60 + m

      await addPrintHistory({
        fileId:          file.id,
        printedAt:       printedAt || todayUnix(),
        actualTimeMin:   totalMin > 0 ? totalMin : null,
        actualFilamentG: filamentG ? parseFloat(filamentG) : null,
        filamentCost:    costVal   ? parseFloat(costVal)   : null,
        customerName:    customer.trim() || null,
        saleValue:       saleVal   ? parseFloat(saleVal)   : null,
        filamentRollId:  rollId,
        notes:           notes.trim() || null,
        status,
      })

      qc.invalidateQueries({ queryKey: ['file', file.id] })
      qc.invalidateQueries({ queryKey: ['print_history', file.id] })
      qc.invalidateQueries({ queryKey: ['files'] })
      qc.invalidateQueries({ queryKey: ['filament_rolls'] })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4 border-t border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Registrar impressão</h3>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
      </div>

      {/* Status */}
      <div className="flex gap-2">
        {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === s
                ? `${STATUS_LABELS[s].color} border-current bg-zinc-800`
                : 'text-zinc-500 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {STATUS_LABELS[s].label}
          </button>
        ))}
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Data</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
      </div>

      {/* Time */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Tempo de impressão</label>
        <div className="flex gap-2 items-center">
          <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" min="0" className={`${INPUT} w-16`} />
          <span className="text-xs text-zinc-500">h</span>
          <input type="number" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="0" min="0" max="59" className={`${INPUT} w-16`} />
          <span className="text-xs text-zinc-500">min</span>
          {file.estimatedPrintTimeMin && (
            <span className="text-xs text-zinc-600">est. {formatDuration(file.estimatedPrintTimeMin)}</span>
          )}
        </div>
      </div>

      {/* Filament roll */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Rolo de filamento</label>
        <select
          value={rollId ?? ''}
          onChange={(e) => handleRollChange(e.target.value ? Number(e.target.value) : null)}
          className={INPUT}
        >
          <option value="">Sem rolo</option>
          {rolls.map((r) => (
            <option key={r.id} value={r.id}>
              {[r.brand, r.material, r.colorName].filter(Boolean).join(' · ')}
              {r.remainingWeightG ? ` — ${Math.round(r.remainingWeightG)}g` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Filament weight + cost */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-zinc-400">Filamento (g)</label>
          <input
            type="number"
            value={filamentG}
            onChange={(e) => handleFilamentChange(e.target.value)}
            min="0" step="0.1" placeholder="ex: 45.5"
            className={INPUT}
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs text-zinc-400">Custo (R$)</label>
          <input
            type="number"
            value={costVal}
            onChange={(e) => setCostVal(e.target.value)}
            min="0" step="0.01" placeholder="auto"
            className={INPUT}
          />
        </div>
      </div>

      {/* Customer + sale */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Pedido por</label>
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome do cliente (opcional)" className={INPUT} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Valor cobrado (R$)</label>
        <input type="number" value={saleVal} onChange={(e) => setSaleVal(e.target.value)} min="0" step="0.01" placeholder="0.00" className={INPUT} />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Notas</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ex: suporte falhou, reimpresso em PETG…" className={`${INPUT} resize-none`} />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
      >
        {saving ? 'Salvando…' : 'Registrar'}
      </button>
    </form>
  )
}

// ── History list ──────────────────────────────────────────────────────────────

export function PrintHistoryList({ fileId }: { fileId: number }) {
  const qc = useQueryClient()

  const { data: history = [] } = useQuery({
    queryKey: ['print_history', fileId],
    queryFn: () => listPrintHistory(fileId),
  })

  if (history.length === 0) return null

  async function handleDelete(entry: PrintHistory) {
    await deletePrintHistory(entry.id, true)
    qc.invalidateQueries({ queryKey: ['print_history', fileId] })
    qc.invalidateQueries({ queryKey: ['file', fileId] })
    qc.invalidateQueries({ queryKey: ['files'] })
    qc.invalidateQueries({ queryKey: ['filament_rolls'] })
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => {
        const s = STATUS_LABELS[entry.status as keyof typeof STATUS_LABELS] ?? STATUS_LABELS.success
        return (
          <div key={entry.id} className="group relative rounded-lg bg-zinc-800/60 border border-zinc-800 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
              <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
              <span className="text-xs text-zinc-500 ml-auto">{formatDate(entry.printedAt)}</span>
              <button
                type="button"
                onClick={() => handleDelete(entry)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs transition-all"
                title="Remover"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-3 flex-wrap text-xs text-zinc-500">
              {entry.actualTimeMin && <span>⏱ {formatDuration(entry.actualTimeMin)}</span>}
              {entry.actualFilamentG && <span>🧵 {entry.actualFilamentG.toFixed(1)}g</span>}
              {entry.filamentCost && <span>💰 {formatCurrency(entry.filamentCost)}</span>}
              {entry.saleValue && <span className="text-emerald-400">💵 {formatCurrency(entry.saleValue)}</span>}
            </div>
            {entry.customerName && <p className="text-xs text-zinc-400">👤 {entry.customerName}</p>}
            {entry.notes && <p className="text-xs text-zinc-500 leading-relaxed">{entry.notes}</p>}
          </div>
        )
      })}
    </div>
  )
}

const INPUT = 'w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm outline-none focus:border-violet-500 transition-colors'
