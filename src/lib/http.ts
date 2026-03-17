const BASE_URL = import.meta.env.VITE_API_URL as string

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

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {} } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
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
  })

  if (response.status === 401) {
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
  })

  if (response.status === 401) {
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
