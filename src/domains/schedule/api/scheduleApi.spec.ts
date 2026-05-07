import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./scheduleApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('scheduleApi', () => {
  it('loads and upserts working schedules', async () => {
    const http = makeHttp()
    const { scheduleApi } = await loadApi(http)
    const payload = { timezone: 'Asia/Manila', days: [] }

    await scheduleApi.getSchedule('doctor-1')
    await scheduleApi.upsertSchedule('doctor-1', payload)

    expect(http.get).toHaveBeenCalledWith('/schedules/doctor-1')
    expect(http.put).toHaveBeenCalledWith('/schedules/doctor-1', payload)
  })

  it('builds calendar block and availability query params', async () => {
    const http = makeHttp()
    const { scheduleApi } = await loadApi(http)

    await scheduleApi.listAllBlocks('2026-05-01', '2026-05-31')
    await scheduleApi.getAvailability('doctor-1', '2026-05-08')

    expect(http.get).toHaveBeenNthCalledWith(1, '/calendar-blocks?start=2026-05-01&end=2026-05-31')
    expect(http.get).toHaveBeenNthCalledWith(2, '/availability?user_id=doctor-1&date=2026-05-08')
  })

  it('delegates calendar block mutations', async () => {
    const http = makeHttp()
    const { scheduleApi } = await loadApi(http)
    const createPayload = { starts_at: '2026-05-08T09:00:00Z', ends_at: '2026-05-08T10:00:00Z', reason: 'training' }
    const updatePayload = { reason: 'clinic meeting' }

    await scheduleApi.createBlock(createPayload)
    await scheduleApi.updateBlock('block-1', updatePayload)

    expect(http.post).toHaveBeenCalledWith('/calendar-blocks', createPayload)
    expect(http.patch).toHaveBeenCalledWith('/calendar-blocks/block-1', updatePayload)
  })
})
