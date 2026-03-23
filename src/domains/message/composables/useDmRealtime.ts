import { computed, onUnmounted, watch } from 'vue'
import type { PublicationContext } from 'centrifuge'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useMessageStore } from '../stores/messageStore'
import type { DmRealtimeEvent } from '../types/message.types'

export function useDmRealtime() {
  const { connect, subscribe, unsubscribe } = useCentrifugo()
  const authStore = useAuthStore()
  const messageStore = useMessageStore()

  const channel = computed(() => {
    const clinicId = authStore.currentClinic?.id
    const userId = authStore.user?.id
    if (!clinicId || !userId) return null
    return `clinic:${clinicId}:dm:${userId}`
  })

  function onEvent(ctx: PublicationContext) {
    const event = ctx.data as DmRealtimeEvent
    messageStore.handleRealtimeEvent(event)
  }

  let stopWatcher: (() => void) | null = null

  function start(): void {
    // Subscribe immediately if channel is ready
    if (channel.value) {
      connect()
      subscribe(channel.value, onEvent)
    }

    // Watch for channel changes (user loaded later, clinic switch)
    if (!stopWatcher) {
      const { stop: unwatch } = watch(channel, (newCh, oldCh) => {
        if (oldCh) unsubscribe(oldCh)
        if (newCh) {
          connect()
          subscribe(newCh, onEvent)
        }
      })
      stopWatcher = unwatch
    }
  }

  function stop(): void {
    if (channel.value) {
      unsubscribe(channel.value)
    }
    stopWatcher?.()
    stopWatcher = null
  }

  onUnmounted(() => {
    stop()
  })

  return { start, stop }
}
