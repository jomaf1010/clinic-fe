<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Centrifuge } from 'centrifuge'
import type { PublicationContext, SubscriptionTokenContext } from 'centrifuge'
import { Clock, Users, Stethoscope, Wifi, WifiOff } from 'lucide-vue-next'
import { queueApi } from '@/domains/queue/api/queueApi'
import type { QueueVisitResponse } from '@/domains/queue/types/queue.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DisplayError = 'INVALID_TOKEN' | 'NETWORK_ERROR' | null

interface RealtimeEvent {
  type: string
  data: QueueVisitResponse
}

// ---------------------------------------------------------------------------
// Route / state
// ---------------------------------------------------------------------------

const route = useRoute()
const token = route.params.token as string

const clinicName = ref('')
const visits = ref<QueueVisitResponse[]>([])

const isLoading = ref(true)
const displayError = ref<DisplayError>(null)
const isReconnecting = ref(false)

// ---------------------------------------------------------------------------
// Derived lists
// ---------------------------------------------------------------------------

const inProgressVisits = computed<QueueVisitResponse[]>(() =>
  visits.value
    .filter((v) => v.status === 'in_progress')
    .sort((a, b) => a.position - b.position),
)

const waitingVisits = computed<QueueVisitResponse[]>(() =>
  visits.value
    .filter((v) => v.status === 'waiting')
    .sort((a, b) => a.position - b.position),
)

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

const currentTime = ref('')

