/**
 * Tests for the encounter Pinia store.
 *
 * Coverage focus per Phase 3 plan:
 *   - createForPatient → caches encounter, sets current.
 *   - loadEncounter happy path + offline-cache fallback on network error.
 *   - loadForPatient request-id race protection (later request wins).
 *   - saveSection optimistic update + offline queueing path.
 *   - finalize blocks while offline.
 *   - handleRealtimeEvent: encounter.updated + encounter.finalized
 *     reconcile current state.
 *   - clearCurrent / clearPatientEncounters reset state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EncounterResponse } from '../types/encounter.types'
import type { EncounterRealtimeEvent } from '../types/realtime.types'

interface MockEncounterApi {
  create: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  finalize: ReturnType<typeof vi.fn>
  generateSoapDraft: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeEncounter(overrides: Partial<EncounterResponse> = {}): EncounterResponse {
  // Cast to satisfy the discriminated union — only the fields the store
  // touches matter here.
  return {
    id: 'enc-1',
    clinic_id: 'c1',
    patient_id: 'p1',
    doctor_id: 'u1',
    type: 'consultation',
    status: 'draft',
    visit_at: '2026-04-30T00:00:00Z',
    finalized_at: null,
    consultation: {
      id: 'cons-1',
      type: 'default',
      triage: {} as never,
      bmi: null,
      assessment: {} as never,
      treatment_plan: {} as never,
    },
    created_at: '2026-04-30T00:00:00Z',
    updated_at: '2026-04-30T00:00:00Z',
    ...overrides,
  } as unknown as EncounterResponse
}

function makeApi(overrides: Partial<MockEncounterApi> = {}): MockEncounterApi {
  return {
    create: vi.fn().mockResolvedValue({ data: makeEncounter() }),
    list: vi.fn().mockResolvedValue({
      data: [],
      meta: { pagination: { page: 1, per_page: 10, total: 0, last_page: 1 } },
    }),
    get: vi.fn().mockResolvedValue({ data: makeEncounter() }),
    update: vi.fn().mockResolvedValue({ data: makeEncounter() }),
    finalize: vi.fn().mockResolvedValue({ data: makeEncounter({ status: 'finalized' }) }),
    generateSoapDraft: vi.fn().mockResolvedValue({ data: { soap_note: { subjective: '', objective: '', assessment: '', plan: '' } } }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const cacheEncounterMock = vi.fn()
const getCachedEncounterMock = vi.fn()
const queueActionMock = vi.fn()

async function loadStore(api: MockEncounterApi) {
  vi.doMock('../api/encounterApi', () => ({ encounterApi: api }))
  vi.doMock('@/lib/offlineDb', () => ({
    cacheEncounter: cacheEncounterMock,
    getCachedEncounter: getCachedEncounterMock,
    queueAction: queueActionMock,
  }))
  vi.doMock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
  vi.doMock('@/domains/auth/stores/authStore', () => ({
    useAuthStore: () => ({ user: { specialty: 'family_medicine' } }),
  }))
  return await import('./encounterStore')
}

beforeEach(() => {
  vi.resetModules()
  cacheEncounterMock.mockReset().mockResolvedValue(undefined)
  getCachedEncounterMock.mockReset().mockResolvedValue(undefined)
  queueActionMock.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.doUnmock('../api/encounterApi')
  vi.doUnmock('@/lib/offlineDb')
  vi.doUnmock('vue-sonner')
  vi.doUnmock('@/domains/auth/stores/authStore')
})

describe('encounterStore — createForPatient', () => {
  it('creates an encounter and caches it locally', async () => {
    const api = makeApi({
      create: vi.fn().mockResolvedValue({ data: makeEncounter({ id: 'enc-NEW' }) }),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()

    const result = await store.createForPatient('p1', 'default')

    expect(result.id).toBe('enc-NEW')
    expect(store.current?.id).toBe('enc-NEW')
    expect(cacheEncounterMock).toHaveBeenCalled()
    expect(api.create).toHaveBeenCalledWith('p1', expect.objectContaining({
      patient_id: 'p1',
      type: 'consultation',
      consultation_type: 'default',
      specialty: 'family_medicine',
    }))
  })
})

describe('encounterStore — loadEncounter', () => {
  it('hits API and caches result on success', async () => {
    const api = makeApi({
      get: vi.fn().mockResolvedValue({ data: makeEncounter({ id: 'enc-77' }) }),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()

    await store.loadEncounter('enc-77')

    expect(store.current?.id).toBe('enc-77')
    expect(store.isOfflineCached).toBe(false)
    expect(cacheEncounterMock).toHaveBeenCalled()
  })

  it('falls back to offline cache when the API throws a non-403/404 error', async () => {
    getCachedEncounterMock.mockResolvedValueOnce({
      id: 'enc-77',
      type: 'consultation',
      status: 'draft',
    })
    const api = makeApi({
      get: vi.fn().mockRejectedValue(new Error('network down')),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()

    await store.loadEncounter('enc-77')

    expect(store.current?.id).toBe('enc-77')
    expect(store.isOfflineCached).toBe(true)
  })
})

describe('encounterStore — loadForPatient request-id race', () => {
  it('drops a stale earlier response when a later request arrives first', async () => {
    let releaseFirst!: (value: unknown) => void
    const firstResp = new Promise((resolve) => {
      releaseFirst = resolve
    })

    const api = makeApi({
      list: vi.fn()
        // First call returns the slow stale response.
        .mockReturnValueOnce(firstResp)
        // Second call returns immediately.
        .mockResolvedValueOnce({
          data: [{ id: 'enc-LATER', type: 'consultation', status: 'draft', visit_at: '2026-04-30T00:00:00Z' }],
          meta: { pagination: { page: 1, per_page: 10, total: 1, last_page: 1 } },
        }),
    })

    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()

    const slow = store.loadForPatient('p1')
    const fast = store.loadForPatient('p1', { month: 5 })
    await fast

    // Now resolve the slow one — its requestId is stale, so it should NOT
    // overwrite the patientEncounters.
    releaseFirst({
      data: [{ id: 'enc-EARLIER', type: 'consultation', status: 'draft', visit_at: '2026-04-30T00:00:00Z' }],
      meta: { pagination: { page: 1, per_page: 10, total: 1, last_page: 1 } },
    })
    await slow

    expect(store.patientEncounters).toHaveLength(1)
    expect(store.patientEncounters[0]?.id).toBe('enc-LATER')
  })
})

describe('encounterStore — saveSection offline queueing', () => {
  it('passes the current encounter timestamp as optimistic-lock token when saving', async () => {
    const api = makeApi({
      update: vi.fn().mockResolvedValue({ data: makeEncounter({ updated_at: '2026-04-30T01:00:00Z' }) }),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter({ updated_at: '2026-04-30T00:00:00Z' })

    const payload = { assessment: { chief_complaint: 'Headache' } as never }
    await store.saveSection(payload)

    expect(api.update).toHaveBeenCalledWith('enc-1', payload, '2026-04-30T00:00:00Z')
    expect(store.current?.updated_at).toBe('2026-04-30T01:00:00Z')
  })

  it('queues a pending action when navigator is offline and update fails', async () => {
    const api = makeApi({
      update: vi.fn().mockRejectedValue(new Error('offline')),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter()

    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    await store.saveSection({ assessment: { chief_complaint: 'Headache' } as never })

    expect(queueActionMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'update-encounter',
      method: 'PATCH',
      url: '/encounters/enc-1',
      headers: { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
    }))
    expect(store.isOfflineCached).toBe(true)
    expect(store.saveError).toBeNull()
  })

  it('surfaces a generic error when update fails while online', async () => {
    const api = makeApi({
      update: vi.fn().mockRejectedValue(new Error('500')),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter()

    // navigator.onLine is true (from setup) — fall through to error branch
    await store.saveSection({ assessment: { chief_complaint: 'Headache' } as never })

    expect(queueActionMock).not.toHaveBeenCalled()
    expect(store.saveError).toBe('Failed to save. Please try again.')
  })

  it('rolls back optimistic encounter changes and cache writes when an online update is rejected', async () => {
    const original = makeEncounter({
      consultation: {
        id: 'cons-1',
        type: 'default',
        triage: {} as never,
        bmi: null,
        assessment: { chief_complaint: 'Original complaint' } as never,
        treatment_plan: {} as never,
      },
    })
    const api = makeApi({
      update: vi.fn().mockRejectedValue(new Error('validation failed')),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = original

    await store.saveSection({ assessment: { chief_complaint: 'Rejected complaint' } as never })

    expect(store.current?.consultation?.assessment).toEqual({ chief_complaint: 'Original complaint' })
    expect(cacheEncounterMock).not.toHaveBeenCalledWith(expect.objectContaining({
      consultation: expect.objectContaining({
        assessment: expect.objectContaining({ chief_complaint: 'Rejected complaint' }),
      }),
    }))
    expect(queueActionMock).not.toHaveBeenCalled()
    expect(store.saveError).toBe('Failed to save. Please try again.')
  })
})

describe('encounterStore — finalize', () => {
  it('refuses to finalize while offline', async () => {
    const api = makeApi()
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter()
    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    await store.finalize()

    expect(api.finalize).not.toHaveBeenCalled()
    expect(store.saveError).toBe('Cannot finalize while offline.')
  })

  it('updates current with finalized data on success', async () => {
    const api = makeApi({
      finalize: vi.fn().mockResolvedValue({ data: makeEncounter({ status: 'finalized', finalized_at: '2026-04-30T11:00:00Z' }) }),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter()

    await store.finalize()

    expect(store.isFinalized).toBe(true)
    expect(store.isDraft).toBe(false)
  })
})

describe('encounterStore — handleRealtimeEvent', () => {
  it('ignores events for a different encounter id', async () => {
    const api = makeApi()
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter({ id: 'enc-MINE' })

    const event: EncounterRealtimeEvent = {
      type: 'encounter.updated',
      actor_id: 'other',
      encounter_id: 'enc-OTHER',
      timestamp: '2026-04-30T00:00:00Z',
      data: { sections: ['assessment'], updated_at: '2026-04-30T00:00:00Z' },
    }
    store.handleRealtimeEvent(event)
    // current.assessment still the original — no merge happened
    expect(store.current?.id).toBe('enc-MINE')
  })

  it('marks finalized on encounter.finalized', async () => {
    const api = makeApi()
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter({ id: 'enc-1', status: 'draft' })

    store.handleRealtimeEvent({
      type: 'encounter.finalized',
      actor_id: 'other',
      encounter_id: 'enc-1',
      timestamp: '2026-04-30T11:00:00Z',
      data: {
        status: 'finalized',
        finalized_at: '2026-04-30T11:00:00Z',
        updated_at: '2026-04-30T11:00:00Z',
      },
    })

    expect(store.current?.status).toBe('finalized')
    expect(store.isFinalized).toBe(true)
  })
})

describe('encounterStore — clearCurrent + clearPatientEncounters', () => {
  it('clearCurrent resets current and offline flag', async () => {
    const api = makeApi()
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    store.current = makeEncounter()
    store.isOfflineCached = true
    store.saveError = 'old error'

    store.clearCurrent()

    expect(store.current).toBeNull()
    expect(store.isOfflineCached).toBe(false)
    expect(store.saveError).toBeNull()
  })

  it('clearPatientEncounters resets list state and bumps requestId', async () => {
    const api = makeApi({
      list: vi.fn().mockResolvedValue({
        data: [{ id: 'enc-1', type: 'consultation', status: 'draft', visit_at: '2026-04-30T00:00:00Z' }],
        meta: { pagination: { page: 1, per_page: 10, total: 5, last_page: 3 } },
      }),
    })
    const { useEncounterStore } = await loadStore(api)
    const store = useEncounterStore()
    await store.loadForPatient('p1')
    expect(store.patientEncounters).toHaveLength(1)

    store.clearPatientEncounters()

    expect(store.patientEncounters).toEqual([])
    expect(store.hasMore).toBe(false)
  })
})
