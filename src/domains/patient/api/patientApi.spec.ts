import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upload: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { uuid: 'patient-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { uuid: 'patient-1' } }),
    put: vi.fn().mockResolvedValue({ data: { uuid: 'patient-1' } }),
    delete: vi.fn().mockResolvedValue(undefined),
    upload: vi.fn().mockResolvedValue({ data: { avatar_url: '/avatars/patient-1.png' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./patientApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('patientApi', () => {
  it('creates, loads, and updates patients', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const createPayload = { first_name: 'Ana', last_name: 'Santos' }
    const updatePayload = { first_name: 'Anna' }

    await patientApi.create(createPayload)
    await patientApi.get('patient-1')
    await patientApi.update('patient-1', updatePayload)

    expect(http.post).toHaveBeenCalledWith('/patients', createPayload)
    expect(http.get).toHaveBeenCalledWith('/patients/patient-1')
    expect(http.patch).toHaveBeenCalledWith('/patients/patient-1', updatePayload)
  })

  it('builds patient list requests with defaults and filters', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)

    await patientApi.list()
    await patientApi.list(2, 25, {
      status: 'active',
      sex: 'female',
      search: 'Ana Santos',
      sort_by: 'last_name',
      sort_dir: 'desc',
    })

    expect(http.get).toHaveBeenNthCalledWith(1, '/patients?page=1&per_page=15')
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/patients?page=2&per_page=25&status=active&sex=female&search=Ana+Santos&sort_by=last_name&sort_dir=desc',
    )
  })

  it('loads attention summaries with default and custom limits', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)

    await patientApi.attentionSummary()
    await patientApi.attentionSummary(12)

    expect(http.get).toHaveBeenNthCalledWith(1, '/patients/attention-summary?limit=6')
    expect(http.get).toHaveBeenNthCalledWith(2, '/patients/attention-summary?limit=12')
  })

  it('encodes allergy and patient search terms', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)

    await patientApi.searchAllergies('penicillin + nuts')
    await patientApi.search('Ana Santos + Jr')

    expect(http.get).toHaveBeenNthCalledWith(1, '/allergies/search?q=penicillin%20%2B%20nuts')
    expect(http.get).toHaveBeenNthCalledWith(2, '/patients/search?q=Ana%20Santos%20%2B%20Jr')
  })

  it('uploads patient avatars as form data', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

    await patientApi.uploadAvatar('patient-1', file)

    expect(http.upload).toHaveBeenCalledWith('/patients/patient-1/avatar', expect.any(FormData))
    const formData = http.upload.mock.calls[0][1] as FormData
    expect(formData.get('avatar')).toBe(file)
  })

  it('delegates problem list and mutations', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const createPayload = { description: 'Hypertension' }
    const updatePayload = { status: 'resolved' }

    await patientApi.getProblems('patient-1')
    await patientApi.addProblem('patient-1', createPayload)
    await patientApi.updateProblem('problem-1', updatePayload)
    await patientApi.deleteProblem('problem-1')

    expect(http.get).toHaveBeenCalledWith('/patients/patient-1/problems')
    expect(http.post).toHaveBeenCalledWith('/patients/patient-1/problems', createPayload)
    expect(http.patch).toHaveBeenCalledWith('/problems/problem-1', updatePayload)
    expect(http.delete).toHaveBeenCalledWith('/problems/problem-1')
  })

  it('loads chronic trends and updates lifestyle records', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const payload = { smoking: 'never', alcohol: 'occasionally' }

    await patientApi.getChronicTrends('patient-1')
    await patientApi.getLifestyle('patient-1')
    await patientApi.updateLifestyle('patient-1', payload)

    expect(http.get).toHaveBeenNthCalledWith(1, '/patients/patient-1/chronic-trends')
    expect(http.get).toHaveBeenNthCalledWith(2, '/patients/patient-1/lifestyle')
    expect(http.put).toHaveBeenCalledWith('/patients/patient-1/lifestyle', payload)
  })

  it('delegates family history requests', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const payload = { relative: 'mother', conditions: [], alive: true }

    await patientApi.getFamilyHistory('patient-1')
    await patientApi.addFamilyHistory('patient-1', payload)
    await patientApi.updateFamilyHistory('patient-1', 'family-1', payload)
    await patientApi.deleteFamilyHistory('patient-1', 'family-1')

    expect(http.get).toHaveBeenCalledWith('/patients/patient-1/family-history')
    expect(http.post).toHaveBeenCalledWith('/patients/patient-1/family-history', payload)
    expect(http.patch).toHaveBeenCalledWith('/patients/patient-1/family-history/family-1', payload)
    expect(http.delete).toHaveBeenCalledWith('/patients/patient-1/family-history/family-1')
  })

  it('delegates medication requests with optional status filtering', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const payload = { drug_name: 'Metformin', status: 'active' }

    await patientApi.getMedications('patient-1')
    await patientApi.getMedications('patient-1', 'active')
    await patientApi.addMedication('patient-1', payload)
    await patientApi.updateMedication('patient-1', 'med-1', payload)
    await patientApi.deleteMedication('patient-1', 'med-1')

    expect(http.get).toHaveBeenNthCalledWith(1, '/patients/patient-1/medications')
    expect(http.get).toHaveBeenNthCalledWith(2, '/patients/patient-1/medications?status=active')
    expect(http.post).toHaveBeenCalledWith('/patients/patient-1/medications', payload)
    expect(http.patch).toHaveBeenCalledWith('/patients/patient-1/medications/med-1', payload)
    expect(http.delete).toHaveBeenCalledWith('/patients/patient-1/medications/med-1')
  })

  it('delegates preventive care requests', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const payload = { screening_key: 'bp', status: 'completed' }

    await patientApi.getPreventiveCare('patient-1')
    await patientApi.storePreventiveCare('patient-1', payload)
    await patientApi.updatePreventiveCare('patient-1', 'care-1', payload)
    await patientApi.deletePreventiveCare('patient-1', 'care-1')

    expect(http.get).toHaveBeenCalledWith('/patients/patient-1/preventive-care')
    expect(http.post).toHaveBeenCalledWith('/patients/patient-1/preventive-care', payload)
    expect(http.patch).toHaveBeenCalledWith('/patients/patient-1/preventive-care/care-1', payload)
    expect(http.delete).toHaveBeenCalledWith('/patients/patient-1/preventive-care/care-1')
  })

  it('delegates structured allergy requests', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)
    const payload = { allergen: 'Penicillin', type: 'drug', severity: 'severe' }

    await patientApi.getAllergies('patient-1')
    await patientApi.addAllergy('patient-1', payload)
    await patientApi.updateAllergy('patient-1', 'allergy-1', payload)
    await patientApi.deleteAllergy('patient-1', 'allergy-1')

    expect(http.get).toHaveBeenCalledWith('/patients/patient-1/allergies')
    expect(http.post).toHaveBeenCalledWith('/patients/patient-1/allergies', payload)
    expect(http.patch).toHaveBeenCalledWith('/patients/patient-1/allergies/allergy-1', payload)
    expect(http.delete).toHaveBeenCalledWith('/patients/patient-1/allergies/allergy-1')
  })

  it('loads past diagnoses', async () => {
    const http = makeHttp()
    const { patientApi } = await loadApi(http)

    await patientApi.getPastDiagnoses('patient-1')

    expect(http.get).toHaveBeenCalledWith('/patients/patient-1/past-diagnoses')
  })
})