function updateTime(): void {
  currentTime.value = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

let clockInterval: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Realtime event handler (mirrors queueStore.handleRealtimeEvent)
// ---------------------------------------------------------------------------

function handleRealtimeEvent(event: RealtimeEvent): void {
  const { type, data } = event
  const index = visits.value.findIndex((v) => v.id === data.id)

  switch (type) {
    case 'queue.visit.created':
      if (index === -1) {
        visits.value.push(data)
      } else {
        visits.value[index] = data
      }
      break
    case 'queue.visit.called':
    case 'queue.visit.completed':
    case 'queue.visit.cancelled':
      if (index !== -1) {
        visits.value[index] = data
      } else {
        visits.value.push(data)
      }
      break
  }
}

// ---------------------------------------------------------------------------
// Centrifuge
// ---------------------------------------------------------------------------

let centrifuge: Centrifuge | null = null
let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

// Cached tokens so getToken callbacks can return the latest value without
// an extra round-trip every time Centrifuge internally requests a new token.
let latestConnectionToken = ''
let latestSubscriptionToken = ''

async function fetchFreshTokens(): Promise<void> {
  const tokens = await queueApi.refreshDisplayTokens(token)
  latestConnectionToken = tokens.connection_token
  latestSubscriptionToken = tokens.subscription_token
}

function scheduleTokenRefresh(): void {
  clearTokenRefreshTimer()
  // Refresh 10 minutes before the 60-minute mark → every 50 minutes
  tokenRefreshTimer = setTimeout(async () => {
    try {
      await fetchFreshTokens()
    } catch {
      // Non-fatal; Centrifuge getToken callbacks will handle it on demand
    }
    scheduleTokenRefresh()
  }, 50 * 60 * 1000)
}

function clearTokenRefreshTimer(): void {
  if (tokenRefreshTimer !== null) {
    clearTimeout(tokenRefreshTimer)
    tokenRefreshTimer = null
  }
}

function startPollingFallback(): void {
  if (pollTimer !== null) return
  pollTimer = setInterval(async () => {
    try {
      const data = await queueApi.getDisplay(token)
      visits.value = data.visits
      isReconnecting.value = false
    } catch {
      // Keep showing last known state
    }
  }, 30_000)
}

function stopPollingFallback(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function initCentrifuge(
  connectionToken: string,
  subscriptionToken: string,
  channel: string,
): void {
  latestConnectionToken = connectionToken
  latestSubscriptionToken = subscriptionToken

  const centrifugoUrl = import.meta.env.VITE_CENTRIFUGO_URL as string
  const wsUrl =
    centrifugoUrl.startsWith('wss://') || centrifugoUrl.startsWith('ws://')
      ? centrifugoUrl
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${centrifugoUrl}`

  centrifuge = new Centrifuge(wsUrl, {
    token: latestConnectionToken,
    getToken: async (): Promise<string> => {
      try {
        await fetchFreshTokens()
        return latestConnectionToken
      } catch {
        return latestConnectionToken
      }
    },
  })

  centrifuge.on('connected', () => {
    isReconnecting.value = false
    stopPollingFallback()
  })

  centrifuge.on('connecting', () => {
    isReconnecting.value = true
  })

  centrifuge.on('disconnected', () => {
    isReconnecting.value = true
    startPollingFallback()
  })

  centrifuge.on('error', () => {
    isReconnecting.value = true
  })

  const sub = centrifuge.newSubscription(channel, {
    token: latestSubscriptionToken,
    getToken: async (_ctx: SubscriptionTokenContext): Promise<string> => {
      try {
        await fetchFreshTokens()
        return latestSubscriptionToken
      } catch {
        return latestSubscriptionToken
      }
    },
  })

  sub.on('publication', (ctx: PublicationContext) => {
    const event = ctx.data as RealtimeEvent
    if (event && event.type && event.data) {
      handleRealtimeEvent(event)
    }
  })

  sub.on('error', (ctx) => {
    console.warn('[QueueDisplay] subscription error:', ctx)
  })

  sub.subscribe()
  centrifuge.connect()
  scheduleTokenRefresh()
}

function disconnectCentrifuge(): void {
  clearTokenRefreshTimer()
  if (centrifuge) {
    centrifuge.disconnect()
    centrifuge = null
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  isLoading.value = true
  displayError.value = null

  try {
    const data = await queueApi.getDisplay(token)
    clinicName.value = data.clinic_name
    visits.value = data.visits
    isLoading.value = false

    // Remove token from URL so it doesn't linger in browser history or referrer headers
    window.history.replaceState(null, '', '/queue-display')

    initCentrifuge(
      data.centrifugo.connection_token,
      data.centrifugo.subscription_token,
      data.centrifugo.channel,
    )
  } catch (err) {
    isLoading.value = false
    console.error('[QueueDisplay] bootstrap error:', err)
    const message = err instanceof Error ? err.message : ''
    displayError.value = message === 'INVALID_TOKEN' ? 'INVALID_TOKEN' : 'NETWORK_ERROR'
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
  updateTime()
  clockInterval = setInterval(updateTime, 1000)
  bootstrap()
})

onUnmounted(() => {
  if (clockInterval !== null) clearInterval(clockInterval)
  disconnectCentrifuge()
  stopPollingFallback()
})
</script>

<template>
  <div
    class="dark min-h-screen flex flex-col overflow-hidden"
    style="background-color: #030712; color: #f9fafb"
  >

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center"
    >
      <div class="flex flex-col items-center gap-4">
        <div
          class="w-14 h-14 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
        />
        <p class="text-lg" style="color: #9ca3af">Loading queue display…</p>
      </div>
    </div>

    <!-- Invalid token -->
    <div
      v-else-if="displayError === 'INVALID_TOKEN'"
      class="flex-1 flex items-center justify-center px-6 text-center"
    >
      <div class="max-w-md">
        <WifiOff class="w-16 h-16 mx-auto mb-6" style="color: #4b5563" />
        <p class="text-xl leading-relaxed" style="color: #d1d5db">
          This display link is no longer active. Please generate a new link from
          the Queue page.
        </p>
      </div>
    </div>

    <!-- Network error -->
    <div
      v-else-if="displayError === 'NETWORK_ERROR'"
      class="flex-1 flex items-center justify-center px-6 text-center"
    >
      <div class="max-w-md flex flex-col items-center gap-6">
        <WifiOff class="w-16 h-16" style="color: #4b5563" />
        <p class="text-xl leading-relaxed" style="color: #d1d5db">
          Unable to connect. Please check your network connection.
        </p>
        <button
          class="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium transition-colors"
          style="color: #fff"
          @click="bootstrap"
        >
          Try Again
        </button>
      </div>
    </div>

    <!-- Main display -->
    <template v-else>

      <!-- Reconnecting banner -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="-translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-full opacity-0"
      >
        <div
          v-if="isReconnecting"
          class="px-4 py-2 flex items-center justify-center gap-2 text-sm"
          style="background-color: rgba(120, 53, 15, 0.7); border-bottom: 1px solid #b45309; color: #fcd34d"
        >
          <WifiOff class="w-4 h-4 shrink-0" />
          <span>Reconnecting…</span>
        </div>
      </Transition>

      <!-- Header -->
      <header
        class="flex items-center justify-between px-6 py-4 shrink-0"
        style="border-bottom: 1px solid #1f2937"
      >
        <div class="flex items-center gap-3">
          <Stethoscope class="w-6 h-6 shrink-0" style="color: #34d399" />
          <h1 class="text-2xl font-bold tracking-tight truncate">{{ clinicName }}</h1>
        </div>
        <div class="flex items-center gap-2 text-xl font-mono shrink-0 ml-4" style="color: #d1d5db">
          <Clock class="w-5 h-5" style="color: #6b7280" />
          <span>{{ currentTime }}</span>
        </div>
      </header>

      <!-- Body -->
      <main class="flex-1 grid grid-cols-1 lg:grid-cols-5 overflow-hidden">

        <!-- Now Serving (left / top) -->
        <section
          class="lg:col-span-3 flex flex-col p-6 overflow-y-auto queue-display-now-serving"
        >
          <div class="flex items-center gap-3 mb-6 shrink-0">
            <Stethoscope class="w-5 h-5" style="color: #34d399" />
            <h2 class="text-xl font-semibold uppercase tracking-widest" style="color: #34d399">
              Now Serving
            </h2>
          </div>

          <!-- Empty state -->
          <div
            v-if="inProgressVisits.length === 0"
            class="flex-1 flex items-center justify-center"
          >
            <p class="text-lg" style="color: #4b5563">No patients being served</p>
          </div>

          <!-- In-progress cards -->
          <TransitionGroup
            v-else
            tag="div"
            class="flex flex-col gap-4"
            enter-active-class="transition-all duration-500 ease-out"
            enter-from-class="opacity-0 translate-y-4"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-400 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-4"
            move-class="transition-transform duration-400"
          >
            <div
              v-for="visit in inProgressVisits"
              :key="visit.id"
              class="flex items-center gap-5 rounded-2xl px-6 py-5"
              style="background-color: rgba(6, 78, 59, 0.6); border: 1px solid rgba(4, 120, 87, 0.6)"
            >
              <!-- Position badge -->
              <div
                class="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"
              >
                <span class="text-2xl font-bold" style="color: #fff">{{ visit.position }}</span>
              </div>

              <!-- Info -->
              <div class="min-w-0">
                <p class="text-3xl lg:text-4xl font-bold truncate leading-tight" style="color: #f9fafb">
                  {{ visit.patient_name ?? 'Patient' }}
                </p>
                <p
                  v-if="visit.doctor_name"
                  class="text-base mt-1 truncate"
                  style="color: #34d399"
                >
                  {{ visit.doctor_name }}
                </p>
              </div>
            </div>
          </TransitionGroup>
        </section>

        <!-- Up Next (right / bottom) -->
        <section
          class="lg:col-span-2 flex flex-col p-6 overflow-y-auto"
        >
          <div class="flex items-center gap-3 mb-6 shrink-0">
            <Users class="w-5 h-5" style="color: #9ca3af" />
            <h2 class="text-xl font-semibold uppercase tracking-widest" style="color: #9ca3af">
              Up Next
            </h2>
          </div>

          <!-- Empty state -->
          <div
            v-if="waitingVisits.length === 0"
            class="flex-1 flex items-center justify-center"
          >
            <p class="text-lg" style="color: #4b5563">No patients waiting</p>
          </div>

          <!-- Waiting list -->
          <TransitionGroup
            v-else
            tag="div"
            class="flex flex-col gap-3"
            enter-active-class="transition-all duration-500 ease-out"
            enter-from-class="opacity-0 translate-x-4"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition-all duration-400 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 translate-x-4"
            move-class="transition-transform duration-400"
          >
            <div
              v-for="visit in waitingVisits"
              :key="visit.id"
              class="flex items-center gap-4 rounded-xl px-4 py-3"
              style="background-color: rgba(17, 24, 39, 0.6); border: 1px solid #1f2937"
            >
              <!-- Position badge -->
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style="background-color: #374151"
              >
                <span class="text-xl font-bold" style="color: #d1d5db">{{ visit.position }}</span>
              </div>

              <!-- Name -->
              <p class="text-xl lg:text-2xl font-semibold truncate" style="color: #f9fafb">
                {{ visit.patient_name ?? 'Patient' }}
              </p>
            </div>
          </TransitionGroup>
        </section>

      </main>
    </template>
  </div>
</template>

<style scoped>
.queue-display-now-serving {
  border-bottom: 1px solid #1f2937;
}
@media (min-width: 1024px) {
  .queue-display-now-serving {
    border-bottom: none;
    border-right: 1px solid #1f2937;
  }
}
</style>
