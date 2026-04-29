import { computed, effectScope, ref, watch } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { dentalApi } from '../api/dentalApi'
import type {
  DentalServiceCatalogEntry,
  DentalServiceCategory,
  UpdateDentalServicePayload,
} from '../types/dental.types'

/**
 * Central access point for a clinic's dental fee schedule.
 *
 * - Fetched lazily on first consumer.
 * - Cache invalidates when the active clinic changes (clinic switch /
 *   logout / re-login) so a dentist who moves between clinics doesn't
 *   bill with the prior clinic's prices. The cache also invalidates
 *   on `window.focus` so a price change made by the clinic admin in
 *   another tab is picked up the next time the dentist looks at the
 *   chart.
 * - `updateService` patches the backend and refreshes cache for the
 *   originating tab.
 */

const services = ref<DentalServiceCatalogEntry[]>([])
const loaded = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

let pendingLoad: Promise<void> | null = null
let initialised = false

function invalidate(): void {
  services.value = []
  loaded.value = false
  pendingLoad = null
}

// Detached scope so the watcher gets a stop handle (Vite HMR can call
// `cacheBusterScope.stop()` to release it) and the focus listener is
// trackable. Without this, both leaked across hot reloads in dev and
// across logout/login in long-lived production sessions.
const cacheBusterScope = effectScope(true)
let cacheBusterFocusHandler: (() => void) | null = null

function bindCacheBusters(): void {
  if (initialised || typeof window === 'undefined') return
  initialised = true

  cacheBusterScope.run(() => {
    const auth = useAuthStore()
    // Clinic switch / logout — pricing belongs to the active clinic.
    watch(
      () => auth.currentClinic?.id ?? null,
      (next, prev) => {
        if (prev != null && prev !== next) invalidate()
      },
    )
  })

  // Cross-tab freshness — clinic admin tweaks a price in another tab,
  // dentist's tab refetches on next focus instead of running stale
  // until full reload.
  cacheBusterFocusHandler = () => {
    if (loaded.value) {
      void ensureLoaded(true)
    }
  }
  window.addEventListener('focus', cacheBusterFocusHandler)
}

// HMR cleanup so dev hot-reloads don't compound watchers / listeners.
// Production runs once and these never fire.
if (typeof import.meta !== 'undefined' && import.meta.hot) {
  import.meta.hot.dispose(() => {
    cacheBusterScope.stop()
    if (cacheBusterFocusHandler && typeof window !== 'undefined') {
      window.removeEventListener('focus', cacheBusterFocusHandler)
      cacheBusterFocusHandler = null
    }
    initialised = false
  })
}

async function ensureLoaded(force = false): Promise<void> {
  if (loaded.value && !force) return
  if (pendingLoad && !force) return pendingLoad

  loading.value = true
  error.value = null
  pendingLoad = (async () => {
    try {
      const res = await dentalApi.listServices()
      services.value = res.data
      loaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load dental services.'
      throw err
    } finally {
      loading.value = false
      pendingLoad = null
    }
  })()

  return pendingLoad
}

async function updateService(clinicServiceUuid: string, payload: UpdateDentalServicePayload): Promise<void> {
  const res = await dentalApi.updateService(clinicServiceUuid, payload)
  const idx = services.value.findIndex((s) => s.clinic_service_uuid === clinicServiceUuid)
  if (idx >= 0) {
    const existing = services.value[idx]
    if (existing) {
      services.value[idx] = {
        ...existing,
        clinic_price: res.data.clinic_price ?? existing.clinic_price,
        is_active: res.data.is_active ?? existing.is_active,
      }
    }
  }
}

export function useDentalServices() {
  bindCacheBusters()

  const groupedByCategory = computed<Record<DentalServiceCategory, DentalServiceCatalogEntry[]>>(() => {
    const groups: Partial<Record<DentalServiceCategory, DentalServiceCatalogEntry[]>> = {}
    for (const s of services.value) {
      const key = s.category
      ;(groups[key] ??= []).push(s)
    }
    return groups as Record<DentalServiceCategory, DentalServiceCatalogEntry[]>
  })

  function findByCode(code: string): DentalServiceCatalogEntry | undefined {
    return services.value.find((s) => s.cdt_code === code)
  }

  return {
    services,
    groupedByCategory,
    loaded,
    loading,
    error,
    ensureLoaded,
    updateService,
    findByCode,
  }
}
