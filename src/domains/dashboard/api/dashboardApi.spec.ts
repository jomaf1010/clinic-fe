import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: {} }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./dashboardApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('dashboardApi', () => {
  it('loads dashboard stats by role', async () => {
    const http = makeHttp()
    const { dashboardApi } = await loadApi(http)

    await dashboardApi.stats()
    await dashboardApi.ownerStats()
    await dashboardApi.doctorStats()
    await dashboardApi.staffStats()

    expect(http.get).toHaveBeenNthCalledWith(1, '/dashboard/stats')
    expect(http.get).toHaveBeenNthCalledWith(2, '/dashboard/owner')
    expect(http.get).toHaveBeenNthCalledWith(3, '/dashboard/doctor')
    expect(http.get).toHaveBeenNthCalledWith(4, '/dashboard/staff')
  })

  it('loads dashboard chart datasets', async () => {
    const http = makeHttp()
    const { dashboardApi } = await loadApi(http)

    await dashboardApi.doctorRevenueChart()
    await dashboardApi.patientDistribution()
    await dashboardApi.ownerRevenueChart()

    expect(http.get).toHaveBeenNthCalledWith(1, '/dashboard/doctor/revenue-chart')
    expect(http.get).toHaveBeenNthCalledWith(2, '/dashboard/patient-distribution')
    expect(http.get).toHaveBeenNthCalledWith(3, '/dashboard/owner/revenue-chart')
  })
})
