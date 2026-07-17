import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RoleSelect } from './features/auth/RoleSelect'
import { CareDashboard } from './features/care/CareDashboard'
import { ChildPage } from './features/care/ChildPage'
import { CareReport } from './features/care/CareReport'
import { EventLog } from './features/care/EventLog'
import { ZBI } from './features/assessment/ZBI'
import { SettingsPage } from './features/settings/SettingsPage'
import { ProtectedRoute } from './shared/ProtectedRoute'
import { useAuth } from './features/auth/useAuth'
import { useEffect } from 'react'
import { applyTheme, getTheme } from './shared/theme'

export default function App() {
  const { isAuthenticated } = useAuth()

  // 应用初始化时按 localStorage 中保存的主题应用一次
  useEffect(() => {
    applyTheme(getTheme())
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/role" replace /> : <LoginPage />} />
        <Route path="/role" element={<ProtectedRoute><RoleSelect /></ProtectedRoute>} />
        <Route path="/care" element={<ProtectedRoute><CareDashboard /></ProtectedRoute>} />
        <Route path="/child" element={<ProtectedRoute><ChildPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute><CareReport /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute><EventLog /></ProtectedRoute>} />
        <Route path="/assessment" element={<ProtectedRoute><ZBI /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/role' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  )
}
