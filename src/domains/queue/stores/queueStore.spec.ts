import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateWalkInPayload, QueueVisitResponse } from '../types/queue.types'

interface MockQueueApi {
  list: ReturnType<typeof vi.fn>
  walkIn: ReturnType<typeof vi.fn>
  call: ReturnType<typeof vi.fn>
  complete: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
}

function makeVisit(overrides: Partial<QueueVisitResponse> = {}): QueueVisitResponse {
  return {
    id: 'visit-1',
    clinic_id: 'clinic-1',
    patient_id: 'patient-1',
    patient_name: 'Juan Dela Cruz',
    patient_sex: 'male',
    patient_avatar_url: null,
    doctor_id: 'doctor-1',
    doctor_name: 'Maria Santos',
    appointment_id: null,
    encounter_id: null,
    status: 'waiting',
    type: 'walk_in',
    priority: 0,
    position: 1,
    reason: 'Consultation',
    checked_in_at: '2026-05-06T01:00:00.000Z',
    called_at: null,
    completed_at: null,
    notes: null,
    created_at: '2026-05-06T01:00:00.000Z',
    updated_at: '2026-05-06T01:00:00.000Z',
    ...overrides,
  }
}

function makeQueueApi(overrides: Partial<MockQueueApi> = {}): MockQueueApi {
  return {
    list: vi.fn().mockResolvedValue({ data: [makeVisit()] }),
    walkIn: vi.fn().mockResolvedValue({ data: makeVisit({ id: 'walk-in-1' }) }),
    call: vi.fn().mockResolvedValue({ data: makeVisit({ status: 'in_progress' }) }),
    complete: vi.fn().mockResolvedValue({ data: makeVisit({ status: 'completed' }) }),
    cancel: vi.fn().mockResolvedValue({ data: makeVisit({ status: 'cancelled' }) }),
    ...overrides,
  }
}

async function loadStore(queueApi: MockQueueApi) {
  vi.doMock('../api/queueApi', () => ({ queueApi }))
  return await import('./queueStore')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('../api/queueApi')
  vi.useRealTimers()
})

describe('queueStore - fetching and mutations', () => {
  it('fetchQueue stores visits and remembers filters', async () => {
    const queueApi = makeQueueApi({
      list: vi.fn().mockResolvedValue({ data: [makeVisit({ id: 'visit-filtered' })] }),
    })
    const { useQueueStore } = await loadStore(queueApi)
    const store = useQueueStore()

    await store.fetchQueue({ doctor_id: 'doctor-1', status: 'waiting' })
    await store.fetchQueue()

    expect(queueApi.list).toHaveBeenNthCalledWith(1, { doctor_id: 'doctor-1', status: 'waiting' })
    expect(queueApi.list).toHaveBeenNthCalledWith(2, { doctor_id: 'doctor-1', status: 'waiting' })
    expect(store.visits[0]?.id).toBe('visit-filtered')
    expect(store.isLoading).toBe(false)
  })

  it('clears isLoading when fetchQueue fails', async () => {
    const queueApi = makeQueueApi({
      list: vi.fn().mockRejectedValue(new Error('network down')),
    })
    const { useQueueStore } = await loadStore(queueApi)
    const store = useQueueStore()

    await expect(store.fetchQueue()).rejects.toThrow('network down')

    expect(store.isLoading).toBe(false)
  })

  it('createWalkIn posts the payload, refreshes queue, and clears creating state', async () => {
    const queueApi = makeQueueApi()
    const { useQueueStore } = await loadStore(queueApi)
    const store = useQueueStore()
    const payload: CreateWalkInPayload = {
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
      reason: 'Fever',
      notes: 'First visit',
    }

    const result = await store.createWalkIn(payload)

    expect(queueApi.walkIn).toHaveBeenCalledWith(payload)
    expect(queueApi.list).toHaveBeenCalledOnce()
    expect(result.id).toBe('walk-in-1')
    expect(store.isCreating).toBe(false)
  })

  it('callPatient, completeVisit, and cancelVisit refresh queue after action', async () => {
    const queueApi = makeQueueApi()
    const { useQueueStore } = await loadStore(queueApi)
    const store = useQueueStore()

    await store.callPatient('visit-1')
    await store.completeVisit('visit-1')
    await store.cancelVisit('visit-1')

    expect(queueApi.call).toHaveBeenCalledWith('visit-1')
    expect(queueApi.complete).toHaveBeenCalledWith('visit-1')
    expect(queueApi.cancel).toHaveBeenCalledWith('visit-1')
    expect(queueApi.list).toHaveBeenCalledTimes(3)
  })
})

describe('queueStore - polling and realtime', () => {
  it('polls with the active filters and can stop polling', async () => {
    vi.useFakeTimers()
    const queueApi = makeQueueApi()
    const { useQueueStore } = await loadStore(queueApi)
    const store = useQueueStore()

    store.startPolling(1000, { status: 'waiting' })
    await vi.advanceTimersByTimeAsync(1000)
    store.stopPolling()
    await vi.advanceTimersByTimeAsync(1000)

    expect(queueApi.list).toHaveBeenCalledOnce()
    expect(queueApi.list).toHaveBeenCalledWith({ status: 'waiting' })
  })

  it('adds or replaces visits from realtime events', async () => {
    const queueApi = makeQueueApi()
    const { useQueueStore } = await loadStore(queueApi)
    const store = useQueueStore()

    store.handleRealtimeEvent({ type: 'queue.visit.created', data: makeVisit({ id: 'visit-1' }) })
    store.handleRealtimeEvent({ type: 'queue.visit.created', data: makeVisit({ id: 'visit-1', position: 2 }) })
    store.handleRealtimeEvent({ type: 'queue.visit.called', data: makeVisit({ id: 'visit-2', status: 'in_progress' }) })

    expect(store.visits).toHaveLength(2)
    expect(store.visits[0]?.position).toBe(2)
    expect(store.visits[1]?.status).toBe('in_progress')
  })
})
