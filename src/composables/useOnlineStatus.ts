import { ref, onMounted, onUnmounted, watch } from 'vue'
import { authApi } from '@/domains/auth/api/authApi'
import { useCentrifugo } from './useCentrifugo'
import { useAuthStore } from '@/domains/auth/stores/authStore'

const onlineUserIds = ref<Set<string>>(new Set())
let heartbeatInterval: ReturnType<typeof setInterval> | undefined
let pollInterval: ReturnType<typeof setInterval> | undefined
let initialized = false
let refCount = 0
let centrifugoListening = false

async function sendHeartbeat() {
  try {
    await authApi.heartbeat()
  } catch {
    // silent
  }
}

async function fetchOnlineUsers() {
  try {
    const res = await authApi.onlineUsers()
    onlineUserIds.value = new Set(res.data)
  } catch {
    // silent
  }
}

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(fetchOnlineUsers, 30000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = undefined
  }
}

function start() {
  if (initialized) return
  initialized = true

  sendHeartbeat()
  fetchOnlineUsers()

  // Send heartbeat every 60s
  heartbeatInterval = setInterval(sendHeartbeat, 60000)

  // Subscribe to Centrifugo dashboard channel for real-time online status
  const { subscribe, isConnected } = useCentrifugo()
  const authStore = useAuthStore()
  const clinicId = authStore.currentClinic?.clinic_id

  if (clinicId) {
    subscribe(`clinic:${clinicId}:dashboard`, (ctx) => {
      if (ctx.data?.type === 'online_status') {
        const userId = ctx.data.user_id as string
        const online = ctx.data.online as boolean
        const updated = new Set(onlineUserIds.value)
        if (online) {
          updated.add(userId)
        } else {
          updated.delete(userId)
        }
        onlineUserIds.value = updated
      }
    })
    centrifugoListening = true
  }

  // Watch Centrifugo connection: poll when disconnected, stop poll when connected
  watch(isConnected, (connected) => {
    if (connected && centrifugoListening) {
      // Centrifugo reconnected — do a full refresh then stop polling
      fetchOnlineUsers()
      stopPolling()
    } else {
      // Centrifugo disconnected — fall back to polling
      startPolling()
    }
  }, { immediate: true })
}

function stop() {
  initialized = false
  centrifugoListening = false
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = undefined }
  stopPolling()
  onlineUserIds.value = new Set()
}

export function useOnlineStatus() {
  onMounted(() => {
    refCount++
    start()
  })

  onUnmounted(() => {
    refCount--
    if (refCount <= 0) {
      refCount = 0
      stop()
    }
  })

  function isOnline(userId: string): boolean {
    return onlineUserIds.value.has(userId)
  }

  return { onlineUserIds, isOnline }
}
