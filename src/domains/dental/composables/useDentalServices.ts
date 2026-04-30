import { computed, effectScope, ref, watch, type Ref, type ComputedRef } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { dentalApi } from '../api/dentalApi'
import type {
  DentalServiceCatalogEntry,
  DentalServiceCategory,
  UpdateDentalServicePayload,
  UpdateDoctorDentalServicePayload,
} from '../types/dental.types'

/**
 * Central access point for the dental fee schedule.
 *
 * Two scopes share the same surface:
 *
 * - `'clinic'` (default, back-compat): clinic-wide catalog. Edits hit
 *   `PATCH /dental/services/{uuid}`. Used by the auto-coder, odontogram
 *   display, visit view, and the clinic-settings fee schedule editor.
 * - `'doctor'`: the same catalog rows merged with the signed-in dentist's
 *   `DoctorService` overrides. Edits hit `PATCH /me/dental/services/{uuid}`
 *   and clearing the price (or toggling activation) sends `null`, which
 *   the backend interprets as "use clinic default" (and deletes the
 *   override row when both fields revert to defaults).
 *
 * Each scope keeps its own cache so flipping between the two views in the
 * same session doesn't cross-contaminate. Both caches invalidate on
 * clinic switch and on `window.focus` so a price change in another tab
 * is picked up the next time the user looks.
 */

export type DentalServiceScope = 'clinic' | 'doctor'

interface ScopeCache {
  services: Ref<DentalServiceCatalogEntry[]>
  loaded: Ref<boolean>
  loading: Ref<boolean>
  error: Ref<string | null>
  pendingLoad: Promise<void> | null
  /**
   * Bumped on every invalidation. Each in-flight `ensureLoaded` snapshots
   * the value at fetch start and only commits its result if the snapshot
   * still matches — protects against a race where an invalidation happens
   * mid-fetch and the dangling response would otherwise repopulate the
   * just-cleared cache (and silently re-mark it `loaded`).
   */
  generation: number
}

function createCache(): ScopeCache {
  return {
    services: ref<DentalServiceCatalogEntry[]>([]),
    loaded: ref(false),
    loading: ref(false),
    error: ref<string | null>(null),
    pendingLoad: null,
    generation: 0,
  }
}

const caches: Record<DentalServiceScope, ScopeCache> = {
  clinic: createCache(),
  doctor: createCache(),
}

let initialised = false

function invalidateScope(scope: DentalServiceScope): void {
  const c = caches[scope]
  c.services.value = []
  c.loaded.value = false
  // Reset transient state too: a fetch dangling from before this
  // invalidation is now disowned (its `finally` is gated on the
  // generation match), so it won't reset `loading` itself. Without this
  // line a stale spinner would persist until something else re-fetches.
  c.loading.value = false
  c.error.value = null
  c.pendingLoad = null
  c.generation++
}

function invalidateAll(): void {
  for (const scope of ['clinic', 'doctor'] as const) {
    invalidateScope(scope)
  }
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
    // Clinic switch / logout — both clinic prices and doctor overrides
    // are clinic-scoped on the backend (a multi-clinic dentist keeps
    // separate override sets per clinic), so both caches drop together.
    watch(
      () => auth.currentClinic?.id ?? null,
      (next: string | null, prev: string | null) => {
        if (prev != null && prev !== next) invalidateAll()
      },
    )
  })

  // Cross-tab freshness — clinic admin tweaks a price in another tab,
  // dentist's tab refetches on next focus instead of running stale
  // until full reload.
  cacheBusterFocusHandler = () => {
    for (const scope of ['clinic', 'doctor'] as const) {
      if (caches[scope].loaded.value) {
        void ensureLoaded(scope, true)
      }
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
    // Reset module-scoped state too. Without this, the next hot-reload
    // re-initialises with stale `loaded === true` and skips the fetch
    // that would have rebuilt `services`. Bump generation alongside the
    // reset so any in-flight fetch on the dying module discards its
    // dangling response on completion.
    for (const scope of ['clinic', 'doctor'] as const) {
      invalidateScope(scope)
    }
  })
}

async function fetchByScope(scope: DentalServiceScope): Promise<DentalServiceCatalogEntry[]> {
  const res = scope === 'doctor' ? await dentalApi.listMyServices() : await dentalApi.listServices()
  return res.data
}

async function ensureLoaded(scope: DentalServiceScope, force = false): Promise<void> {
  const cache = caches[scope]
  if (cache.loaded.value && !force) return
  if (cache.pendingLoad && !force) return cache.pendingLoad

  cache.loading.value = true
  cache.error.value = null
  // Snapshot the generation at fetch start. If the cache is invalidated
  // mid-fetch, generation will advance and we drop the stale response on
  // arrival rather than letting it overwrite the just-cleared cache.
  const fetchGen = cache.generation
  cache.pendingLoad = (async () => {
    try {
      const data = await fetchByScope(scope)
      if (cache.generation !== fetchGen) {
        // Invalidated mid-fetch — drop the result silently.
        return
      }
      cache.services.value = data
      cache.loaded.value = true
    } catch (err) {
      if (cache.generation === fetchGen) {
        cache.error.value = err instanceof Error ? err.message : 'Failed to load dental services.'
      }
      throw err
    } finally {
      if (cache.generation === fetchGen) {
        cache.loading.value = false
        cache.pendingLoad = null
      }
    }
  })()

  return cache.pendingLoad
}

/**
 * Merge a server response back into the cache row, preserving fields the
 * server might not echo. The doctor endpoint may return only override
 * fields and the clinic endpoint may return only clinic fields; falling
 * back to the existing row keeps `clinic_price` / `clinic_is_active`
 * stable for non-billing consumers (auto-coder, odontogram display) that
 * read those directly.
 */
