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
