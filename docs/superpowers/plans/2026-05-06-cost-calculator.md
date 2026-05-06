# Cost Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar uma calculadora de custo de impressão 3D integrada ao Print Hub, com acesso standalone no sidebar da Library e seção pré-preenchida no FileDetail.

**Architecture:** Um componente compartilhado `CostCalculator` aceita uma prop `prefill` opcional; quando vazio, funciona standalone; quando inclui `fileId`, exibe botão "Salvar no histórico". Funções puras de cálculo em `src/lib/calc.ts`. Settings persistidos na tabela `settings` existente via `getSetting`/`setSetting`.

**Tech Stack:** React, TypeScript, TanStack Query, Tauri IPC (`getSetting`, `setSetting`, `listFilamentRolls`, `addPrintHistory`), Tailwind CSS, Vitest.

---

## Arquivos

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Criar | `src/lib/calc.ts` | Funções puras de cálculo (sem deps de framework) |
| Criar | `src/lib/calc.test.ts` | Testes Vitest para as funções puras |
| Criar | `src/components/CostCalculator.tsx` | Componente UI compartilhado |
| Criar | `src/routes/Calculator.tsx` | Tela standalone `/calculator` |
| Modificar | `src/routes/Library.tsx` | Adicionar link "Calculadora" no nav bottom |
| Modificar | `src/App.tsx` | Adicionar rota `/calculator` |
| Modificar | `src/routes/FileDetail.tsx` | Seção "Calcular custo" no InfoPanel |

---

## Task 1: Funções puras de cálculo (TDD)

**Files:**
- Create: `src/lib/calc.ts`
- Create: `src/lib/calc.test.ts`

- [ ] **Step 1.1: Criar o arquivo de testes com os casos failing**

