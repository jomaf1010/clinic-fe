import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  upload: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: { id: 'clinic-1' } }),
    post: vi.fn().mockResolvedValue({ data: { id: 'clinic-1' }, meta: { access_token: 'token', token_type: 'Bearer' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'clinic-1' } }),
    upload: vi.fn().mockResolvedValue({ data: { logo_url: 'https://example.test/logo.png' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./clinicApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('clinicApi', () => {
  it('delegates create, show, and update requests', async () => {
    const http = makeHttp()
    const { clinicApi } = await loadApi(http)
    const createPayload = { clinic_name: 'MediFlow Clinic', email: 'hello@example.test' }
    const updatePayload = { clinic_name: 'MediFlow Plus', contact_number: '09171234567' }

    await clinicApi.create(createPayload)
    await clinicApi.show()
    await clinicApi.update(updatePayload)

    expect(http.post).toHaveBeenCalledWith('/clinics', createPayload)
    expect(http.get).toHaveBeenCalledWith('/clinic/profile')
    expect(http.patch).toHaveBeenCalledWith('/clinic/profile', updatePayload)
  })

  it('uploads the clinic logo as form data', async () => {
    const http = makeHttp()
    const { clinicApi } = await loadApi(http)
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })

    await clinicApi.uploadLogo(file)

    expect(http.upload).toHaveBeenCalledWith('/clinic/logo', expect.any(FormData))
    const formData = http.upload.mock.calls[0][1] as FormData
    expect(formData.get('logo')).toBe(file)
  })
})
