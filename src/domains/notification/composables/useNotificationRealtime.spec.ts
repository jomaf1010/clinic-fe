/**
 * Tests for `useNotificationRealtime`.
 *
 * Subscribes to `clinic:<clinic>:notifications:<user>` and forwards
 * inbound publications to `notificationStore.handleRealtimeEvent`.
 * Re-subscribes on user/clinic change.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMockCentrifugo } from '@/__tests__/helpers/mockCentrifugo'

const cf = createMockCentrifugo()
const notificationHandle = vi.fn()
const currentClinic = ref<{ id: string } | null>(null)
const user = ref<{ id: string } | null>(null)
const wrappers: VueWrapper[] = []

beforeEach(() => {
  vi.resetModules()
  cf.reset()
  notificationHandle.mockClear()
  currentClinic.value = { id: 'clinic-1' }
  user.value = { id: 'u-1' }

  vi.doMock('@/composables/useCentrifugo', () => ({
    useCentrifugo: () => cf.api,
  }))
  vi.doMock('@/domains/auth/stores/authStore', () => ({
    useAuthStore: () => ({
      get currentClinic() { return currentClinic.value },
      get user() { return user.value },
    }),
  }))
  vi.doMock('../stores/notificationStore', () => ({
    useNotificationStore: () => ({ handleRealtimeEvent: notificationHandle }),
  }))
})

afterEach(() => {
  for (const w of wrappers) {
    if (w.exists()) w.unmount()
  }
  wrappers.length = 0
  vi.doUnmock('@/composables/useCentrifugo')
  vi.doUnmock('@/domains/auth/stores/authStore')
  vi.doUnmock('../stores/notificationStore')
  vi.restoreAllMocks()
})

async function mountNotif() {
  const { useNotificationRealtime } = await import('./useNotificationRealtime')
  let api: { start: () => void; stop: () => void } | null = null
  const Comp = defineComponent({
    setup() {
      api = useNotificationRealtime()
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  wrappers.push(wrapper)
  return { api: api!, wrapper }
}

describe('useNotificationRealtime', () => {
  it('subscribes to the notifications channel after start()', async () => {
    const { api } = await mountNotif()
    api.start()
    expect(cf.api.subscribe).toHaveBeenCalledWith('clinic:clinic-1:notifications:u-1', expect.any(Function))
  })

  it('does not subscribe when user/clinic is missing', async () => {
    user.value = null
    const { api } = await mountNotif()
    api.start()
    expect(cf.api.subscribe).not.toHaveBeenCalled()
  })

  it('forwards publications to notificationStore.handleRealtimeEvent', async () => {
    const { api } = await mountNotif()
    api.start()
    cf.emit('clinic:clinic-1:notifications:u-1', { type: 'notification.created', data: { id: 'n-1' } })
    expect(notificationHandle).toHaveBeenCalledWith({ type: 'notification.created', data: { id: 'n-1' } })
  })

  it('re-subscribes when the clinic switches', async () => {
    const { api } = await mountNotif()
    api.start()
    currentClinic.value = { id: 'clinic-2' }
    await Promise.resolve()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:notifications:u-1')
    expect(cf.api.subscribe).toHaveBeenCalledWith('clinic:clinic-2:notifications:u-1', expect.any(Function))
  })

  it('stop() unsubscribes the current channel', async () => {
    const { api } = await mountNotif()
    api.start()
    api.stop()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:notifications:u-1')
  })

  it('unsubscribes on component unmount', async () => {
    const { api, wrapper } = await mountNotif()
    api.start()
    wrapper.unmount()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:notifications:u-1')
  })
})
