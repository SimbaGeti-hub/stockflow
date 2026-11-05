import { ApiError, request, setAccessToken, setRefreshHandler } from './api'
import type { TokenResponse } from './api'

export type RegisterInput = {
  fullName: string
  email: string
  password: string
  businessName: string
  currencyCode: string
}

// The refresh token is kept in localStorage for now. A later hardening step moves it to
// an httpOnly cookie so scripts on the page can never read it.
const REFRESH_KEY = 'stockflow.refreshToken'

let inflight: Promise<string | null> | null = null

function store(tokens: TokenResponse) {
  setAccessToken(tokens.accessToken)
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
}

export function clearSession() {
  setAccessToken(null)
  localStorage.removeItem(REFRESH_KEY)
}

export function hasStoredSession(): boolean {
  return localStorage.getItem(REFRESH_KEY) !== null
}

async function doRefresh(): Promise<string | null> {
  const stored = localStorage.getItem(REFRESH_KEY)
  if (!stored) return null
  try {
    const tokens = await request<TokenResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: stored },
      auth: false,
    })
    store(tokens)
    return tokens.accessToken
  } catch (e) {
    // If the server could not be reached, the saved session may still be good. Keep it.
    if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) return null
    clearSession()
    return null
  }
}

/**
 * Refresh tokens work once. If two refreshes ran at the same time with the same token,
 * the server would treat the second as theft and end the session. So every caller
 * shares one refresh that is already in progress.
 */
export function refreshSession(): Promise<string | null> {
  if (!inflight) {
    inflight = doRefresh().finally(() => {
      inflight = null
    })
  }
  return inflight
}

setRefreshHandler(refreshSession)

export async function signIn(email: string, password: string): Promise<void> {
  const tokens = await request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
  store(tokens)
}

export async function registerOwner(input: RegisterInput): Promise<void> {
  await request('/auth/register', { method: 'POST', body: input, auth: false })
  await signIn(input.email, input.password)
}

export async function signOut(): Promise<void> {
  const stored = localStorage.getItem(REFRESH_KEY)
  clearSession()
  if (stored) {
    try {
      await request('/auth/logout', { method: 'POST', body: { refreshToken: stored }, auth: false })
    } catch {
      // Signing out locally is enough if the server cannot be reached.
    }
  }
}
