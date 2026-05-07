import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { uuid: 'queue-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { uuid: 'queue-1' } }),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./queueApi')
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'https://api.example.test')
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('queueApi', () => {
  it('builds queue list requests with optional filters', async () => {
    const http = makeHttp()
    const { queueApi } = await loadApi(http)

    await queueApi.list()
    await queueApi.list({ doctor_id: 'doctor-1', status: 'waiting' })

    expect(http.get).toHaveBeenNthCalledWith(1, '/queue')
    expect(http.get).toHaveBeenNthCalledWith(2, '/queue?doctor_id=doctor-1&status=waiting')
  })

  it('delegates walk-in and queue state mutations', async () => {
    const http = makeHttp()
    const { queueApi } = await loadApi(http)
    const payload = { patient_id: 'patient-1', doctor_id: 'doctor-1', chief_complaint: 'Fever' }

    await queueApi.walkIn(payload)
    await queueApi.call('queue-1')
    await queueApi.complete('queue-1')
    await queueApi.cancel('queue-1')

    expect(http.post).toHaveBeenCalledWith('/queue/walk-in', payload)
    expect(http.patch).toHaveBeenNthCalledWith(1, '/queue/queue-1/call')
    expect(http.patch).toHaveBeenNthCalledWith(2, '/queue/queue-1/complete')
    expect(http.patch).toHaveBeenNthCalledWith(3, '/queue/queue-1/cancel')
  })

  it('loads public queue display data', async () => {
    const http = makeHttp()
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ clinic_name: 'MediFlow', queue: [] }),
    })
    vi.stubGlobal('fetch', fetch)
    const { queueApi } = await loadApi(http)

    await expect(queueApi.getDisplay('display-token')).resolves.toEqual({ clinic_name: 'MediFlow', queue: [] })

    expect(fetch).toHaveBeenCalledWith('https://api.example.test/queue-display/display-token', {
      headers: { Accept: 'application/json' },
    })
  })

  it('refreshes public queue display Centrifugo tokens', async () => {
    const http = makeHttp()
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ connection_token: 'connection', subscription_token: 'subscription' }),
    })
    vi.stubGlobal('fetch', fetch)
    const { queueApi } = await loadApi(http)

    await expect(queueApi.refreshDisplayTokens('display-token')).resolves.toEqual({
      connection_token: 'connection',
      subscription_token: 'subscription',
    })

    expect(fetch).toHaveBeenCalledWith('https://api.example.test/queue-display/display-token/centrifugo-tokens', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
  })

  it('maps public display fetch failures to stable errors', async () => {
    const http = makeHttp()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetch)
    const { queueApi } = await loadApi(http)

    await expect(queueApi.getDisplay('missing')).rejects.toThrow('INVALID_TOKEN')
    await expect(queueApi.getDisplay('broken')).rejects.toThrow('NETWORK_ERROR')
    await expect(queueApi.refreshDisplayTokens('missing')).rejects.toThrow('INVALID_TOKEN')
    await expect(queueApi.refreshDisplayTokens('broken')).rejects.toThrow('NETWORK_ERROR')
  })

  it('delegates display token management requests', async () => {
    const http = makeHttp()
    const { queueApi } = await loadApi(http)

    await queueApi.getDisplayTokenStatus()
    await queueApi.generateDisplayToken()
    await queueApi.revokeDisplayToken()

    expect(http.get).toHaveBeenCalledWith('/clinic/queue-display-token')
    expect(http.post).toHaveBeenCalledWith('/clinic/queue-display-token')
    expect(http.delete).toHaveBeenCalledWith('/clinic/queue-display-token')
  })
})