Crie `src/lib/calc.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  formatMinutesToTimeInput,
  parseTimeInput,
  calcFilamentLineCost,
  calcTotalFilamentCost,
  calcEnergyCost,
  calcTotalCost,
  calcSuggestedPrice,
  calcMargin,
  rollPricePerKg,
} from './calc'

describe('formatMinutesToTimeInput', () => {
  it('formats hours and minutes', () => expect(formatMinutesToTimeInput(135)).toBe('2h 15m'))
  it('formats hours only when minutes are 0', () => expect(formatMinutesToTimeInput(120)).toBe('2h'))
  it('formats minutes only when hours are 0', () => expect(formatMinutesToTimeInput(45)).toBe('45m'))
  it('handles 0 minutes', () => expect(formatMinutesToTimeInput(0)).toBe('0m'))
})

describe('parseTimeInput', () => {
  it('parses "1h30m"', () => expect(parseTimeInput('1h30m')).toBeCloseTo(1.5))
  it('parses "1h 30m" with space', () => expect(parseTimeInput('1h 30m')).toBeCloseTo(1.5))
  it('parses "90min"', () => expect(parseTimeInput('90min')).toBeCloseTo(1.5))
  it('parses "90m"', () => expect(parseTimeInput('90m')).toBeCloseTo(1.5))
  it('parses "1.5h"', () => expect(parseTimeInput('1.5h')).toBeCloseTo(1.5))
  it('parses "2h"', () => expect(parseTimeInput('2h')).toBeCloseTo(2))
  it('returns null for empty string', () => expect(parseTimeInput('')).toBeNull())
  it('returns null for bare number (ambiguous)', () => expect(parseTimeInput('90')).toBeNull())
  it('returns null for zero hours', () => expect(parseTimeInput('0h')).toBeNull())
  it('returns null for nonsense', () => expect(parseTimeInput('abc')).toBeNull())
  it('is case insensitive', () => expect(parseTimeInput('1H30M')).toBeCloseTo(1.5))
})

describe('calcFilamentLineCost', () => {
  it('calculates cost: 100g at R$80/kg = R$8', () => {
    expect(calcFilamentLineCost({ gramsUsed: 100, pricePerKg: 80 })).toBeCloseTo(8)
  })
  it('calculates cost: 47g at R$95/kg', () => {
    expect(calcFilamentLineCost({ gramsUsed: 47, pricePerKg: 95 })).toBeCloseTo(4.465)
  })
})

describe('calcTotalFilamentCost', () => {
  it('sums multiple lines', () => {
    const lines = [
      { gramsUsed: 35, pricePerKg: 80 },   // 2.80
      { gramsUsed: 12, pricePerKg: 100 },  // 1.20
    ]
    expect(calcTotalFilamentCost(lines)).toBeCloseTo(4.0)
  })
  it('returns 0 for empty array', () => {
    expect(calcTotalFilamentCost([])).toBe(0)
  })
  it('returns cost of single line', () => {
    expect(calcTotalFilamentCost([{ gramsUsed: 100, pricePerKg: 80 }])).toBeCloseTo(8)
  })
})

describe('calcEnergyCost', () => {
  it('calculates: 2h × 250W × R$0.75/kWh = R$0.375', () => {
    expect(calcEnergyCost({ printHours: 2, printerWattage: 250, energyCostPerKwh: 0.75 }))
      .toBeCloseTo(0.375)
  })
  it('handles zero wattage', () => {
    expect(calcEnergyCost({ printHours: 2, printerWattage: 0, energyCostPerKwh: 0.75 })).toBe(0)
  })
})

describe('calcTotalCost', () => {
  it('sums filament and energy costs', () => {
    expect(calcTotalCost({ filamentCost: 5, energyCost: 1.5 })).toBeCloseTo(6.5)
  })
  it('works when energy is 0', () => {
    expect(calcTotalCost({ filamentCost: 5, energyCost: 0 })).toBeCloseTo(5)
  })
})

describe('calcSuggestedPrice', () => {
  it('applies 30% markup to R$10 = R$13', () => {
    expect(calcSuggestedPrice({ totalCost: 10, markupPercent: 30 })).toBeCloseTo(13)
  })
  it('applies 0% markup returns same cost', () => {
    expect(calcSuggestedPrice({ totalCost: 10, markupPercent: 0 })).toBeCloseTo(10)
  })
  it('applies 100% markup doubles the cost', () => {
    expect(calcSuggestedPrice({ totalCost: 10, markupPercent: 100 })).toBeCloseTo(20)
  })
})

describe('calcMargin', () => {
  it('calculates margin: R$13 - R$10 = R$3', () => {
    expect(calcMargin({ suggestedPrice: 13, totalCost: 10 })).toBeCloseTo(3)
  })
  it('margin is 0 when no markup', () => {
    expect(calcMargin({ suggestedPrice: 10, totalCost: 10 })).toBeCloseTo(0)
  })
})

describe('rollPricePerKg', () => {
  it('derives R$80/kg from 1kg roll at R$80', () => {
    expect(rollPricePerKg({ cost: 80, initialWeightG: 1000 })).toBeCloseTo(80)
  })
  it('derives R$50/kg from 500g roll at R$25', () => {
    expect(rollPricePerKg({ cost: 25, initialWeightG: 500 })).toBeCloseTo(50)
  })
  it('returns null when cost is null', () => {
    expect(rollPricePerKg({ cost: null, initialWeightG: 1000 })).toBeNull()
  })
  it('returns null when initialWeightG is 0 (avoid division by zero)', () => {
    expect(rollPricePerKg({ cost: 80, initialWeightG: 0 })).toBeNull()
  })
})
```

