import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { medcert_requested_by: 'doctor-1', medcert_requested_at: '2026-05-07T04:00:00Z' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./consultationApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('consultationApi', () => {
  it('encodes diagnosis search queries', async () => {
    const http = makeHttp()
    const { consultationApi } = await loadApi(http)

    await consultationApi.searchDiagnoses('acute fever + cough')

    expect(http.get).toHaveBeenCalledWith('/diagnoses/search?q=acute%20fever%20%2B%20cough')
  })

  it('requests a medical certificate for an encounter', async () => {
    const http = makeHttp()
    const { consultationApi } = await loadApi(http)

    await consultationApi.requestMedCert('encounter-1')

    expect(http.post).toHaveBeenCalledWith('/encounters/encounter-1/request-medcert', {})
  })
})
