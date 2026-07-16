import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { CareDashboard } from './features/care/CareDashboard'
import { SettingsPage } from './features/settings/SettingsPage'
import { ProtectedRoute } from './shared/ProtectedRoute'
import { useAuth } from './features/auth/useAuth'

export default function App() {
  const { isAuthenticated } = useAuth()
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/care" replace /> : <LoginPage />} />
        <Route path="/care" element={<ProtectedRoute><CareDashboard /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/care' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  )
}
