import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  upload: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
    put: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
    upload: vi.fn().mockResolvedValue({ data: { avatar_url: 'https://example.test/avatar.png' } }),
  }
}

async function loadApi(http: MockHttp, token: string | null = null) {
  vi.stubEnv('VITE_API_URL', 'https://api.example.test')
  vi.doMock('@/lib/http', () => ({
    http,
    getAuthToken: vi.fn(() => token),
  }))
  return await import('./authApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('authApi', () => {
  it('base64-encodes password fields before sending auth requests', async () => {
    const http = makeHttp()
    const { authApi } = await loadApi(http)

    await authApi.login({ email: 'doctor@example.test', password: 'secret', remember_me: true })
    await authApi.signup({
      first_name: 'Doc',
      last_name: 'Tor',
      email: 'doctor@example.test',
      password: 'secret',
      recaptcha_token: 'captcha-token',
    })
    await authApi.resetPassword({
      email: 'doctor@example.test',
      token: 'reset-token',
      password: 'new-secret',
      password_confirmation: 'new-secret',
    })

    expect(http.post).toHaveBeenNthCalledWith(1, '/auth/login', {
      email: 'doctor@example.test',
      password: btoa('secret'),
      remember_me: true,
    })
    expect(http.post).toHaveBeenNthCalledWith(2, '/auth/signup', expect.objectContaining({
      password: btoa('secret'),
      recaptcha_token: 'captcha-token',
    }))
    expect(http.post).toHaveBeenNthCalledWith(3, '/auth/reset-password', {
      email: 'doctor@example.test',
      token: 'reset-token',
      password: btoa('new-secret'),
      password_confirmation: btoa('new-secret'),
    })
  })

  it('delegates account and session endpoints to the HTTP client', async () => {
    const http = makeHttp()
    const { authApi } = await loadApi(http)

    await authApi.googleAuth({ credential: 'google-token', remember_me: true })
    await authApi.requestGoogleLink({ credential: 'link-token' })
    await authApi.confirmGoogleLink({ email: 'doctor@example.test', token: 'confirm-token' })
    await authApi.verifyEmail({ email: 'doctor@example.test', token: 'verify-token' })
    await authApi.resendVerification({ email: 'doctor@example.test' })
    await authApi.me()
    await authApi.selectClinic('clinic-1')
    await authApi.updatePreferences({ theme: 'dark', tooth_numbering: 'fdi' })
    await authApi.updateProfile({ first_name: 'Doc' })
    await authApi.changePassword({
      current_password: 'old',
      new_password: 'new',
      new_password_confirmation: 'new',
    })
    await authApi.forgotPassword('doctor@example.test')
    await authApi.heartbeat()
    await authApi.onlineUsers()

    expect(http.post).toHaveBeenCalledWith('/auth/google', { credential: 'google-token', remember_me: true })
    expect(http.post).toHaveBeenCalledWith('/auth/google/link-request', { credential: 'link-token' })
    expect(http.post).toHaveBeenCalledWith('/auth/google/link-confirm', { email: 'doctor@example.test', token: 'confirm-token' })
    expect(http.post).toHaveBeenCalledWith('/auth/verify-email', { email: 'doctor@example.test', token: 'verify-token' })
    expect(http.post).toHaveBeenCalledWith('/auth/resend-verification', { email: 'doctor@example.test' })
    expect(http.get).toHaveBeenCalledWith('/auth/me')
    expect(http.post).toHaveBeenCalledWith('/auth/select-clinic', { clinic_id: 'clinic-1' })
    expect(http.patch).toHaveBeenCalledWith('/auth/preferences', { theme: 'dark', tooth_numbering: 'fdi' })
    expect(http.patch).toHaveBeenCalledWith('/auth/profile', { first_name: 'Doc' })
    expect(http.put).toHaveBeenCalledWith('/auth/password', {
      current_password: 'old',
      new_password: 'new',
      new_password_confirmation: 'new',
    })
    expect(http.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'doctor@example.test' })
    expect(http.post).toHaveBeenCalledWith('/auth/heartbeat', {})
    expect(http.get).toHaveBeenCalledWith('/auth/online-users')
  })

  it('uploads profile avatars as form data', async () => {
    const http = makeHttp()
    const { authApi } = await loadApi(http)
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

    await authApi.uploadAvatar(file)

    expect(http.upload).toHaveBeenCalledWith('/auth/avatar', expect.any(FormData))
    const formData = http.upload.mock.calls[0][1] as FormData
    expect(formData.get('avatar')).toBe(file)
  })

  it('refreshes sessions through fetch and returns the JSON payload', async () => {
    const http = makeHttp()
    const response = { data: { access_token: 'fresh-token' } }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { authApi } = await loadApi(http)

    await expect(authApi.refresh()).resolves.toEqual(response)

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/auth/refresh', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
  })

  it('throws when refresh is rejected by the API', async () => {
    const http = makeHttp()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { authApi } = await loadApi(http)

    await expect(authApi.refresh()).rejects.toThrow('Refresh failed')
  })

  it('logs out with the bearer token when available', async () => {
    const http = makeHttp()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { authApi } = await loadApi(http, 'access-token')

    await authApi.logout()

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/auth/logout', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer access-token',
      },
      credentials: 'include',
    })
  })

  it('treats logout as best-effort when the server is unreachable', async () => {
    const http = makeHttp()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { authApi } = await loadApi(http)

    await expect(authApi.logout()).resolves.toBeUndefined()
  })
})