- [ ] **Step 1.2: Rodar os testes e confirmar que falham**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm test --run src/lib/calc.test.ts
```

Esperado: erros de "cannot find module './calc'"

- [ ] **Step 1.3: Criar `src/lib/calc.ts` com a implementação**

```ts
export function formatMinutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const hmMatch = trimmed.match(/^(\d+(?:\.\d+)?)h\s*(\d+(?:\.\d+)?)m(?:in)?$/i)
  if (hmMatch) {
    const result = parseFloat(hmMatch[1]) + parseFloat(hmMatch[2]) / 60
    return result > 0 ? result : null
  }

  const minMatch = trimmed.match(/^(\d+(?:\.\d+)?)m(?:in)?$/i)
  if (minMatch) {
    const result = parseFloat(minMatch[1]) / 60
    return result > 0 ? result : null
  }

  const hMatch = trimmed.match(/^(\d+(?:\.\d+)?)h$/i)
  if (hMatch) {
    const result = parseFloat(hMatch[1])
    return result > 0 ? result : null
  }

  return null
}

export function calcFilamentLineCost({
  gramsUsed,
  pricePerKg,
}: {
  gramsUsed: number
  pricePerKg: number
}): number {
  return gramsUsed * (pricePerKg / 1000)
}

export function calcTotalFilamentCost(
  lines: { gramsUsed: number; pricePerKg: number }[]
): number {
  return lines.reduce((sum, l) => sum + calcFilamentLineCost(l), 0)
}

export function calcEnergyCost({
  printHours,
  printerWattage,
  energyCostPerKwh,
}: {
  printHours: number
  printerWattage: number
  energyCostPerKwh: number
}): number {
  return printHours * (printerWattage / 1000) * energyCostPerKwh
}

export function calcTotalCost({
  filamentCost,
  energyCost,
}: {
  filamentCost: number
  energyCost: number
}): number {
  return filamentCost + energyCost
}

export function calcSuggestedPrice({
  totalCost,
  markupPercent,
}: {
  totalCost: number
  markupPercent: number
}): number {
  return totalCost * (1 + markupPercent / 100)
}

export function calcMargin({
  suggestedPrice,
  totalCost,
}: {
  suggestedPrice: number
  totalCost: number
}): number {
  return suggestedPrice - totalCost
}

export function rollPricePerKg(roll: {
  cost: number | null
  initialWeightG: number
}): number | null {
  if (roll.cost === null || roll.initialWeightG === 0) return null
  return (roll.cost / roll.initialWeightG) * 1000
}
```

- [ ] **Step 1.4: Rodar os testes e confirmar que passam**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm test --run src/lib/calc.test.ts
```

Esperado: todos os testes PASS.

- [ ] **Step 1.5: Commit**

```bash
cd /home/gui/Documents/projetos/print-hub
git add src/lib/calc.ts src/lib/calc.test.ts
git commit -m "feat: add pure cost calculation functions with tests"
```

---

## Task 2: Componente CostCalculator

**Files:**
- Create: `src/components/CostCalculator.tsx`

- [ ] **Step 2.1: Criar `src/components/CostCalculator.tsx`**

```tsx
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
  calcMargin,
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
  const margin = calcMargin({ suggestedPrice, totalCost })
  const canSave = prefill?.fileId != null && totalCost > 0

  const [saving, setSaving] = useState(false)

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
        <ResultRow label="Margem" value={totalCost > 0 ? fmt.format(margin) : '—'} />
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
```

- [ ] **Step 2.2: Verificar que não há erros de TypeScript**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm exec tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 2.3: Commit**

```bash
cd /home/gui/Documents/projetos/print-hub
git add src/components/CostCalculator.tsx
git commit -m "feat: add CostCalculator shared component"
```

---

## Task 3: Rota standalone `/calculator` + wiring no App

**Files:**
- Create: `src/routes/Calculator.tsx`
- Modify: `src/App.tsx` (adicionar rota `/calculator`)
- Modify: `src/routes/Library.tsx` (adicionar NavLink no bottom nav)

- [ ] **Step 3.1: Criar `src/routes/Calculator.tsx`**

