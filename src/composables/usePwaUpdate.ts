import { ref } from 'vue'
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
 * In dev the service worker stays off so HMR isn't cached. The import of
 * `virtual:pwa-register` is lazy + guarded by `import.meta.env.PROD` because
 * the virtual module is only emitted by vite-plugin-pwa when producing a
 * real build (or when `devOptions.enabled` is flipped on).
 *
 * `usePwaUpdate()` is a Vue composable that exposes the same reactive
 * refs for components that want to render their own UI (e.g. a banner
 * instead of the default toast).
 */

const needRefresh = ref(false)
const offlineReady = ref(false)
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
let registered = false

export async function registerPwa(): Promise<void> {
  if (registered) return
  registered = true

  if (!import.meta.env.PROD) return

  const { registerSW } = await import('virtual:pwa-register')

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
