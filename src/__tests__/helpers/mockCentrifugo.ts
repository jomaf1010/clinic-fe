/**
 * Mock for `@/composables/useCentrifugo`.
 *
 * Mirrors the real composable's public surface (connect / disconnect /
 * subscribe / unsubscribe / isConnected) without spinning up a real
 * WebSocket. Tests can fire inbound publications via `emit()` to
 * exercise event-handling logic in the consumers (useEncounterSync,
 * useDmRealtime, etc.).
 *
 * Usage:
 *   import { vi } from 'vitest'
 *   import { createMockCentrifugo } from '@/__tests__/helpers/mockCentrifugo'
 *
 *   const cf = createMockCentrifugo()
 *   vi.doMock('@/composables/useCentrifugo', () => ({ useCentrifugo: () => cf.api }))
 *
 *   // ...consumer subscribes to channel "encounter:abc"
 *   cf.emit('encounter:abc', { type: 'encounter.updated', data: { uuid: 'enc-1' } })
 *
 *   expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: { ... } }))
 */

import { ref } from 'vue'
import { vi } from 'vitest'

type PublicationHandler = (ctx: { channel: string; data: unknown }) => void

export interface MockCentrifugoApi {
  isConnected: { value: boolean }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
}

export interface MockCentrifugo {
  api: MockCentrifugoApi
  /** Trigger an inbound publication to all handlers on `channel`. */
  emit(channel: string, data: unknown): void
  /** Set the connection flag (most tests want it true). */
  setConnected(connected: boolean): void
  /** Return the channels currently subscribed by the consumer. */
  channels(): string[]
}

export function createMockCentrifugo(): MockCentrifugo {
  const isConnected = ref(true)
  const handlers = new Map<string, PublicationHandler[]>()

  const subscribe = vi.fn((channel: string, onPublication: PublicationHandler) => {
    const list = handlers.get(channel) ?? []
    list.push(onPublication)
    handlers.set(channel, list)
  })

  const unsubscribe = vi.fn((channel: string) => {
    handlers.delete(channel)
  })

  const connect = vi.fn(() => {
    isConnected.value = true
  })

  const disconnect = vi.fn(() => {
    isConnected.value = false
  })

  return {
    api: { isConnected, connect, disconnect, subscribe, unsubscribe },
    emit(channel, data) {
      const list = handlers.get(channel) ?? []
      for (const handler of list) handler({ channel, data })
    },
    setConnected(connected) {
      isConnected.value = connected
    },
    channels() {
      return Array.from(handlers.keys())
    },
  }
}
