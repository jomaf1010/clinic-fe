import { ref, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { getPendingActions, removePendingAction, getPendingActionCount } from '@/lib/offlineDb'
import { http } from '@/lib/http'

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

    for (const { key, action } of actions) {
      if (!navigator.onLine) break
      try {
        const method = action.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'
        if (method === 'post' || method === 'put' || method === 'patch') {
          await http[method](action.url, action.body)
        } else {
          await http[method](action.url)
        }
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
