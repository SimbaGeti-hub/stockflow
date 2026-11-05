import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { request } from '../lib/api'
import {
  clearSession,
  hasStoredSession,
  refreshSession,
  registerOwner,
  signIn,
  signOut,
} from '../lib/session'
import type { RegisterInput } from '../lib/session'
import { AuthContext } from './AuthContext'
import type { AuthStatus, Me } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (hasStoredSession() ? 'loading' : 'signedOut'))

  const loadMe = useCallback(async () => {
    const profile = await request<Me>('/me')
    setMe(profile)
    setStatus('signedIn')
  }, [])

  // On page load, use the saved refresh token to get back into the session.
  useEffect(() => {
    if (!hasStoredSession()) return
    let cancelled = false

    void (async () => {
      const token = await refreshSession()
      if (cancelled) return
      if (!token) {
        setStatus('signedOut')
        return
      }
      try {
        await loadMe()
      } catch {
        clearSession()
        if (!cancelled) setStatus('signedOut')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadMe])

  const login = useCallback(
    async (email: string, password: string) => {
      await signIn(email, password)
      await loadMe()
    },
    [loadMe],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      await registerOwner(input)
      await loadMe()
    },
    [loadMe],
  )

  const logout = useCallback(async () => {
    await signOut()
    setMe(null)
    setStatus('signedOut')
  }, [])

  const can = useCallback((permission: string) => me?.permissions.includes(permission) ?? false, [me])

  const value = useMemo(
    () => ({ status, me, login, register, logout, can }),
    [status, me, login, register, logout, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
