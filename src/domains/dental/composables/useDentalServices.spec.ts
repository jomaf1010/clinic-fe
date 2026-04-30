/**
 * Tests for the `useDentalServices` composable.
 *
 * Why these tests exist:
 *   - Module-level caches (one per scope) make this composable look simple
 *     but the lifetime is full of races: clinic-switch invalidation,
 *     window-focus refetch, in-flight ensureLoaded across two consumers,
 *     clinic-side invalidation while doctor-side is mid-fetch. The
 *     generation counter that gates each fetch's commit is the load-bearing
 *     piece — silently breaking it would re-introduce the stale-cache bug.
 *   - The clinic-update endpoint echoes the raw ClinicService model (no
 *     `clinic_*`/`effective_*` fields) so the cache update path has to
 *     map raw → typed and refresh `effective_*` even when the response
 *     omits them. A regression here is invisible in the type system.
 *
 * Each test imports the composable dynamically after `vi.resetModules()`
 * so its module-level cache state is fresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import type { DentalServiceCatalogEntry } from '../types/dental.types'

// ---- helpers -----------------------------------------------------------

function makeRow(uuid: string, opts: Partial<DentalServiceCatalogEntry> = {}): DentalServiceCatalogEntry {
  return {
    uuid: `sys-${uuid}`,
    clinic_service_uuid: `clinic-${uuid}`,
    cdt_code: `D${uuid}`,
    name: `Service ${uuid}`,
    description: null,
    category: 'preventive',
    treatment_area: 'tooth',
    surfaces_required: null,
    material: null,
    is_anterior: null,
    is_posterior: null,
    default_price: 100,
    price_min: null,
    price_max: null,
    clinic_price: 100,
    clinic_is_active: true,
    override_price: null,
    override_is_active: null,
    effective_price: 100,
    effective_is_active: true,
    is_active: true,
    ...opts,
  }
}

interface MockApi {
  listServices: ReturnType<typeof vi.fn>
  listMyServices: ReturnType<typeof vi.fn>
  updateService: ReturnType<typeof vi.fn>
  updateMyService: ReturnType<typeof vi.fn>
}

function mockApi(overrides: Partial<MockApi> = {}): MockApi {
  return {
    listServices: vi.fn().mockResolvedValue({ data: [] }),
    listMyServices: vi.fn().mockResolvedValue({ data: [] }),
    updateService: vi.fn().mockResolvedValue({ data: {} }),
    updateMyService: vi.fn().mockResolvedValue({ data: {} }),
    ...overrides,
  }
}

/**
 * Wire up the API + auth-store mocks and return a fresh import of the
 * composable. The dynamic import + `vi.resetModules()` in beforeEach
 * means each test gets virgin module-level cache state.
 */
async function loadComposable(api: MockApi) {
  vi.doMock('../api/dentalApi', () => ({ dentalApi: api }))
  vi.doMock('@/domains/auth/stores/authStore', () => ({
    // Composable's `bindCacheBusters` calls `useAuthStore()` to wire the
    // clinic-switch watcher. A plain object satisfies the access pattern;
    // none of these tests trigger an actual clinic switch.
    useAuthStore: () => ({ currentClinic: { id: 'clinic-fixture' } }),
  }))
  return await import('./useDentalServices')
}

// ---- setup --------------------------------------------------------------

beforeEach(() => {
  vi.resetModules()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('../api/dentalApi')
  vi.doUnmock('@/domains/auth/stores/authStore')
})

// ---- tests --------------------------------------------------------------

describe('useDentalServices — scope dispatch', () => {
  it('clinic scope hits listServices', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A')] }),
    })
    const { useDentalServices } = await loadComposable(api)

    const { ensureLoaded, services } = useDentalServices({ scope: 'clinic' })
    await ensureLoaded()

    expect(api.listServices).toHaveBeenCalledOnce()
    expect(api.listMyServices).not.toHaveBeenCalled()
    expect(services.value).toHaveLength(1)
  })

  it('doctor scope hits listMyServices', async () => {
    const api = mockApi({
      listMyServices: vi.fn().mockResolvedValue({ data: [makeRow('B')] }),
    })
    const { useDentalServices } = await loadComposable(api)

    const { ensureLoaded, services } = useDentalServices({ scope: 'doctor' })
    await ensureLoaded()

    expect(api.listMyServices).toHaveBeenCalledOnce()
    expect(api.listServices).not.toHaveBeenCalled()
    expect(services.value).toHaveLength(1)
  })

  it('clinic and doctor caches are independent', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A', { clinic_price: 100 })] }),
      listMyServices: vi.fn().mockResolvedValue({ data: [makeRow('A', { clinic_price: 100, override_price: 200, effective_price: 200 })] }),
    })
    const { useDentalServices } = await loadComposable(api)

    const clinic = useDentalServices({ scope: 'clinic' })
    const doctor = useDentalServices({ scope: 'doctor' })
    await Promise.all([clinic.ensureLoaded(), doctor.ensureLoaded()])

    expect(clinic.services.value[0]?.clinic_price).toBe(100)
    expect(doctor.services.value[0]?.effective_price).toBe(200)
  })
})

