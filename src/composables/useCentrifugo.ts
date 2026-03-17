import { ref } from 'vue'
import { Centrifuge } from 'centrifuge'
import type { Subscription, PublicationContext } from 'centrifuge'
import { centrifugoApi } from '@/api/centrifugoApi'

// Module-level singleton state
let client: Centrifuge | null = null
const isConnected = ref(false)
const subscriptions = new Map<string, Subscription>()

export function useCentrifugo() {
  function connect(): void {
    if (client) return

    const centrifugoUrl = import.meta.env.VITE_CENTRIFUGO_URL as string
    const wsUrl = centrifugoUrl.startsWith('wss://') || centrifugoUrl.startsWith('ws://')
      ? centrifugoUrl
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${centrifugoUrl}`

    client = new Centrifuge(wsUrl, {
      getToken: async () => {
        const response = await centrifugoApi.getConnectionToken()
        return response.token
      },
    })

    client.on('connected', () => {
      isConnected.value = true
    })

    client.on('disconnected', (ctx) => {
      console.warn('[Centrifugo] disconnected:', ctx)
      isConnected.value = false
    })

    client.on('error', (ctx) => {
      console.error('[Centrifugo] client error:', ctx)
    })

    client.connect()
  }

  function subscribe(
    channel: string,
    onPublication: (ctx: PublicationContext) => void,
  ): void {
    if (!client) return
    if (subscriptions.has(channel)) return

    const sub = client.newSubscription(channel, {
      getToken: async () => {
        const response = await centrifugoApi.getSubscriptionToken(channel)
        return response.token
      },
    })

    sub.on('publication', onPublication)
    sub.on('error', (ctx) => {
      console.warn(`[Centrifugo] subscription error on ${channel}:`, ctx)
    })
    sub.subscribe()
    subscriptions.set(channel, sub)
  }

  function unsubscribe(channel: string): void {
    const sub = subscriptions.get(channel)
    if (sub) {
      sub.unsubscribe()
      sub.removeAllListeners()
      subscriptions.delete(channel)
    }
  }

  function disconnect(): void {
    subscriptions.forEach((sub, channel) => {
      sub.unsubscribe()
      sub.removeAllListeners()
      subscriptions.delete(channel)
    })
    if (client) {
      client.disconnect()
      client = null
    }
    isConnected.value = false
  }

  return {
    isConnected,
    connect,
    subscribe,
    unsubscribe,
    disconnect,
  }
}
