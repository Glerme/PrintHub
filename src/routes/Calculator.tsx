import AppSidebar from '../components/AppSidebar'
import CostCalculator from '../components/CostCalculator'

export default function Calculator() {
  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <AppSidebar />
      <div className="flex-1 overflow-y-auto flex justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="text-zinc-100 font-semibold mb-6">Calculadora de Custo</h1>
          <CostCalculator />
        </div>
      </div>
    </div>
  )
}
