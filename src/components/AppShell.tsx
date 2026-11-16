import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CloudOff, Gift, KeyRound, LogOut, MessagesSquare, ScrollText, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMyProfile } from '@/lib/profile'
import { useOnline } from '@/lib/online'
import { useAuth } from '@/store/auth'
import { Snow } from '@/components/Snow'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ScreenLoader } from '@/components/ScreenLoader'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Grupo', icon: Users, end: true },
  { to: '/amigo', label: 'Mi amigo', icon: Gift, end: false },
  { to: '/listas', label: 'Listas', icon: ScrollText, end: false },
  { to: '/muro', label: 'Muro', icon: MessagesSquare, end: false },
]

export function AppShell() {
  const { data: profile } = useMyProfile()
  const signOut = useAuth((s) => s.signOut)
  const { pathname } = useLocation()
  const online = useOnline()
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="relative overflow-hidden bg-primary px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-5 text-primary-foreground">
        <Snow />
        <div className="relative flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🎁</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Amigo Secreto</h1>
            {profile && <p className="truncate text-sm opacity-80">Hola, {profile.display_name}</p>}
          </div>
          <Button asChild variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground">
            <Link to="/cambiar-pin" aria-label="Cambiar PIN o contraseña">
              <KeyRound className="size-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Salir"
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      {!online && (
        <p role="status" className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-sm text-muted-foreground">
          <CloudOff className="size-4" aria-hidden /> Sin conexión: verás lo último que se cargó.
        </p>
      )}

      <main className="flex-1 px-4 pt-4 pb-28">
        {/* Keyed by route so a broken screen doesn't keep the other tabs down. */}
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<ScreenLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
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
