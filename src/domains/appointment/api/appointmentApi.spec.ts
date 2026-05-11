import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { uuid: 'appointment-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { uuid: 'appointment-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./appointmentApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('appointmentApi', () => {
  it('delegates appointment creation', async () => {
    const http = makeHttp()
    const { appointmentApi } = await loadApi(http)
    const payload = { patient_id: 'patient-1', doctor_id: 'doctor-1', scheduled_at: '2026-05-08T09:00:00Z' }

    await appointmentApi.create(payload)

    expect(http.post).toHaveBeenCalledWith('/appointments', payload)
  })

  it('builds appointment list requests with pagination and filters', async () => {
    const http = makeHttp()
    const { appointmentApi } = await loadApi(http)

    await appointmentApi.list()
    await appointmentApi.list(2, 30, {
      doctor_id: 'doctor-1',
      patient_id: 'patient-1',
      status: 'scheduled',
      date: '2026-05-08',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    })

    expect(http.get).toHaveBeenNthCalledWith(1, '/appointments?page=1&per_page=15')
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/appointments?page=2&per_page=30&doctor_id=doctor-1&patient_id=patient-1&status=scheduled&date=2026-05-08&start_date=2026-05-01&end_date=2026-05-31',
    )
  })

  it('loads appointment details and clinic doctors', async () => {
    const http = makeHttp()
    const { appointmentApi } = await loadApi(http)

    await appointmentApi.get('appointment-1')
    await appointmentApi.getDoctors()

    expect(http.get).toHaveBeenNthCalledWith(1, '/appointments/appointment-1')
    expect(http.get).toHaveBeenNthCalledWith(2, '/clinic/doctors')
  })

  it('delegates appointment state mutations', async () => {
    const http = makeHttp()
    const { appointmentApi } = await loadApi(http)

    await appointmentApi.cancel('appointment-1', { reason: 'patient requested' })
    await appointmentApi.checkIn('appointment-1')
    await appointmentApi.noShow('appointment-1')
    await appointmentApi.reschedule('appointment-1', '2026-05-08T10:00:00Z', '2026-05-08T09:00:00Z')
    await appointmentApi.resize('appointment-1', 45, '2026-05-08T09:00:00Z')

    expect(http.patch).toHaveBeenNthCalledWith(1, '/appointments/appointment-1/cancel', { reason: 'patient requested' })
    expect(http.post).toHaveBeenCalledWith('/appointments/appointment-1/check-in')
    expect(http.patch).toHaveBeenNthCalledWith(2, '/appointments/appointment-1/no-show')
    expect(http.patch).toHaveBeenNthCalledWith(3, '/appointments/appointment-1/reschedule', { scheduled_at: '2026-05-08T10:00:00Z' }, { 'X-Expected-Updated-At': '2026-05-08T09:00:00Z' })
    expect(http.patch).toHaveBeenNthCalledWith(4, '/appointments/appointment-1/resize', { duration: 45 }, { 'X-Expected-Updated-At': '2026-05-08T09:00:00Z' })
  })
})
