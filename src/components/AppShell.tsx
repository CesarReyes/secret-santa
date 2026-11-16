import { NavLink, Outlet } from 'react-router-dom'
import { Gift, MessagesSquare, ScrollText, Users } from 'lucide-react'
import { Snow } from '@/components/Snow'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Grupo', icon: Users, end: true },
  { to: '/amigo', label: 'Mi amigo', icon: Gift, end: false },
  { to: '/listas', label: 'Listas', icon: ScrollText, end: false },
  { to: '/muro', label: 'Muro', icon: MessagesSquare, end: false },
]

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="relative overflow-hidden bg-primary px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-5 text-primary-foreground">
        <Snow />
        <div className="relative flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🎁</span>
          <h1 className="text-xl font-semibold tracking-tight">Amigo Secreto</h1>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted-foreground transition-colors',
                    isActive && 'text-primary',
                  )
                }
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
