import { ref } from 'vue'

const BASE_URL = import.meta.env.VITE_API_URL as string

// In-memory token store — never persisted to localStorage
let _authToken: string | null = null

export function setAuthToken(token: string | null): void {
  _authToken = token
}

export function getAuthToken(): string | null {
  return _authToken
}

// Unique ID per browser tab — used for self-echo prevention in real-time sync
export const SESSION_ID = typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const isMaintenanceMode = ref(false)

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
}

class HttpError extends Error {
  readonly status: number
  readonly data?: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

let refreshPromise: Promise<boolean> | null = null

async function syncAuthStore(newToken: string): Promise<void> {
  try {
    const { useAuthStore } = await import('@/domains/auth/stores/authStore')
    await useAuthStore().syncExternalSession(newToken, { reloadOnAccountChange: true })
  } catch {
    // Auth store may not be mounted yet; keep the HTTP token in sync at minimum.
  }
}

async function attemptRefresh(): Promise<boolean> {
  // Network errors (TypeError) propagate — callers must distinguish
  // "server rejected refresh" (false) from "server unreachable" (throw)
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })
  if (!response.ok) return false
  const result = await response.json()
  const newToken = result?.data?.access_token
  if (!newToken) return false
  setAuthToken(newToken)
  await syncAuthStore(newToken)
  authChannel.postMessage({ type: 'session_changed' })
  return true
}

async function handleUnauthorized(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = attemptRefresh().finally(() => { refreshPromise = null })
  return refreshPromise
}

/**
 * Single-flight access-token refresh, shared with the Apollo error link so
 * GraphQL recovers from an expired token exactly like REST does. Returns true
 * if a fresh token is now available.
 */
export function refreshAccessToken(): Promise<boolean> {
  return handleUnauthorized()
}

// Multi-tab sync
const authChannel = new BroadcastChannel('auth_token_sync')
authChannel.addEventListener('message', (event) => {
  if (event.data?.type === 'session_changed') {
    // Another tab refreshed — silently get our own fresh token from the httpOnly cookie
    fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
      .then(r => (r.ok ? r.json() : null))
      .then(async (result) => {
        const newToken = result?.data?.access_token
        if (newToken) {
          setAuthToken(newToken)
          await syncAuthStore(newToken)
        }
      })
      .catch(() => { /* keep existing token on network error */ })
  } else if (event.data?.type === 'logged_out') {
    setAuthToken(null)
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
})

function parseBody(response: Response): Promise<unknown> {
  const ct = response.headers.get('content-type')
  return ct && ct.includes('application/json') ? response.json() : response.text()
}

async function handleResponse<T>(
  response: Response,
  headers: Record<string, string>,
  retry: () => Promise<Response>,
): Promise<T> {
  if (response.status === 503) {
    const data = await parseBody(response)
    const errorCode = typeof data === 'object' && data !== null && 'error_code' in data
      ? (data as { error_code?: unknown }).error_code
      : null
    if (typeof data === 'string' || errorCode === 'maintenance_mode') {
      isMaintenanceMode.value = true
    }
    throw new HttpError(503, 'Service temporarily unavailable', data)
  }

  if (response.status === 401) {
    let refreshed = false
    try {
      refreshed = await handleUnauthorized()
    } catch {
      // Network error during refresh — don't destroy credentials
      throw new HttpError(401, 'Unauthorized')
    }

    if (refreshed) {
      const newToken = _authToken
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`
      const retryResponse = await retry()
      const retryData = await parseBody(retryResponse)
      if (!retryResponse.ok) {
        throw new HttpError(retryResponse.status, `Request failed with status ${retryResponse.status}`, retryData)
      }
      return retryData as T
    }

    // Refresh explicitly rejected — auth is confirmed invalid
    setAuthToken(null)
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new HttpError(401, 'Unauthorized')
  }

  const data = await parseBody(response)
  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${response.status}`, data)
  }
  return data as T
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {} } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Session-Id': SESSION_ID,
    ...extraHeaders,
  }

  const token = _authToken
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = `${BASE_URL}${endpoint}`
  const doFetch = () => fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    cache: 'no-store',
  })

  return handleResponse<T>(await doFetch(), headers, doFetch)
}

async function uploadRequest<T>(endpoint: string, formData: FormData, method: HttpMethod = 'POST'): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }

  const token = _authToken
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = `${BASE_URL}${endpoint}`
  const doFetch = () => fetch(url, {
    method,
    headers,
    body: formData,
    credentials: 'include',
  })

  return handleResponse<T>(await doFetch(), headers, doFetch)
}

async function blobRequest(url: string): Promise<Blob> {
  const headers: Record<string, string> = {
    Accept: '*/*',
  }
  const token = _authToken
  if (token) headers['Authorization'] = `Bearer ${token}`

  const doFetch = () => fetch(url, { headers, credentials: 'include', cache: 'no-store' })
  let response = await doFetch()

  if (response.status === 401) {
    const refreshed = await handleUnauthorized().catch(() => false)
    if (refreshed && _authToken) {
      headers['Authorization'] = `Bearer ${_authToken}`
      response = await doFetch()
    }
  }

  if (!response.ok) throw new HttpError(response.status, `Request failed with status ${response.status}`)
  return response.blob()
}

export const http = {
  get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return request<T>(endpoint, { method: 'GET', headers })
  },
  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return request<T>(endpoint, { method: 'POST', body, headers })
  },
  put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return request<T>(endpoint, { method: 'PUT', body, headers })
  },
  patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return request<T>(endpoint, { method: 'PATCH', body, headers })
  },
  delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE', headers })
  },
  upload<T>(endpoint: string, formData: FormData, method?: HttpMethod): Promise<T> {
    return uploadRequest<T>(endpoint, formData, method)
  },
  getBlob(endpoint: string): Promise<Blob> {
    return blobRequest(`${BASE_URL}${endpoint}`)
  },
  download(url: string): Promise<Blob> {
    return blobRequest(url)
  },
}

export { HttpError }