describe('useDentalServices — ensureLoaded', () => {
  it('de-duplicates concurrent calls within a scope', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A')] }),
    })
    const { useDentalServices } = await loadComposable(api)

    const a = useDentalServices({ scope: 'clinic' })
    const b = useDentalServices({ scope: 'clinic' })

    await Promise.all([a.ensureLoaded(), b.ensureLoaded(), b.ensureLoaded()])

    expect(api.listServices).toHaveBeenCalledOnce()
  })

  it('refetches on force=true', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A')] }),
    })
    const { useDentalServices } = await loadComposable(api)

    const c = useDentalServices({ scope: 'clinic' })
    await c.ensureLoaded()
    await c.ensureLoaded() // no force — should hit cache
    await c.ensureLoaded(true) // force

    expect(api.listServices).toHaveBeenCalledTimes(2)
  })

  it('exposes loaded=true after a successful fetch', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A')] }),
    })
    const { useDentalServices } = await loadComposable(api)

    const c = useDentalServices({ scope: 'clinic' })
    expect(c.loaded.value).toBe(false)
    await c.ensureLoaded()
    expect(c.loaded.value).toBe(true)
  })

  it('surfaces fetch failures via the error ref', async () => {
    const api = mockApi({
      listServices: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const { useDentalServices } = await loadComposable(api)

    const c = useDentalServices({ scope: 'clinic' })
    await c.ensureLoaded().catch(() => {})

    expect(c.error.value).toBe('boom')
    expect(c.loaded.value).toBe(false)
  })
})

describe('useDentalServices — race-safety: invalidation during in-flight fetch', () => {
  // The load-bearing test. Without the generation counter (pass 4 fix), an
  // in-flight doctor fetch that arrives AFTER an invalidation would
  // silently repopulate the just-cleared cache and re-mark it `loaded`.
  it('drops a stale doctor-fetch result that arrives after a clinic-update invalidation', async () => {
    let releaseDoctorFetch!: (value: { data: DentalServiceCatalogEntry[] }) => void
    const doctorFetchPromise = new Promise<{ data: DentalServiceCatalogEntry[] }>((resolve) => {
      releaseDoctorFetch = resolve
    })

    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A')] }),
      listMyServices: vi.fn(() => doctorFetchPromise),
      updateService: vi.fn().mockResolvedValue({
        data: { uuid: 'sys-A', price: 200, is_active: true },
      }),
    })
    const { useDentalServices } = await loadComposable(api)

    const clinic = useDentalServices({ scope: 'clinic' })
    const doctor = useDentalServices({ scope: 'doctor' })

    // Start the doctor fetch but DON'T await it — it's our dangling
    // in-flight fetch.
    const doctorEnsure = doctor.ensureLoaded()
    expect(doctor.loading.value).toBe(true)

    // Pre-populate the clinic cache and run the update — this fires
    // `invalidateScope('doctor')` mid-flight on the doctor cache.
    await clinic.ensureLoaded()
    await clinic.updateService('clinic-A', { price: 200 })

    // After invalidation, doctor cache is reset. loaded=false, services empty.
    expect(doctor.loaded.value).toBe(false)
    expect(doctor.services.value).toEqual([])

    // NOW release the dangling doctor fetch with stale data. The fetch's
    // generation snapshot no longer matches the cache's bumped
    // generation, so its result is dropped silently.
    releaseDoctorFetch({ data: [makeRow('A', { override_price: 999 })] })
    await doctorEnsure

    expect(doctor.services.value).toEqual([]) // STILL empty — stale write rejected
    expect(doctor.loaded.value).toBe(false)
  })
})