```tsx
import CostCalculator from '../components/CostCalculator'

export default function Calculator() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-zinc-100 font-medium">Calculadora de Custo</span>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-sm">
          <CostCalculator />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Adicionar rota em `src/App.tsx`**

Adicione o import lazy e a rota. O arquivo atual tem imports lazy no topo e `<Routes>` na função `AppRouter`. Insira:

```tsx
// No bloco de imports lazy (após a linha do Settings):
const Calculator = lazy(() => import('./routes/Calculator'))
```

E dentro de `<Routes>` (antes do catch-all `path="*"`):

```tsx
<Route path="/calculator" element={<Calculator />} />
```

- [ ] **Step 3.3: Adicionar NavLink no bottom nav da Library**

Em `src/routes/Library.tsx`, localize o array de itens de navegação:

```tsx
// Linha atual:
{ to: '/settings', icon: '⚙️', label: 'Configurações' },
```

Adicione a entrada da calculadora antes de Configurações:

```tsx
{ to: '/calculator', icon: '🧮', label: 'Calculadora' },
{ to: '/settings',   icon: '⚙️', label: 'Configurações' },
```

- [ ] **Step 3.4: Rodar testes e lint**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm test --run && pnpm lint
```

Esperado: todos os testes passando, sem erros de lint.

- [ ] **Step 3.5: Commit**

```bash
cd /home/gui/Documents/projetos/print-hub
git add src/routes/Calculator.tsx src/App.tsx src/routes/Library.tsx
git commit -m "feat: add /calculator route and sidebar nav link"
```

---

## Task 4: Integração no FileDetail

**Files:**
- Modify: `src/routes/FileDetail.tsx`

- [ ] **Step 4.1: Adicionar import do CostCalculator em `src/routes/FileDetail.tsx`**

No topo do arquivo, após os imports existentes:

```tsx
import CostCalculator from '../components/CostCalculator'
```

- [ ] **Step 4.2: Adicionar estado `showCalc` na função `InfoPanel`**

Na função `InfoPanel` (linha ~112), após a declaração de `showForm`:

```tsx
const [showCalc, setShowCalc] = useState(false)
```

- [ ] **Step 4.3: Adicionar seção "Calcular custo" no JSX do InfoPanel**

Após a seção `{/* Tags */}` (que contém `<TagPicker />`), adicione:

```tsx
{/* Cost calculator */}
<section className="space-y-3">
  <button
    type="button"
    onClick={() => setShowCalc(v => !v)}
    className="flex items-center justify-between w-full text-xs font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
  >
    <span>🧮 Calcular custo</span>
    <span>{showCalc ? '▲' : '▼'}</span>
  </button>
  {showCalc && (
    <CostCalculator
      prefill={{
        gramsUsed: file.estimatedFilamentG ?? undefined,
        printTimeMin: file.estimatedPrintTimeMin ?? undefined,
        fileId: file.id,
      }}
    />
  )}
</section>
```

- [ ] **Step 4.4: Rodar testes e lint**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm test --run && pnpm lint
```

Esperado: todos os testes passando, zero erros de lint.

- [ ] **Step 4.5: Commit**

```bash
cd /home/gui/Documents/projetos/print-hub
git add src/routes/FileDetail.tsx
git commit -m "feat: add cost calculator section to FileDetail info panel"
```

---

## Task 5: Verificação final

- [ ] **Step 5.1: Rodar suite completa de testes**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm test --run
```

Esperado: todos os testes PASS.

- [ ] **Step 5.2: Rodar testes Rust**

```bash
cd /home/gui/Documents/projetos/print-hub/src-tauri && cargo test
```

Esperado: todos os testes PASS (nenhuma alteração Rust foi feita, mas confirmar que nada quebrou).

- [ ] **Step 5.3: Rodar lint**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm lint
```

Esperado: zero erros ou warnings.

- [ ] **Step 5.4: Verificar TypeScript**

```bash
cd /home/gui/Documents/projetos/print-hub && pnpm exec tsc --noEmit
```

Esperado: zero erros.
