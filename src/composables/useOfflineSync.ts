import { ref, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { syncEngine } from '@/lib/sync/SyncEngine'

/**
 * Connectivity-aware offline composable. Thin wrapper over the SyncEngine
 * that exposes reactive `isOnline` + `pendingCount` state for the UI, and
 * triggers a flush whenever the browser reports a transition back online.
 *
 * Previous iterations of this file owned the queue-processing loop
 * directly; that logic lives in SyncEngine now. This composable is purely
 * the glue between `window.online`/`offline` events, the toast UI, and
 * the engine.
 */

const isOnline = ref(navigator.onLine)
const pendingCount = ref(0)
const failedCount = ref(0)

let listenersInstalled = false
let refCount = 0

// Register the SyncEngine listeners exactly once — not per component —
// so a single success toast fires even when many views use the composable.
const unsubSucceeded = syncEngine.on('action-succeeded', () => {
  // Count update is deferred to queue-drained / queue-stopped so we only
  // toast once per flush, not once per action.
})
const unsubDrained = syncEngine.on('queue-drained', ({ processed }) => {
  if (processed > 0) {
    toast.success(`Synced ${processed} offline change${processed > 1 ? 's' : ''}`)
  }
  void refreshPendingCount()
})
const unsubStopped = syncEngine.on('queue-stopped', ({ reason, processed }) => {
  if (processed > 0 && reason !== 'offline') {
    toast.success(`Synced ${processed} offline change${processed > 1 ? 's' : ''}`)
  }
  void refreshPendingCount()
})
const unsubFailed = syncEngine.on('action-failed', ({ reason }) => {
  toast.error('An offline change needs review', { description: reason })
  void refreshCounts()
})
const unsubDiscarded = syncEngine.on('action-discarded', ({ reason }) => {
  toast.error('An offline change was dropped after retrying', { description: reason })
  void refreshCounts()
})

// The composable unmounts periodically; keep the subscriptions alive for
// the app lifetime by holding explicit references so GC doesn't nuke them.
void unsubSucceeded
void unsubDrained
void unsubStopped
void unsubFailed
void unsubDiscarded

async function refreshCounts(): Promise<void> {
  await Promise.all([refreshPendingCount(), refreshFailedCount()])
}

async function refreshPendingCount(): Promise<void> {
  try {
    pendingCount.value = await syncEngine.pendingCount()
  } catch {
    // best-effort
  }
}

async function refreshFailedCount(): Promise<void> {
  try {
    failedCount.value = await syncEngine.failedCount()
  } catch {
    // best-effort
  }
}

function updateStatus(): void {
  isOnline.value = navigator.onLine
  if (isOnline.value) {
    void syncEngine.flush()
  }
}

function installListeners(): void {
  if (listenersInstalled) return
  listenersInstalled = true
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
}

function removeListeners(): void {
  if (!listenersInstalled) return
  listenersInstalled = false
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
}

export function useOfflineSync() {
  onMounted(() => {
    refCount++
    installListeners()
    void refreshCounts()
    // If we mounted in an online state with a backlog, get started.
    if (navigator.onLine) {
      void syncEngine.flush()
    }
  })

  onUnmounted(() => {
    refCount--
    if (refCount <= 0) {
      refCount = 0
      removeListeners()
    }
  })

  return {
    isOnline,
    pendingCount,
    failedCount,
    flushQueue: () => syncEngine.flush(),
    refreshPendingCount,
    refreshFailedCount,
    refreshCounts,
  }
}
