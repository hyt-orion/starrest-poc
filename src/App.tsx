import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RoleSelect } from './features/auth/RoleSelect'
import { CareDashboard } from './features/care/CareDashboard'
import { ChildPage } from './features/care/ChildPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ProtectedRoute } from './shared/ProtectedRoute'
import { useAuth } from './features/auth/useAuth'

export default function App() {
  const { isAuthenticated } = useAuth()
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/role" replace /> : <LoginPage />} />
        <Route path="/role" element={<ProtectedRoute><RoleSelect /></ProtectedRoute>} />
        <Route path="/care" element={<ProtectedRoute><CareDashboard /></ProtectedRoute>} />
        <Route path="/child" element={<ProtectedRoute><ChildPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/role' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  )
}
