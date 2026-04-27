import { computed, ref } from 'vue'
import { dentalApi } from '../api/dentalApi'
import type {
  DentalServiceCatalogEntry,
  DentalServiceCategory,
  UpdateDentalServicePayload,
} from '../types/dental.types'

/**
 * Central access point for a clinic's dental fee schedule.
 *
 * - Fetched once per session (lazy on first consumer).
 * - Components read through computed getters; mutations go through
 *   `updateService` which patches the backend and refreshes cache.
 * - `findByCode(code)` returns a single entry (used by the auto-coder
 *   composable in Phase 5).
 */

const services = ref<DentalServiceCatalogEntry[]>([])
const loaded = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

let pendingLoad: Promise<void> | null = null

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
