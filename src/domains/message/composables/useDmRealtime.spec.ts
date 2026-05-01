/**
 * Tests for `useDmRealtime`.
 *
 * Subscribes to `clinic:<clinic>:dm:<user>` once `start()` is called,
 * forwards inbound publications to `messageStore.handleRealtimeEvent`,
 * and re-subscribes when the user/clinic changes (logout → login,
 * clinic switch).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMockCentrifugo } from '@/__tests__/helpers/mockCentrifugo'

const cf = createMockCentrifugo()
const messageHandle = vi.fn()
const currentClinic = ref<{ id: string } | null>(null)
const user = ref<{ id: string } | null>(null)
const wrappers: VueWrapper[] = []

beforeEach(() => {
  vi.resetModules()
  cf.reset()
  messageHandle.mockClear()
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
  vi.doMock('../stores/messageStore', () => ({
    useMessageStore: () => ({ handleRealtimeEvent: messageHandle }),
  }))
})

afterEach(() => {
  for (const w of wrappers) {
    if (w.exists()) w.unmount()
  }
  wrappers.length = 0
  vi.doUnmock('@/composables/useCentrifugo')
  vi.doUnmock('@/domains/auth/stores/authStore')
  vi.doUnmock('../stores/messageStore')
  vi.restoreAllMocks()
})

async function mountDm() {
  const { useDmRealtime } = await import('./useDmRealtime')
  let api: { start: () => void; stop: () => void } | null = null
  const Comp = defineComponent({
    setup() {
      api = useDmRealtime()
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  wrappers.push(wrapper)
  return { api: api!, wrapper }
}

describe('useDmRealtime', () => {
  it('subscribes to the DM channel after start()', async () => {
    const { api } = await mountDm()
    api.start()
    expect(cf.api.subscribe).toHaveBeenCalledWith('clinic:clinic-1:dm:u-1', expect.any(Function))
  })

  it('does not subscribe when user is not logged in', async () => {
    user.value = null
    const { api } = await mountDm()
    api.start()
    expect(cf.api.subscribe).not.toHaveBeenCalled()
  })

  it('forwards inbound publications to messageStore.handleRealtimeEvent', async () => {
    const { api } = await mountDm()
    api.start()
    cf.emit('clinic:clinic-1:dm:u-1', { type: 'message.created', data: { id: 'm-1' } })
    expect(messageHandle).toHaveBeenCalledWith({ type: 'message.created', data: { id: 'm-1' } })
  })

  it('re-subscribes after a clinic switch', async () => {
    const { api } = await mountDm()
    api.start()
    expect(cf.api.subscribe).toHaveBeenCalledWith('clinic:clinic-1:dm:u-1', expect.any(Function))

    currentClinic.value = { id: 'clinic-2' }
    await Promise.resolve()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:dm:u-1')
    expect(cf.api.subscribe).toHaveBeenCalledWith('clinic:clinic-2:dm:u-1', expect.any(Function))
  })

  it('stop() unsubscribes and prevents future re-subscription on watcher fire', async () => {
    const { api } = await mountDm()
    api.start()
    api.stop()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:dm:u-1')

    cf.api.subscribe.mockClear()
    currentClinic.value = { id: 'clinic-2' }
    await Promise.resolve()
    expect(cf.api.subscribe).not.toHaveBeenCalled()
  })

  it('unsubscribes on component unmount', async () => {
    const { api, wrapper } = await mountDm()
    api.start()
    wrapper.unmount()
    expect(cf.api.unsubscribe).toHaveBeenCalledWith('clinic:clinic-1:dm:u-1')
  })
})

