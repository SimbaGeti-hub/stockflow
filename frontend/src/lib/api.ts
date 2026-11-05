const BASE = '/api/v1'

export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export type TokenResponse = {
  accessToken: string
  tokenType: string
  expiresInSeconds: number
  refreshToken: string
  businessId: string
  role: string
}

type RequestOptions = {
  method?: string
  body?: unknown
  /** Set to false for sign-in, registration, and refresh calls. */
  auth?: boolean
  headers?: Record<string, string>
}

// The access token lives in memory only. It is gone when the tab closes.
let accessToken: string | null = null
let refreshHandler: (() => Promise<string | null>) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setRefreshHandler(handler: (() => Promise<string | null>) | null) {
  refreshHandler = handler
}

async function parseError(response: Response): Promise<ApiError> {
  let message =
    response.status >= 500
      ? 'The server is not available right now. Please try again in a moment.'
      : 'Something went wrong. Please try again.'
  let fieldErrors: Record<string, string> = {}
  try {
    const body = await response.json()
    if (typeof body.message === 'string') message = body.message
    if (body.fieldErrors && typeof body.fieldErrors === 'object') fieldErrors = body.fieldErrors
  } catch {
    // The response had no JSON body, so the default message stays.
  }
  return new ApiError(response.status, message, fieldErrors)
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    return await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    // Status 0 means the request never reached the server.
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }
}

async function execute(path: string, options: RequestOptions): Promise<Response> {
  const useAuth = options.auth !== false
  let response = await send(path, options, useAuth ? accessToken : null)

  // An expired access token: get a fresh one once and try again.
  if (response.status === 401 && useAuth && refreshHandler) {
    const fresh = await refreshHandler()
    if (fresh) response = await send(path, options, fresh)
  }

  if (!response.ok) throw await parseError(response)
  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await execute(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function requestText(path: string): Promise<string> {
  const response = await execute(path, { headers: { Accept: 'text/plain' } })
  return response.text()
}
