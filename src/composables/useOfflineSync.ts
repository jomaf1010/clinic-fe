import { ref, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { getPendingActions, removePendingAction, getPendingActionCount } from '@/lib/offlineDb'

const isOnline = ref(navigator.onLine)
const pendingCount = ref(0)
let isSyncing = false

function updateStatus() {
  isOnline.value = navigator.onLine
  if (isOnline.value) {
    flushQueue()
  }
}

async function refreshPendingCount() {
  try {
    pendingCount.value = await getPendingActionCount()
  } catch {
    // ignore
  }
}

async function flushQueue() {
  if (isSyncing) return
  isSyncing = true

  try {
    const actions = await getPendingActions()
    if (!actions.length) return

    let synced = 0
    const token = localStorage.getItem('auth_token')
    const baseUrl = import.meta.env.VITE_API_URL as string

    for (const { key, action } of actions) {
      if (!navigator.onLine) break
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }
        if (token) headers['Authorization'] = `Bearer ${token}`

        await fetch(`${baseUrl}${action.url}`, {
          method: action.method,
          headers,
          body: action.body !== undefined ? JSON.stringify(action.body) : undefined,
        })
        await removePendingAction(key)
        synced++
      } catch {
        break
      }
    }

    await refreshPendingCount()
    if (synced > 0) {
      toast.success(`Synced ${synced} offline change${synced > 1 ? 's' : ''}`)
    }
  } finally {
    isSyncing = false
  }
}

export function useOfflineSync() {
  onMounted(() => {
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    refreshPendingCount()
  })

  onUnmounted(() => {
    window.removeEventListener('online', updateStatus)
    window.removeEventListener('offline', updateStatus)
  })

  return {
    isOnline,
    pendingCount,
    flushQueue,
    refreshPendingCount,
  }
}
