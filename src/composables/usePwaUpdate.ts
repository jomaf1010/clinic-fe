import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import { toast } from 'vue-sonner'

/**
 * Service-worker registration for MediFlow.
 *
 * `registerPwa()` is called once at app boot from `main.ts`. In production
 * builds it registers the Workbox service worker and wires a toast-based
 * "update available" prompt — clinical workflows shouldn't be interrupted
 * by silent reloads, so updates are explicit: user sees a toast, clicks
 * "Reload".
 *
 * The `PROD` guard below no-ops the registration in dev so we never cache
 * HMR-served assets. The `virtual:pwa-register` module is always resolvable
 * (thanks to `devOptions.enabled: true` in vite.config.ts) — but we simply
 * never invoke `registerSW()` during `vite dev`.
 *
 * `usePwaUpdate()` is a Vue composable that exposes the same reactive
 * refs for components that want to render their own UI (e.g. a banner
 * instead of the default toast).
 */

const needRefresh = ref(false)
const offlineReady = ref(false)
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
let registered = false

export function registerPwa(): void {
  if (registered) return
  registered = true

  if (!import.meta.env.PROD) return

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true
      toast('Update available', {
        description: 'A new version of MediFlow is ready.',
        action: {
          label: 'Reload',
          onClick: () => {
            void applyUpdate()
          },
        },
        duration: Infinity,
      })
    },
    onOfflineReady() {
      offlineReady.value = true
      toast.success('Ready to work offline', {
        description: 'MediFlow is cached and will work without a network.',
      })
    },
  })
}

export async function applyUpdate(): Promise<void> {
  if (updateSW !== null) {
    await updateSW(true)
  }
}

export function usePwaUpdate() {
  return { needRefresh, offlineReady, applyUpdate }
}
