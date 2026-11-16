import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { GroupScreen } from '@/screens/GroupScreen'
import { MySantaScreen } from '@/screens/MySantaScreen'
import { WishlistsScreen } from '@/screens/WishlistsScreen'
import { WallScreen } from '@/screens/WallScreen'
import { LoginScreen } from '@/screens/LoginScreen'

// Hash routing: GitHub Pages has no SPA fallback, so deep links must not hit the server.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/entrar" element={<LoginScreen />} />
        <Route element={<AppShell />}>
          <Route index element={<GroupScreen />} />
          <Route path="amigo" element={<MySantaScreen />} />
          <Route path="listas" element={<WishlistsScreen />} />
          <Route path="muro" element={<WallScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
