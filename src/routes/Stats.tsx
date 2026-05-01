import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { getDashboardStats } from '../lib/commands'
import { formatCurrency } from '../lib/format'

// ── Date range presets ────────────────────────────────────────────────────────

type Range = 'all' | '30d' | '90d' | '1y'

const RANGES: { value: Range; label: string }[] = [
  { value: 'all', label: 'Todo período' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '1y',  label: '12 meses' },
]

function rangeToTs(range: Range): [number | null, number | null] {
  if (range === 'all') return [null, null]
  const now = Math.floor(Date.now() / 1000)
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365
  return [now - days * 86400, now]
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Stats() {
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('all')
  const [from, to] = rangeToTs(range)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_stats', range],
    queryFn: () => getDashboardStats(from, to),
  })

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
        <button type="button" onClick={() => navigate('/library')}
          className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
          ← Biblioteca
        </button>
        <span className="text-zinc-600">·</span>
        <h1 className="text-zinc-100 font-semibold">Dashboard</h1>

        {/* Range selector */}
        <div className="ml-auto flex gap-1 bg-zinc-900 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                range === r.value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading || !data ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.totalPrints === 0 ? (
        <EmptyState />
      ) : (
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Total impresso" value={String(data.totalPrints)} sub="impressões" />
            <KpiCard label="Faturamento" value={formatCurrency(data.totalRevenue)} sub="cobrado" accent />
            <KpiCard label="Custo filamento" value={formatCurrency(data.totalFilamentCost)} sub="gasto" />
            <KpiCard
              label="Lucro"
              value={formatCurrency(data.profit)}
              sub={data.totalRevenue > 0 ? `${((data.profit / data.totalRevenue) * 100).toFixed(0)}% margem` : '—'}
              accent={data.profit > 0}
            />
          </div>

          {/* Status breakdown */}
          <div className="flex gap-3">
            <StatusBadge label="Sucesso" count={data.successCount} color="emerald" />
            <StatusBadge label="Parcial" count={data.partialCount} color="amber" />
            <StatusBadge label="Falhou"  count={data.failedCount}  color="red" />
            {data.totalFilamentG > 0 && (
              <div className="ml-auto flex items-center gap-2 text-sm text-zinc-400">
                <span className="text-zinc-600">Filamento total:</span>
                <span className="font-medium text-zinc-200">{data.totalFilamentG.toFixed(0)} g</span>
              </div>
            )}
          </div>

          {/* Chart: prints by month */}
          {data.byMonth.length > 0 && (
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Impressões e faturamento por mês</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.byMonth} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis yAxisId="count" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11, fill: '#71717a' }}
                    tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                    labelStyle={{ color: '#e4e4e7' }}
                    formatter={(value, name) =>
                      name === 'Faturamento' ? [formatCurrency(Number(value)), name]
                      : [value, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
                  <Bar yAxisId="count"   dataKey="printCount"   name="Impressões" fill="#7c3aed" radius={[4,4,0,0]} />
                  <Bar yAxisId="revenue" dataKey="revenue"      name="Faturamento" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Top customers */}
            {data.topCustomers.length > 0 && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-medium text-zinc-300 mb-4">Top clientes</h2>
                <div className="space-y-2">
                  {data.topCustomers.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                      <span className="flex-1 text-sm text-zinc-300 truncate">{c.name}</span>
                      <span className="text-xs text-zinc-500">{c.printCount}×</span>
                      <span className="text-sm font-medium text-emerald-400 tabular-nums">
                        {formatCurrency(c.totalRevenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Filament by material */}
            {data.byMaterial.length > 0 && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-medium text-zinc-300 mb-4">Filamento por material</h2>
                <div className="space-y-2">
                  {data.byMaterial.map((m) => {
                    const total = data.byMaterial.reduce((s, x) => s + x.totalG, 0)
                    const pct = total > 0 ? (m.totalG / total) * 100 : 0
                    return (
                      <div key={m.material} className="space-y-1">
                        <div className="flex justify-between text-xs text-zinc-400">
                          <span>{m.material}</span>
                          <span>{m.totalG.toFixed(0)} g ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Low filament warnings */}
          {data.lowFilament.length > 0 && (
            <section className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-5">
              <h2 className="text-sm font-medium text-amber-400 mb-3">⚠ Filamento baixo</h2>
              <div className="space-y-2">
                {data.lowFilament.map((f) => (
                  <div key={f.id} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.colorHex ?? '#6366f1' }} />
                    <span className="flex-1 text-sm text-zinc-300 truncate">{f.label}</span>
                    <span className="text-xs text-amber-400">{Math.round(f.remainingG)}g ({f.pct}%)</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? 'text-emerald-400' : 'text-zinc-100'}`}>{value}</p>
      <p className="text-xs text-zinc-600">{sub}</p>
    </div>
  )
}

function StatusBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    amber:   'bg-amber-500/10  text-amber-400  border-amber-500/30',
    red:     'bg-red-500/10    text-red-400    border-red-500/30',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${cls[color]}`}>
      <span>{count}</span>
      <span>{label}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-20">
      <span className="text-5xl">📊</span>
      <p className="text-zinc-300 font-medium">Sem dados ainda</p>
      <p className="text-zinc-500 text-sm max-w-xs">
        Registre impressões nos arquivos para ver suas estatísticas aqui.
      </p>
    </div>
  )
}
