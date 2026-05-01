import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { adjustFilamentRemaining, toggleFilamentRoll, type FilamentRoll } from '../lib/commands'
import { formatDate, formatCurrency } from '../lib/format'

interface Props {
  roll: FilamentRoll
  onEdit: (roll: FilamentRoll) => void
}

export default function FilamentRollCard({ roll, onEdit }: Props) {
  const qc = useQueryClient()
  const [adjusting, setAdjusting] = useState(false)
  const [newWeight, setNewWeight] = useState(String(Math.round(roll.remainingWeightG)))
  const [menuOpen, setMenuOpen] = useState(false)

  const overweight = roll.remainingWeightG > roll.initialWeightG
  const pct = roll.initialWeightG > 0
    ? Math.max(0, Math.min(100, (roll.remainingWeightG / roll.initialWeightG) * 100))
    : 0
  const color = roll.colorHex ?? '#6366f1'
  const label = [roll.brand, roll.material, roll.colorName].filter(Boolean).join(' · ')

  const costPerG = roll.cost && roll.initialWeightG > 0
    ? roll.cost / roll.initialWeightG
    : null

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    const g = parseFloat(newWeight)
    if (isNaN(g) || g < 0) return
    await adjustFilamentRemaining(roll.id, g)
    qc.invalidateQueries({ queryKey: ['filament_rolls'] })
    setAdjusting(false)
  }

  async function handleToggle() {
    await toggleFilamentRoll(roll.id)
    qc.invalidateQueries({ queryKey: ['filament_rolls'] })
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-opacity ${
      roll.isActive ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-900/50 border-zinc-800/50 opacity-60'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full shrink-0 border-2 border-zinc-700"
          style={{ backgroundColor: color }}
          title={roll.colorName ?? color}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{label || 'Filamento'}</p>
          {roll.cost && (
            <p className="text-xs text-zinc-500">
              {formatCurrency(roll.cost)} · {costPerG ? `${formatCurrency(costPerG)}/g` : ''}
            </p>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="text-zinc-500 hover:text-zinc-300 px-1 py-0.5 rounded text-sm transition-colors"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                <button type="button" onClick={() => { setMenuOpen(false); onEdit(roll) }}
                  className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left">Editar</button>
                <button type="button" onClick={() => { setMenuOpen(false); setAdjusting(true); setNewWeight(String(Math.round(roll.remainingWeightG))) }}
                  className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 text-left">Ajustar peso</button>
                <button type="button" onClick={() => { setMenuOpen(false); handleToggle() }}
                  className="w-full px-3 py-1.5 text-xs hover:bg-zinc-700 text-left text-zinc-400">
                  {roll.isActive ? 'Arquivar' : 'Ativar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Usage bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{Math.round(roll.remainingWeightG)}g restam</span>
          <span>{Math.round(roll.initialWeightG)}g total</span>
        </div>
        {overweight && (
          <p className="text-xs text-amber-400">⚠ Peso restante maior que o inicial — ajuste necessário</p>
        )}
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <p className="text-xs text-zinc-600 text-right">{pct.toFixed(0)}% restante</p>
      </div>

      {/* Weight adjustment */}
      {adjusting && (
        <form onSubmit={handleAdjust} className="flex gap-2">
          <input
            type="number"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            min="0"
            max={roll.initialWeightG}
            step="0.1"
            className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs outline-none focus:border-violet-500"
            autoFocus
          />
          <span className="text-xs text-zinc-500 self-center">g</span>
          <button type="submit" className="px-2 py-1 rounded bg-violet-600 text-white text-xs hover:bg-violet-500">OK</button>
          <button type="button" onClick={() => setAdjusting(false)} className="px-2 py-1 rounded bg-zinc-700 text-zinc-300 text-xs">✕</button>
        </form>
      )}

      {roll.purchasedAt && (
        <p className="text-xs text-zinc-600">Comprado em {formatDate(roll.purchasedAt)}</p>
      )}
      {roll.notes && <p className="text-xs text-zinc-500 leading-relaxed">{roll.notes}</p>}
    </div>
  )
}