describe('useDentalServices — updateClinicService', () => {
  it('refreshes effective_* alongside clinic_* after a toggle', async () => {
    // The clinic-update endpoint returns the raw ClinicService model
    // (price + is_active, no clinic_* / effective_*). The composable has
    // to map raw → typed AND refresh effective_* (clinic-scope rows have
    // no override, so effective_* mirror clinic_*).
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({
        data: [makeRow('A', {
          clinic_is_active: true,
          effective_is_active: true,
          is_active: true,
        })],
      }),
      updateService: vi.fn().mockResolvedValue({
        data: { uuid: 'sys-A', price: 100, is_active: false },
      }),
    })
    const { useDentalServices } = await loadComposable(api)

    const clinic = useDentalServices({ scope: 'clinic' })
    await clinic.ensureLoaded()
    await clinic.updateService('clinic-A', { is_active: false })

    const row = clinic.services.value[0]
    expect(row).toBeDefined()
    expect(row?.clinic_is_active).toBe(false)
    expect(row?.is_active).toBe(false) // back-compat alias
    expect(row?.effective_is_active).toBe(false) // pass 3 fix
  })

  it('updates clinic_price from the payload (raw response would lack it)', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A', { clinic_price: 100 })] }),
      updateService: vi.fn().mockResolvedValue({
        data: { uuid: 'sys-A', price: 250, is_active: true },
      }),
    })
    const { useDentalServices } = await loadComposable(api)

    const clinic = useDentalServices({ scope: 'clinic' })
    await clinic.ensureLoaded()
    await clinic.updateService('clinic-A', { price: 250 })

    const row = clinic.services.value[0]
    expect(row?.clinic_price).toBe(250)
    expect(row?.effective_price).toBe(250)
  })

  it('drops the doctor cache when a clinic update happens', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({ data: [makeRow('A')] }),
      listMyServices: vi.fn().mockResolvedValue({ data: [makeRow('A')] }),
      updateService: vi.fn().mockResolvedValue({
        data: { uuid: 'sys-A', price: 250, is_active: true },
      }),
    })
    const { useDentalServices } = await loadComposable(api)

    const clinic = useDentalServices({ scope: 'clinic' })
    const doctor = useDentalServices({ scope: 'doctor' })
    await clinic.ensureLoaded()
    await doctor.ensureLoaded()
    expect(doctor.loaded.value).toBe(true)
    expect(doctor.services.value).toHaveLength(1)

    await clinic.updateService('clinic-A', { price: 250 })

    expect(doctor.loaded.value).toBe(false)
    expect(doctor.services.value).toEqual([])
  })
})

describe('useDentalServices — updateDoctorService', () => {
  it('merges the patch into the doctor cache row', async () => {
    const api = mockApi({
      listMyServices: vi.fn().mockResolvedValue({ data: [makeRow('A', { effective_price: 100 })] }),
      updateMyService: vi.fn().mockResolvedValue({
        data: makeRow('A', {
          override_price: 700,
          override_is_active: null,
          effective_price: 700,
          effective_is_active: true,
          is_active: true,
        }),
      }),
    })
    const { useDentalServices } = await loadComposable(api)

    const doctor = useDentalServices({ scope: 'doctor' })
    await doctor.ensureLoaded()
    await doctor.updateService('clinic-A', { price: 700 })

    const row = doctor.services.value[0]
    expect(row?.override_price).toBe(700)
    expect(row?.effective_price).toBe(700)
  })
})

describe('useDentalServices — derived state', () => {
  it('groupedByCategory partitions rows by category', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({
        data: [
          makeRow('A', { category: 'preventive' }),
          makeRow('B', { category: 'preventive' }),
          makeRow('C', { category: 'restorative' }),
        ],
      }),
    })
    const { useDentalServices } = await loadComposable(api)

    const c = useDentalServices({ scope: 'clinic' })
    await c.ensureLoaded()
    await nextTick()

    expect(c.groupedByCategory.value.preventive).toHaveLength(2)
    expect(c.groupedByCategory.value.restorative).toHaveLength(1)
  })

  it('findByCode returns the row matching cdt_code', async () => {
    const api = mockApi({
      listServices: vi.fn().mockResolvedValue({
        data: [makeRow('A'), makeRow('B')],
      }),
    })
    const { useDentalServices } = await loadComposable(api)

    const c = useDentalServices({ scope: 'clinic' })
    await c.ensureLoaded()

    expect(c.findByCode('DA')?.cdt_code).toBe('DA')
    expect(c.findByCode('DZ')).toBeUndefined()
  })
})
