import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listFilamentRolls,
  createFilamentRoll,
  updateFilamentRoll,
  type FilamentRoll,
} from '../lib/commands'
import FilamentRollCard from '../components/FilamentRollCard'

const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PLA-CF', 'PETG-CF', 'Nylon', 'PC']
const COLORS_HEX = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#f9fafb','#18181b']

export default function Filament() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FilamentRoll | null>(null)

  const { data: rolls = [] } = useQuery({
    queryKey: ['filament_rolls'],
    queryFn: listFilamentRolls,
  })

  const active   = rolls.filter((r) => r.isActive === 1)
  const archived = rolls.filter((r) => r.isActive === 0)

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
        >
          ← Biblioteca
        </button>
        <span className="text-zinc-600">·</span>
        <h1 className="text-zinc-100 font-semibold">Filamentos</h1>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => { setEditing(null); setCreating(true) }}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            + Novo rolo
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Roll list */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {active.length === 0 && !creating && (
            <EmptyState onNew={() => setCreating(true)} />
          )}

          {active.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ativos ({active.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {active.map((roll) => (
                  <FilamentRollCard
                    key={roll.id}
                    roll={roll}
                    onEdit={(r) => { setEditing(r); setCreating(true) }}
                  />
                ))}
              </div>
            </section>
          )}

          {archived.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Arquivados ({archived.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {archived.map((roll) => (
                  <FilamentRollCard
                    key={roll.id}
                    roll={roll}
                    onEdit={(r) => { setEditing(r); setCreating(true) }}
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Form panel */}
        {creating && (
          <aside className="w-80 shrink-0 border-l border-zinc-800 overflow-y-auto">
            <RollForm
              key={editing?.id ?? 'new'}
              initial={editing}
              onClose={() => { setCreating(false); setEditing(null) }}
              onSave={async (data) => {
                if (editing) {
                  await updateFilamentRoll({ id: editing.id, ...data, remainingWeightG: editing.remainingWeightG })
                } else {
                  await createFilamentRoll(data)
                }
                qc.invalidateQueries({ queryKey: ['filament_rolls'] })
                setCreating(false)
                setEditing(null)
              }}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormData {
  brand: string | null
  material: string
  colorName: string | null
  colorHex: string | null
  initialWeightG: number
  cost: number | null
  notes: string | null
}

function RollForm({
  initial,
  onClose,
  onSave,
}: {
  initial: FilamentRoll | null
  onClose: () => void
  onSave: (data: FormData) => Promise<void>
}) {
  const [brand, setBrand]     = useState(initial?.brand ?? '')
  const [material, setMat]    = useState(initial?.material ?? 'PLA')
  const [colorName, setColorN] = useState(initial?.colorName ?? '')
  const [colorHex, setColorH]  = useState(initial?.colorHex ?? '#6366f1')
  const [weight, setWeight]   = useState(String(initial?.initialWeightG ?? 1000))
  const [cost, setCost]       = useState(String(initial?.cost ?? ''))
  const [notes, setNotes]     = useState(initial?.notes ?? '')
  const [saving, setSaving]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        brand:          brand.trim() || null,
        material,
        colorName:      colorName.trim() || null,
        colorHex:       colorHex || null,
        initialWeightG: parseFloat(weight) || 1000,
        cost:           cost ? parseFloat(cost) : null,
        notes:          notes.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-100">
          {initial ? 'Editar rolo' : 'Novo rolo'}
        </h2>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg">✕</button>
      </div>

      <Field label="Marca"><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="ex: Bambu Lab" className={INPUT} /></Field>

      <Field label="Material *">
        <select value={material} onChange={(e) => setMat(e.target.value)} className={INPUT}>
          {MATERIALS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </Field>

      <Field label="Cor">
        <div className="flex gap-2">
          <input value={colorName} onChange={(e) => setColorN(e.target.value)} placeholder="ex: Preto" className={`${INPUT} flex-1`} />
          <input type="color" value={colorHex} onChange={(e) => setColorH(e.target.value)} className="w-10 h-9 rounded border border-zinc-700 bg-transparent cursor-pointer" />
        </div>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {COLORS_HEX.map((c) => (
            <button key={c} type="button" onClick={() => setColorH(c)}
              className="w-5 h-5 rounded-full border-2 transition-all"
              style={{ backgroundColor: c, borderColor: colorHex === c ? '#fff' : 'transparent' }}
            />
          ))}
        </div>
      </Field>

      <Field label="Peso inicial (g) *">
        <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} min="1" step="1" required className={INPUT} />
      </Field>

      <Field label="Custo (R$)">
        <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} min="0" step="0.01" placeholder="ex: 89.90" className={INPUT} />
      </Field>

      <Field label="Notas">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="observações…" className={`${INPUT} resize-none`} />
      </Field>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
      >
        {saving ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar rolo'}
      </button>
    </form>
  )
}

const INPUT = 'w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm outline-none focus:border-violet-500 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <span className="text-5xl">🧵</span>
      <p className="text-zinc-300 font-medium">Nenhum rolo cadastrado</p>
      <p className="text-zinc-500 text-sm max-w-xs">Cadastre seus rolos de filamento para rastrear uso e custo por impressão.</p>
      <button type="button" onClick={onNew} className="mt-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm">
        + Adicionar primeiro rolo
      </button>
    </div>
  )
}
