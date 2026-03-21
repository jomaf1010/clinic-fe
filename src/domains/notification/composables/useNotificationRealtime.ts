import { computed, onUnmounted, watch } from 'vue'
import type { PublicationContext } from 'centrifuge'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useNotificationStore } from '../stores/notificationStore'
import type { NotificationRealtimeEvent } from '../types/notification.types'

export function useNotificationRealtime() {
  const { connect, subscribe, unsubscribe } = useCentrifugo()
  const authStore = useAuthStore()
  const notificationStore = useNotificationStore()

  const channel = computed(() => {
    const clinicId = authStore.currentClinic?.id
    const userId = authStore.user?.id
    if (!clinicId || !userId) return null
    return `clinic:${clinicId}:notifications:${userId}`
  })

  function onEvent(ctx: PublicationContext) {
    const event = ctx.data as NotificationRealtimeEvent
    notificationStore.handleRealtimeEvent(event)
  }

  function start(): void {
    if (channel.value) {
      connect()
      subscribe(channel.value, onEvent)
    }
  }

  function stop(): void {
    if (channel.value) {
      unsubscribe(channel.value)
    }
  }

  watch(channel, (newCh, oldCh) => {
    if (oldCh) unsubscribe(oldCh)
    if (newCh) {
      connect()
      subscribe(newCh, onEvent)
    }
  })

  onUnmounted(() => {
    stop()
  })

  return { start, stop }
}
