import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { uuid: 'dental-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { uuid: 'dental-1' } }),
    put: vi.fn().mockResolvedValue({ data: { uuid: 'dental-1' } }),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./dentalApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('dentalApi', () => {
  it('loads and updates patient dental profiles', async () => {
    const http = makeHttp()
    const { dentalApi } = await loadApi(http)
    const payload = { odontogram: { '11': { conditions: ['caries'] } } }

    await dentalApi.getProfile('patient-1')
    await dentalApi.updateProfile('patient-1', payload)

    expect(http.get).toHaveBeenCalledWith('/patients/patient-1/dental-profile')
    expect(http.put).toHaveBeenCalledWith('/patients/patient-1/dental-profile', payload)
  })

  it('delegates treatment plan reads and mutations', async () => {
    const http = makeHttp()
    const { dentalApi } = await loadApi(http)
    const createPayload = { title: 'Restoration plan', items: [] }
    const updatePayload = { status: 'accepted' }

    await dentalApi.listTreatmentPlans('patient-1')
    await dentalApi.showTreatmentPlan('patient-1', 'plan-1')
    await dentalApi.createTreatmentPlan('patient-1', createPayload)
    await dentalApi.updateTreatmentPlan('patient-1', 'plan-1', updatePayload)
    await dentalApi.deleteTreatmentPlan('patient-1', 'plan-1')

    expect(http.get).toHaveBeenNthCalledWith(1, '/patients/patient-1/dental-treatment-plans')
    expect(http.get).toHaveBeenNthCalledWith(2, '/patients/patient-1/dental-treatment-plans/plan-1')
    expect(http.post).toHaveBeenCalledWith('/patients/patient-1/dental-treatment-plans', createPayload)
    expect(http.patch).toHaveBeenCalledWith('/patients/patient-1/dental-treatment-plans/plan-1', updatePayload)
    expect(http.delete).toHaveBeenCalledWith('/patients/patient-1/dental-treatment-plans/plan-1')
  })

  it('builds dental visit requests with optional treatment plan filtering', async () => {
    const http = makeHttp()
    const { dentalApi } = await loadApi(http)
    const updatePayload = { notes: 'Polish completed' }

    await dentalApi.listVisits('patient-1')
    await dentalApi.listVisits('patient-1', 'plan with space')
    await dentalApi.showVisit('patient-1', 'visit-1')
    await dentalApi.updateVisit('patient-1', 'visit-1', updatePayload)
    await dentalApi.deleteVisit('patient-1', 'visit-1')

    expect(http.get).toHaveBeenNthCalledWith(1, '/patients/patient-1/dental-visits')
    expect(http.get).toHaveBeenNthCalledWith(2, '/patients/patient-1/dental-visits?treatment_plan_id=plan%20with%20space')
    expect(http.get).toHaveBeenNthCalledWith(3, '/patients/patient-1/dental-visits/visit-1')
    expect(http.patch).toHaveBeenCalledWith('/patients/patient-1/dental-visits/visit-1', updatePayload)
    expect(http.delete).toHaveBeenCalledWith('/patients/patient-1/dental-visits/visit-1')
  })

  it('delegates clinic and doctor dental service catalog requests', async () => {
    const http = makeHttp()
    const { dentalApi } = await loadApi(http)
    const clinicPayload = { price: 1200, is_active: true }
    const doctorPayload = { override_price: 1000, override_is_active: true }

    await dentalApi.listServices()
    await dentalApi.updateService('clinic-service-1', clinicPayload)
    await dentalApi.listMyServices()
    await dentalApi.updateMyService('clinic-service-1', doctorPayload)

    expect(http.get).toHaveBeenNthCalledWith(1, '/dental/services')
    expect(http.patch).toHaveBeenNthCalledWith(1, '/dental/services/clinic-service-1', clinicPayload)
    expect(http.get).toHaveBeenNthCalledWith(2, '/me/dental/services')
    expect(http.patch).toHaveBeenNthCalledWith(2, '/me/dental/services/clinic-service-1', doctorPayload)
  })

  it('encodes tooth history requests', async () => {
    const http = makeHttp()
    const { dentalApi } = await loadApi(http)

    await dentalApi.toothHistory('patient-1', '18 distal')

    expect(http.get).toHaveBeenCalledWith('/patients/patient-1/dental-history?tooth=18+distal')
  })
})
