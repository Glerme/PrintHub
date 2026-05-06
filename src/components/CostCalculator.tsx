import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listFilamentRolls,
  getSetting,
  setSetting,
  addPrintHistory,
  type FilamentRoll,
} from '../lib/commands'
import {
  formatMinutesToTimeInput,
  parseTimeInput,
  calcTotalFilamentCost,
  calcEnergyCost,
  calcTotalCost,
  calcSuggestedPrice,
  calcProfit,
  rollPricePerKg,
} from '../lib/calc'

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface FilamentLine {
  id: string
  rollId: number | null
  manualPricePerKg: string
  gramsUsed: string
}

interface CostCalculatorProps {
  prefill?: {
    gramsUsed?: number
    printTimeMin?: number
    fileId?: number
  }
}

export default function CostCalculator({ prefill }: CostCalculatorProps) {
  const qc = useQueryClient()

  const { data: rolls = [] } = useQuery({
    queryKey: ['filament_rolls'],
    queryFn: listFilamentRolls,
  })
  const activeRolls = rolls.filter(r => r.isActive === 1)
  const rollsById = Object.fromEntries(activeRolls.map(r => [r.id, r])) as Record<number, FilamentRoll>

  const [lines, setLines] = useState<FilamentLine[]>([
    {
      id: '0',
      rollId: null,
      manualPricePerKg: '',
      gramsUsed: prefill?.gramsUsed != null ? String(prefill.gramsUsed) : '',
    },
  ])

  const [timeInput, setTimeInput] = useState(
    prefill?.printTimeMin != null ? formatMinutesToTimeInput(prefill.printTimeMin) : ''
  )
  const [wattage, setWattage] = useState(250)
  const [kwhCost, setKwhCost] = useState(0.75)
  const [markup, setMarkup] = useState(30)
  const [saving, setSaving] = useState(false)

  // Load persisted settings on mount (once)
  const settingsLoaded = useRef(false)
  useEffect(() => {
    if (settingsLoaded.current) return
    settingsLoaded.current = true
    Promise.all([
      getSetting('calc_markup_percent'),
      getSetting('calc_printer_wattage'),
      getSetting('calc_energy_cost_kwh'),
    ]).then(([m, w, e]) => {
      if (m != null) setMarkup(Number(m))
      if (w != null) setWattage(Number(w))
      if (e != null) setKwhCost(Number(e))
    })
  }, [])

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(markupTimer.current)
    clearTimeout(wattageTimer.current)
    clearTimeout(kwhTimer.current)
  }, [])

  // Debounced settings persistence — one timer ref per setting
  const markupTimer = useRef<ReturnType<typeof setTimeout>>()
  const wattageTimer = useRef<ReturnType<typeof setTimeout>>()
  const kwhTimer = useRef<ReturnType<typeof setTimeout>>()

  const handleMarkupChange = useCallback((v: number) => {
    setMarkup(v)
    clearTimeout(markupTimer.current)
    markupTimer.current = setTimeout(() => setSetting('calc_markup_percent', String(v)), 500)
  }, [])

  const handleWattageChange = useCallback((v: number) => {
    setWattage(v)
    clearTimeout(wattageTimer.current)
    wattageTimer.current = setTimeout(() => setSetting('calc_printer_wattage', String(v)), 500)
  }, [])

  const handleKwhChange = useCallback((v: number) => {
    setKwhCost(v)
    clearTimeout(kwhTimer.current)
    kwhTimer.current = setTimeout(() => setSetting('calc_energy_cost_kwh', String(v)), 500)
  }, [])

  // Line management
  const updateLine = (id: string, patch: Partial<FilamentLine>) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  const addLine = () =>
    setLines(prev => [...prev, { id: String(Date.now()), rollId: null, manualPricePerKg: '', gramsUsed: '' }])
  const removeLine = (id: string) =>
    setLines(prev => prev.filter(l => l.id !== id))

  // Derived computation
  const completedLines = lines
    .map(l => {
      const gramsUsed = parseFloat(l.gramsUsed)
      if (isNaN(gramsUsed) || gramsUsed <= 0) return null
      const selectedRoll = l.rollId != null ? rollsById[l.rollId] : null
      const derived = selectedRoll ? rollPricePerKg(selectedRoll) : null
      const pricePerKg = derived != null ? derived : parseFloat(l.manualPricePerKg)
      if (isNaN(pricePerKg) || pricePerKg <= 0) return null
      return { gramsUsed, pricePerKg }
    })
    .filter((x): x is { gramsUsed: number; pricePerKg: number } => x != null)

  const filamentCost = calcTotalFilamentCost(completedLines)
  const printHours = parseTimeInput(timeInput)
  const energyCost = printHours != null
    ? calcEnergyCost({ printHours, printerWattage: wattage, energyCostPerKwh: kwhCost })
    : null
  const totalCost = calcTotalCost({ filamentCost, energyCost: energyCost ?? 0 })
  const suggestedPrice = calcSuggestedPrice({ totalCost, markupPercent: markup })
  const profit = calcProfit({ suggestedPrice, totalCost })
  const canSave = prefill?.fileId != null && totalCost > 0

  const handleSave = async () => {
    if (!canSave || prefill?.fileId == null) return
    setSaving(true)
    try {
      const totalGrams = lines.reduce((sum, l) => sum + (parseFloat(l.gramsUsed) || 0), 0)
      await addPrintHistory({
        fileId: prefill.fileId,
        printedAt: Math.floor(Date.now() / 1000),
        actualFilamentG: totalGrams > 0 ? totalGrams : null,
        actualTimeMin: printHours != null ? Math.round(printHours * 60) : null,
        filamentCost,
        saleValue: suggestedPrice,
        // Only the first roll is stored in print history — DB schema has one filamentRollId per record.
        // Cost is calculated correctly for all lines; this limitation only affects the roll reference.
        filamentRollId: lines[0]?.rollId ?? null,
        status: 'success',
      })
      qc.invalidateQueries({ queryKey: ['print_history', prefill.fileId] })
      toast.success('Impressão registrada com sucesso!')
    } catch {
      toast.error('Erro ao registrar impressão.')
    } finally {
      setSaving(false)
    }
  }

  const timeInvalid = timeInput.length > 0 && printHours == null

  return (
    <div className="space-y-4">
      {/* Filament lines */}
      <section className="space-y-2">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Filamento</h3>

        {lines.map(line => {
          const selectedRoll = line.rollId != null ? rollsById[line.rollId] : null
          const derived = selectedRoll ? rollPricePerKg(selectedRoll) : null
          const showManual = selectedRoll == null || derived == null

          return (
            <div key={line.id} className="space-y-1.5 p-2 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className="flex gap-2 items-center">
                <select
                  value={line.rollId ?? ''}
                  onChange={e =>
                    updateLine(line.id, { rollId: e.target.value ? Number(e.target.value) : null })
                  }
                  className="flex-1 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="">Rolo (opcional)</option>
                  {activeRolls.map(r => (
                    <option key={r.id} value={r.id}>
                      {[r.brand, r.material, r.colorName].filter(Boolean).join(' — ')}
                    </option>
                  ))}
                </select>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="text-zinc-600 hover:text-zinc-400 text-sm shrink-0 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {showManual ? (
                  <div className="flex-1 space-y-1">
                    {selectedRoll != null && derived == null && (
                      <p className="text-xs text-amber-500">Rolo sem preço cadastrado</p>
                    )}
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.manualPricePerKg}
                      onChange={e => updateLine(line.id, { manualPricePerKg: e.target.value })}
                      placeholder="R$/kg"
                      className="w-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex-1 text-xs text-zinc-400 px-2 py-1 bg-zinc-800 rounded border border-zinc-700">
                    {fmt.format(derived!)}/kg
                  </div>
                )}
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={line.gramsUsed}
                  onChange={e => updateLine(line.id, { gramsUsed: e.target.value })}
                  placeholder="gramas"
                  className="w-24 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 outline-none"
                />
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={addLine}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          + Adicionar filamento
        </button>
      </section>

      {/* Print fields */}
      <section className="space-y-2">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Impressão</h3>

        <div>
          <label className="text-xs text-zinc-600">Tempo (ex: 1h30m, 90min, 1.5h)</label>
          <input
            type="text"
            value={timeInput}
            onChange={e => setTimeInput(e.target.value)}
            placeholder="1h 30m"
            className={`mt-0.5 w-full text-xs bg-zinc-800 border rounded px-2 py-1 outline-none text-zinc-300 ${
              timeInvalid ? 'border-red-500' : 'border-zinc-700'
            }`}
          />
          {timeInvalid && (
            <p className="text-xs text-red-400 mt-0.5">Formato inválido — use: 1h30m, 90min, 1.5h</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-zinc-600">Potência (W)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={wattage}
              onChange={e => handleWattageChange(Number(e.target.value))}
              className="mt-0.5 w-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-600">R$/kWh</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={kwhCost}
              onChange={e => handleKwhChange(Number(e.target.value))}
              className="mt-0.5 w-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-600">Markup (%)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={markup}
            onChange={e => handleMarkupChange(Number(e.target.value))}
            className="mt-0.5 w-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 outline-none"
          />
        </div>
      </section>

      {/* Results */}
      <section className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 space-y-1.5">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Resultado</h3>
        <ResultRow label="Custo filamento" value={filamentCost > 0 ? fmt.format(filamentCost) : '—'} />
        <ResultRow label="Custo energia" value={energyCost != null ? fmt.format(energyCost) : '—'} />
        <div className="border-t border-zinc-800 pt-1.5 mt-1">
          <ResultRow label="Custo total" value={totalCost > 0 ? fmt.format(totalCost) : '—'} bold />
        </div>
        <ResultRow
          label={`Preço sugerido (+${markup}%)`}
          value={totalCost > 0 ? fmt.format(suggestedPrice) : '—'}
          accent
        />
        <ResultRow label="Lucro" value={totalCost > 0 ? fmt.format(profit) : '—'} />
      </section>

      {/* Save button — only when fileId is provided */}
      {prefill?.fileId != null && (
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {saving ? 'Salvando…' : 'Salvar no histórico'}
        </button>
      )}
    </div>
  )
}

function ResultRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string
  value: string
  bold?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-xs ${accent ? 'text-violet-400' : 'text-zinc-500'}`}>{label}</span>
      <span
        className={`text-xs ${
          bold
            ? 'text-zinc-100 font-semibold'
            : accent
              ? 'text-violet-400 font-semibold'
              : 'text-zinc-300'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
