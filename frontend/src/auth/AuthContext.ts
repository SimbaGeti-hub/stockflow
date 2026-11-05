import { createContext } from 'react'
import type { RegisterInput } from '../lib/session'

export type Me = {
  userId: string
  businessId: string
  role: string
  permissions: string[]
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export type AuthContextValue = {
  status: AuthStatus
  me: Me | null
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  can: (permission: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
