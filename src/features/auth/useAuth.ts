import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser, setCurrentUser, type User } from './authStore'

export function useAuth() {
  const [user, setUser] = useState<User | null>(getCurrentUser())

  useEffect(() => {
    const handler = () => setUser(getCurrentUser())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const login = useCallback((u: User) => {
    setCurrentUser(u)
    setUser(u)
  }, [])

  const doLogout = useCallback(() => {
    setCurrentUser(null)
    setUser(null)
  }, [])

  return { user, login, logout: doLogout, isAuthenticated: !!user }
}
