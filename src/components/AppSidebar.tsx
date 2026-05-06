import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/library',    icon: '📁', label: 'Biblioteca' },
  { to: '/filament',   icon: '🧵', label: 'Filamentos' },
  { to: '/queue',      icon: '⏳', label: 'Fila' },
  { to: '/stats',      icon: '📊', label: 'Dashboard' },
  { to: '/calculator', icon: '🧮', label: 'Calculadora' },
  { to: '/settings',   icon: '⚙️', label: 'Configurações' },
]

export default function AppSidebar({ children }: { children?: ReactNode }) {
  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-y-auto">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2.5">
        <img src="/logo-icon-dark.svg" alt="" className="h-7 w-7 shrink-0" />
        <span className="font-black text-sm tracking-wide leading-none">
          <span className="text-zinc-100">PRINT </span>
          <span className="text-orange-500">HUB</span>
        </span>
      </div>
      {children
        ? <div className="py-2 flex-1 overflow-y-auto">{children}</div>
        : <div className="flex-1" />
      }
      <nav className="border-t border-zinc-800 px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
