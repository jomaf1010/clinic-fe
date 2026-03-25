import { ref } from 'vue'

const BASE_URL = import.meta.env.VITE_API_URL as string

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

async function attemptRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (!response.ok) return false
    const result = await response.json()
    const newToken = result?.data?.access_token
    if (!newToken) return false
    localStorage.setItem('auth_token', newToken)
    authChannel.postMessage({ type: 'token_updated', token: newToken })
    return true
  } catch {
    return false
  }
}

async function handleUnauthorized(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = attemptRefresh().finally(() => { refreshPromise = null })
  return refreshPromise
}

// Multi-tab sync
const authChannel = new BroadcastChannel('auth_token_sync')
authChannel.addEventListener('message', (event) => {
  if (event.data?.type === 'token_updated') {
    localStorage.setItem('auth_token', event.data.token)
  } else if (event.data?.type === 'logged_out') {
    localStorage.removeItem('auth_token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
})

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {} } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Session-Id': SESSION_ID,
    ...extraHeaders,
  }

  const token = localStorage.getItem('auth_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = `${BASE_URL}${endpoint}`

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    cache: 'no-store',
  })

  if (response.status === 503) {
    isMaintenanceMode.value = true
    throw new HttpError(503, 'Service temporarily unavailable')
  }

  if (response.status === 401) {
    const refreshed = await handleUnauthorized()
    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem('auth_token')
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
      }
      const retryResponse = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include',
      })

      let retryData: unknown
      const retryContentType = retryResponse.headers.get('content-type')
      if (retryContentType && retryContentType.includes('application/json')) {
        retryData = await retryResponse.json()
      } else {
        retryData = await retryResponse.text()
      }

      if (!retryResponse.ok) {
        throw new HttpError(retryResponse.status, `Request failed with status ${retryResponse.status}`, retryData)
      }

      return retryData as T
    }

    localStorage.removeItem('auth_token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new HttpError(401, 'Unauthorized')
  }

  let data: unknown
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${response.status}`, data)
  }

  return data as T
}

async function uploadRequest<T>(endpoint: string, formData: FormData, method: HttpMethod = 'POST'): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const token = localStorage.getItem('auth_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = `${BASE_URL}${endpoint}`

  const response = await fetch(url, {
    method,
    headers,
    body: formData,
    credentials: 'include',
  })

  if (response.status === 503) {
    isMaintenanceMode.value = true
    throw new HttpError(503, 'Service temporarily unavailable')
  }

  if (response.status === 401) {
    const refreshed = await handleUnauthorized()
    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem('auth_token')
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`
      }
      const retryResponse = await fetch(url, {
        method,
        headers,
        body: formData,
        credentials: 'include',
      })

      let retryData: unknown
      const retryContentType = retryResponse.headers.get('content-type')
      if (retryContentType && retryContentType.includes('application/json')) {
        retryData = await retryResponse.json()
      } else {
        retryData = await retryResponse.text()
      }

      if (!retryResponse.ok) {
        throw new HttpError(retryResponse.status, `Request failed with status ${retryResponse.status}`, retryData)
      }

      return retryData as T
    }

    localStorage.removeItem('auth_token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new HttpError(401, 'Unauthorized')
  }

  let data: unknown
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${response.status}`, data)
  }

  return data as T
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
}

export { HttpError }
