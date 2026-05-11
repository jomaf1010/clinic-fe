/**
 * Tests for `useEncounterSync`.
 *
 * Mocks `@/composables/useCentrifugo` (channel subscription wrapper),
 * the encounter store (`handleRealtimeEvent`), `@/lib/http` for the
 * stable SESSION_ID, and `encounterApi.get` for the lab-order silent
 * refresh. Drives the composable inside a tiny test component so
 * `onUnmounted` actually fires when we call `wrapper.unmount()`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMockCentrifugo } from '@/__tests__/helpers/mockCentrifugo'

const ourSessionId = 'session-mine'
const otherSessionId = 'session-other'

const cf = createMockCentrifugo()
const handleRealtimeEvent = vi.fn()
const encounterApiGet = vi.fn()

beforeEach(() => {
  vi.resetModules()
  cf.reset()
  handleRealtimeEvent.mockClear()
  encounterApiGet.mockReset()

  vi.doMock('@/composables/useCentrifugo', () => ({
    useCentrifugo: () => cf.api,
  }))
  vi.doMock('@/lib/http', () => ({
    SESSION_ID: ourSessionId,
    http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    HttpError: class HttpError extends Error {},
  }))
  vi.doMock('../api/encounterApi', () => ({
    encounterApi: { get: encounterApiGet },
  }))
  vi.doMock('../stores/encounterStore', () => ({
    useEncounterStore: () => ({
      handleRealtimeEvent,
      current: { id: 'enc-1' },
    }),
  }))
})

afterEach(() => {
  vi.doUnmock('@/composables/useCentrifugo')
  vi.doUnmock('@/lib/http')
  vi.doUnmock('../api/encounterApi')
  vi.doUnmock('../stores/encounterStore')
  vi.restoreAllMocks()
})

interface SyncApi {
  prescriptionUpdate: Ref<unknown>
  labOrderUpdate: Ref<unknown>
  documentUpdate: Ref<unknown>
}

async function mountSync(encounterId: string | undefined, clinicId: string | undefined) {
  const { useEncounterSync } = await import('./useEncounterSync')
  let api: SyncApi | null = null
  const Comp = defineComponent({
    setup() {
      api = useEncounterSync(ref(encounterId), ref(clinicId))
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { api: api!, wrapper }
}

describe('useEncounterSync — channel lifecycle', () => {
  it('subscribes to clinic:<clinic>:encounter:<encounter> on mount', async () => {
    await mountSync('enc-1', 'clinic-1')
    expect(cf.api.connect).toHaveBeenCalled()
    expect(cf.api.subscribe).toHaveBeenCalledWith('clinic:clinic-1:encounter:enc-1', expect.any(Function))
  })

  it('does NOT subscribe when encounter or clinic id is missing', async () => {
    await mountSync(undefined, 'clinic-1')
    expect(cf.api.subscribe).not.toHaveBeenCalled()
  })

  it('unsubscribes on component unmount', async () => {
    const { wrapper } = await mountSync('enc-1', 'clinic-1')
    wrapper.unmount()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:encounter:enc-1')
  })
})

describe('useEncounterSync — encounter events', () => {
  it('forwards encounter.* events to the store', async () => {
    await mountSync('enc-1', 'clinic-1')
    cf.emit('clinic:clinic-1:encounter:enc-1', {
      type: 'encounter.updated',
      session_id: otherSessionId,
      data: { sections: ['triage'], updated_at: 't' },
    })
    expect(handleRealtimeEvent).toHaveBeenCalledOnce()
  })

  it('ignores encounter events emitted by our own session', async () => {
    await mountSync('enc-1', 'clinic-1')
    cf.emit('clinic:clinic-1:encounter:enc-1', {
      type: 'encounter.updated',
      session_id: ourSessionId,
      data: { sections: ['triage'], updated_at: 't' },
    })
    expect(handleRealtimeEvent).not.toHaveBeenCalled()
  })
})

describe('useEncounterSync — prescription / lab_order / document branches', () => {
  it('exposes prescriptionUpdate when a foreign prescription event arrives', async () => {
    const { api } = await mountSync('enc-1', 'clinic-1')
    cf.emit('clinic:clinic-1:encounter:enc-1', {
      type: 'prescription.item_added',
      session_id: otherSessionId,
      data: { id: 'rx-1', items: [] },
    })
    expect(api.prescriptionUpdate.value).toEqual({ id: 'rx-1', items: [] })
  })

  it('does not expose prescriptionUpdate for self-emitted events', async () => {
    const { api } = await mountSync('enc-1', 'clinic-1')
    cf.emit('clinic:clinic-1:encounter:enc-1', {
      type: 'prescription.item_added',
      session_id: ourSessionId,
      data: { id: 'rx-1', items: [] },
    })
    expect(api.prescriptionUpdate.value).toBeNull()
  })

  it('exposes labOrderUpdate AND silently refreshes the encounter on foreign lab_order events', async () => {
    encounterApiGet.mockResolvedValueOnce({ data: { id: 'enc-1', refreshed: true } })
    const { api } = await mountSync('enc-1', 'clinic-1')
    cf.emit('clinic:clinic-1:encounter:enc-1', {
      type: 'lab_order.result_uploaded',
      session_id: otherSessionId,
      data: { id: 'lab-1', items: [] },
    })
    expect(api.labOrderUpdate.value).toEqual({ id: 'lab-1', items: [] })
    expect(encounterApiGet).toHaveBeenCalledWith('enc-1')
  })

  it('exposes documentUpdate even for self-emitted events (no echo guard)', async () => {
    const { api } = await mountSync('enc-1', 'clinic-1')
    cf.emit('clinic:clinic-1:encounter:enc-1', {
      type: 'document.created',
      session_id: ourSessionId,
      data: { id: 'doc-1', type: 'prescription', status: 'pending', download_url: null },
    })
    expect(api.documentUpdate.value).toEqual(expect.objectContaining({ id: 'doc-1', type: 'prescription' }))
  })
})
