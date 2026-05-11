/**
 * Tests for `usePatientSync`.
 *
 * Subscribes to `clinic:<clinic>:patient:<patient>` and routes inbound
 * events into either `patientUpdate` ref, the optional onPatientUpdated
 * callback, or the onTimelineUpdated callback. Self-echo is suppressed
 * via SESSION_ID matching.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMockCentrifugo } from '@/__tests__/helpers/mockCentrifugo'

const ourSessionId = 'session-mine'
const otherSessionId = 'session-other'

const cf = createMockCentrifugo()

beforeEach(() => {
  vi.resetModules()
  cf.reset()

  vi.doMock('@/composables/useCentrifugo', () => ({
    useCentrifugo: () => cf.api,
  }))
  vi.doMock('@/lib/http', () => ({
    SESSION_ID: ourSessionId,
    http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    HttpError: class HttpError extends Error {},
  }))
})

afterEach(() => {
  vi.doUnmock('@/composables/useCentrifugo')
  vi.doUnmock('@/lib/http')
  vi.restoreAllMocks()
})

interface Hooks {
  onPatientUpdated?: ReturnType<typeof vi.fn>
  onTimelineUpdated?: ReturnType<typeof vi.fn>
}

async function mountSync(patientId: string | undefined, clinicId: string | undefined, hooks: Hooks = {}) {
  const { usePatientSync } = await import('./usePatientSync')
  let api: { patientUpdate: Ref<unknown> } | null = null
  const Comp = defineComponent({
    setup() {
      api = usePatientSync(ref(patientId), ref(clinicId), hooks.onPatientUpdated, hooks.onTimelineUpdated)
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { api: api!, wrapper }
}

describe('usePatientSync — channel lifecycle', () => {
  it('subscribes to clinic:<clinic>:patient:<patient> on mount', async () => {
    await mountSync('p-1', 'clinic-1')
    expect(cf.api.subscribe).toHaveBeenCalledWith('clinic:clinic-1:patient:p-1', expect.any(Function))
  })

  it('does NOT subscribe when ids are missing', async () => {
    await mountSync(undefined, 'clinic-1')
    expect(cf.api.subscribe).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', async () => {
    const { wrapper } = await mountSync('p-1', 'clinic-1')
    wrapper.unmount()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:patient:p-1')
  })
})

describe('usePatientSync — patient.updated', () => {
  it('writes the inbound patient to patientUpdate ref and fires onPatientUpdated', async () => {
    const onPatientUpdated = vi.fn()
    const { api } = await mountSync('p-1', 'clinic-1', { onPatientUpdated })
    const data = { id: 'p-1', first_name: 'Alice', last_name: 'Tan' }
    cf.emit('clinic:clinic-1:patient:p-1', {
      type: 'patient.updated',
      session_id: otherSessionId,
      data,
    })
    expect(api.patientUpdate.value).toEqual(data)
    expect(onPatientUpdated).toHaveBeenCalledWith(data)
  })

  it('ignores self-emitted patient.updated events', async () => {
    const onPatientUpdated = vi.fn()
    const { api } = await mountSync('p-1', 'clinic-1', { onPatientUpdated })
    cf.emit('clinic:clinic-1:patient:p-1', {
      type: 'patient.updated',
      session_id: ourSessionId,
      data: { id: 'p-1' },
    })
    expect(api.patientUpdate.value).toBeNull()
    expect(onPatientUpdated).not.toHaveBeenCalled()
  })
})

describe('usePatientSync — patient.avatar_updated', () => {
  it('merges the new avatar_url into the existing patientUpdate', async () => {
    const { api } = await mountSync('p-1', 'clinic-1')
    cf.emit('clinic:clinic-1:patient:p-1', {
      type: 'patient.updated',
      session_id: otherSessionId,
      data: { id: 'p-1', avatar_url: 'old.png' },
    })
    cf.emit('clinic:clinic-1:patient:p-1', {
      type: 'patient.avatar_updated',
      session_id: otherSessionId,
      data: { avatar_url: 'new.png' },
    })
    expect((api.patientUpdate.value as { avatar_url: string }).avatar_url).toBe('new.png')
  })

  it('is a no-op when no patient has been received yet', async () => {
    const { api } = await mountSync('p-1', 'clinic-1')
    cf.emit('clinic:clinic-1:patient:p-1', {
      type: 'patient.avatar_updated',
      session_id: otherSessionId,
      data: { avatar_url: 'new.png' },
    })
    expect(api.patientUpdate.value).toBeNull()
  })
})

describe('usePatientSync — encounter.timeline_updated', () => {
  it('forwards the timeline payload to onTimelineUpdated', async () => {
    const onTimelineUpdated = vi.fn()
    await mountSync('p-1', 'clinic-1', { onTimelineUpdated })
    const data = { encounter_id: 'e-1', auto_display_line: 'Line', auto_display_summary: null, updated_at: 't' }
    cf.emit('clinic:clinic-1:patient:p-1', {
      type: 'encounter.timeline_updated',
      session_id: otherSessionId,
      data,
    })
    expect(onTimelineUpdated).toHaveBeenCalledWith(data)
  })
})
