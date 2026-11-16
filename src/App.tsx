import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { GroupScreen } from '@/screens/GroupScreen'
import { MySantaScreen } from '@/screens/MySantaScreen'
import { WishlistsScreen } from '@/screens/WishlistsScreen'
import { PersonWishlistScreen } from '@/screens/PersonWishlistScreen'
import { WallScreen } from '@/screens/WallScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { RegisterScreen } from '@/screens/RegisterScreen'
import { ChangePinScreen } from '@/screens/ChangePinScreen'
import { mustChangePin, useAuth } from '@/store/auth'

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
    </HashRouter>
  )
}
