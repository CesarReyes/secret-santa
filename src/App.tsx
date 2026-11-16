import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ScreenLoader } from '@/components/ScreenLoader'
import { LoginScreen } from '@/screens/LoginScreen'
import { mustChangePin, useAuth } from '@/store/auth'

// Screens behind the login load on demand, so the first visit only downloads the login.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))
const GroupScreen = named(() => import('@/screens/GroupScreen'), 'GroupScreen')
const MySantaScreen = named(() => import('@/screens/MySantaScreen'), 'MySantaScreen')
const WishlistsScreen = named(() => import('@/screens/WishlistsScreen'), 'WishlistsScreen')
const PersonWishlistScreen = named(() => import('@/screens/PersonWishlistScreen'), 'PersonWishlistScreen')
const WallScreen = named(() => import('@/screens/WallScreen'), 'WallScreen')
const RegisterScreen = named(() => import('@/screens/RegisterScreen'), 'RegisterScreen')
const ChangePinScreen = named(() => import('@/screens/ChangePinScreen'), 'ChangePinScreen')

/** Signed-in users only; a temporary PIN must be replaced before anything else. */
function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuth((s) => s.session)
  const location = useLocation()
  if (!session) return <Navigate to="/entrar" replace />
  if (mustChangePin(session) && location.pathname !== '/cambiar-pin') return <Navigate to="/cambiar-pin" replace />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const session = useAuth((s) => s.session)
  return session ? <Navigate to="/" replace /> : children
}

// Hash routing: GitHub Pages has no SPA fallback, so deep links must not hit the server.
export function App() {
  const ready = useAuth((s) => s.ready)
  if (!ready) return <div className="min-h-dvh bg-primary" />

  return (
    <HashRouter>
      <ErrorBoundary>
      <Suspense fallback={<ScreenLoader />}>
      <Routes>
        <Route path="/entrar" element={<GuestOnly><LoginScreen /></GuestOnly>} />
        <Route path="/registro" element={<GuestOnly><RegisterScreen /></GuestOnly>} />
        <Route path="/cambiar-pin" element={<RequireAuth><ChangePinScreen /></RequireAuth>} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<GroupScreen />} />
          <Route path="amigo" element={<MySantaScreen />} />
          <Route path="listas" element={<WishlistsScreen />} />
          <Route path="listas/:userId" element={<PersonWishlistScreen />} />
          <Route path="muro" element={<WallScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </HashRouter>
  )
}