function mergeRow(
  existing: DentalServiceCatalogEntry,
  patch: DentalServiceCatalogEntry,
): DentalServiceCatalogEntry {
  return {
    ...existing,
    ...patch,
    clinic_price: patch.clinic_price ?? existing.clinic_price,
    clinic_is_active: patch.clinic_is_active ?? existing.clinic_is_active,
  }
}

async function updateClinicService(
  clinicServiceUuid: string,
  payload: UpdateDentalServicePayload,
): Promise<void> {
  // The clinic update endpoint echoes the raw ClinicService model — it ships
  // `price` and `is_active` but NOT the typed `clinic_*` / `effective_*` /
  // back-compat `is_active` fields the cache expects. mergeRow's null-safe
  // fallback would leave `clinic_is_active` stale after a toggle and the
  // Switch would visually bounce back. Instead, apply the payload directly:
  // the API call has already succeeded by the time we run, and the payload
  // is canonical for what we asked the server to set.
  const raw = (await dentalApi.updateService(clinicServiceUuid, payload)).data as
    & Partial<DentalServiceCatalogEntry>
    & { price?: number | null; is_active?: boolean | null }
  const cache = caches.clinic
  const idx = cache.services.value.findIndex((s) => s.clinic_service_uuid === clinicServiceUuid)
  if (idx >= 0) {
    const existing = cache.services.value[idx]
    if (existing) {
      const nextClinicPrice = payload.price ?? (typeof raw.price === 'number' ? raw.price : existing.clinic_price)
      const nextClinicIsActive = payload.is_active ?? (typeof raw.is_active === 'boolean' ? raw.is_active : existing.clinic_is_active)
      cache.services.value[idx] = {
        ...existing,
        clinic_price: nextClinicPrice,
        clinic_is_active: nextClinicIsActive,
        // No override exists in clinic-scope rows, so effective_* always
        // mirrors clinic_*. Refresh both so any consumer that reads
        // effective_* (auto-coder, billing display) sees the new value
        // without waiting for a refetch.
        effective_price: nextClinicPrice,
        effective_is_active: nextClinicIsActive,
        is_active: nextClinicIsActive,
      }
    }
  }
  // Doctor cache derives `effective_*` from the same clinic baseline. A
  // clinic-side change made while the doctor view is also loaded would
  // otherwise show stale fallbacks, so drop the doctor cache; next
  // consumer re-fetches. Bumping the generation in `invalidateScope`
  // guarantees that any in-flight doctor `ensureLoaded()` will discard
  // its dangling response when it arrives — preventing the silent
  // re-loaded race.
  if (caches.doctor.loaded.value || caches.doctor.pendingLoad) {
    invalidateScope('doctor')
  }
}

async function updateDoctorService(
  clinicServiceUuid: string,
  payload: UpdateDoctorDentalServicePayload,
): Promise<void> {
  const res = await dentalApi.updateMyService(clinicServiceUuid, payload)
  const cache = caches.doctor
  const idx = cache.services.value.findIndex((s) => s.clinic_service_uuid === clinicServiceUuid)
  if (idx >= 0) {
    const existing = cache.services.value[idx]
    if (existing) cache.services.value[idx] = mergeRow(existing, res.data)
  }
}

interface UseDentalServicesOptions {
  scope?: DentalServiceScope
}

interface UseDentalServicesReturn {
  services: Ref<DentalServiceCatalogEntry[]>
  groupedByCategory: ComputedRef<Record<DentalServiceCategory, DentalServiceCatalogEntry[]>>
  loaded: Ref<boolean>
  loading: Ref<boolean>
  error: Ref<string | null>
  scope: DentalServiceScope
  ensureLoaded: (force?: boolean) => Promise<void>
  /**
   * Save a price/activation change. The payload shape narrows with scope:
   * doctor scope accepts `is_active: null` (clears the override); clinic
   * scope does not.
   */
  updateService: (
    clinicServiceUuid: string,
    payload: UpdateDentalServicePayload | UpdateDoctorDentalServicePayload,
  ) => Promise<void>
  findByCode: (code: string) => DentalServiceCatalogEntry | undefined
}

export function useDentalServices(options: UseDentalServicesOptions = {}): UseDentalServicesReturn {
  bindCacheBusters()
  const scope: DentalServiceScope = options.scope ?? 'clinic'
  const cache = caches[scope]

  const groupedByCategory = computed<Record<DentalServiceCategory, DentalServiceCatalogEntry[]>>(() => {
    const groups: Partial<Record<DentalServiceCategory, DentalServiceCatalogEntry[]>> = {}
    for (const s of cache.services.value) {
      const key = s.category
      ;(groups[key] ??= []).push(s)
    }
    return groups as Record<DentalServiceCategory, DentalServiceCatalogEntry[]>
  })

  function findByCode(code: string): DentalServiceCatalogEntry | undefined {
    return cache.services.value.find((s) => s.cdt_code === code)
  }

  function ensureLoadedBound(force = false): Promise<void> {
    return ensureLoaded(scope, force)
  }

  function updateService(
    clinicServiceUuid: string,
    payload: UpdateDentalServicePayload | UpdateDoctorDentalServicePayload,
  ): Promise<void> {
    return scope === 'doctor'
      ? updateDoctorService(clinicServiceUuid, payload)
      : updateClinicService(clinicServiceUuid, payload as UpdateDentalServicePayload)
  }

  return {
    services: cache.services,
    groupedByCategory,
    loaded: cache.loaded,
    loading: cache.loading,
    error: cache.error,
    scope,
    ensureLoaded: ensureLoadedBound,
    updateService,
    findByCode,
  }
}
