/**
 * Tests for the auth Pinia store.
 *
 * Coverage focus per Phase 3 plan:
 *   - Login → memberships dispatch (single membership auto-selects clinic).
 *   - Logout clears state, kills the auth token, deletes offline DB.
 *   - silentRefresh happy + sad paths.
 *   - currentClinic / hasPermission / hasFeature derivation.
 *   - Trial / grace-period / cancel-at-period-end derivation.
 *
 * Module mocking convention: dynamic-import the store after `vi.doMock`s
 * are wired (matches `useDentalServices.spec.ts`). The setup file already
 * activates a fresh Pinia per test, so once the store is imported it's
 * good to go.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ClinicContext, LoginResponse, MeResponse, Membership, User } from '../types/auth.types'

interface MockAuthApi {
  login: ReturnType<typeof vi.fn>
  signup: ReturnType<typeof vi.fn>
  googleAuth: ReturnType<typeof vi.fn>
  requestGoogleLink: ReturnType<typeof vi.fn>
  confirmGoogleLink: ReturnType<typeof vi.fn>
  me: ReturnType<typeof vi.fn>
  selectClinic: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
}

function makeAuthApi(overrides: Partial<MockAuthApi> = {}): MockAuthApi {
  return {
    login: vi.fn().mockResolvedValue({ data: { access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }, meta: { memberships: [] } }),
    signup: vi.fn().mockResolvedValue({ message: 'ok' }),
    googleAuth: vi.fn().mockResolvedValue({ data: { access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }, meta: { memberships: [] } }),
    requestGoogleLink: vi.fn().mockResolvedValue({ message: 'ok' }),
    confirmGoogleLink: vi.fn().mockResolvedValue({ data: { access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }, meta: { memberships: [] } }),
    me: vi.fn().mockResolvedValue({ data: makeUser(), meta: { memberships: [] } }),
    selectClinic: vi.fn().mockResolvedValue({ data: { access_token: 'tok2', token_type: 'Bearer', expires_in: 3600 } }),
    refresh: vi.fn().mockResolvedValue({ data: { access_token: 'refreshed', token_type: 'Bearer', expires_in: 3600 } }),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    first_name: 'Dr',
    middle_name: null,
    last_name: 'Test',
    suffix: null,
    name: 'Dr Test',
    title_prefix: null,
    email: 't@example.com',
    contact_number: null,
    date_of_birth: null,
    prc_license_number: null,
    ptr_number: null,
    s2_license_number: null,
    specialty: null,
    sub_specialty: null,
    consultation_fee: null,
    follow_up_fee: null,
    emergency_fee: null,
    specialty_fees: null,
    avatar_url: null,
    onboarding_completed: true,
    current_clinic: null,
    theme: null,
    preferences: null,
    ...overrides,
  }
}

function makeClinicContext(overrides: Partial<ClinicContext> = {}): ClinicContext {
  return {
    id: 'c1',
    clinic_name: 'Test Clinic',
    address: null,
    formatted_address: null,
    contact_number: null,
    email: null,
    logo_url: null,
    settings: {},
    role: 'doctor',
    membership_id: 'm1',
    permissions: ['patient.view'],
    plan: 'pro',
    is_trial: false,
    trial_ends_at: null,
    billing_period_ends_at: null,
    cancel_at_period_end: false,
    is_in_grace_period: false,
    features: ['messages'],
    limits: {
      team_members: { max: 10, used: 1 },
      pdf_generation_daily: { max: null, used: 0 },
    },
    ...overrides,
  }
}

function makeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'm1',
    clinic_id: 'c1',
    clinic_name: 'Test Clinic',
    logo_url: null,
    role: 'doctor',
    status: 'active',
    plan: 'pro',
    is_trial: false,
    ...overrides,
  }
}

async function loadStore(api: MockAuthApi) {
  vi.doMock('../api/authApi', () => ({ authApi: api }))
  vi.doMock('@/lib/http', () => ({ setAuthToken: vi.fn() }))
  vi.doMock('@/composables/useTheme', () => ({ useTheme: () => ({ setTheme: vi.fn() }) }))
  vi.doMock('@/composables/useCentrifugo', () => ({ useCentrifugo: () => ({ disconnect: vi.fn() }) }))
  // Avoid loading the real specialty store on me()
  vi.doMock('@/stores/specialtyConfigStore', () => ({
    useSpecialtyConfigStore: () => ({ fetchConfig: vi.fn() }),
  }))
  return await import('./authStore')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('../api/authApi')
  vi.doUnmock('@/lib/http')
  vi.doUnmock('@/composables/useTheme')
  vi.doUnmock('@/composables/useCentrifugo')
  vi.doUnmock('@/stores/specialtyConfigStore')
})

describe('authStore — initial state', () => {
  it('starts unauthenticated with no clinic context', async () => {
    const api = makeAuthApi()
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
    expect(store.hasClinicContext).toBe(false)
    expect(store.currentClinic).toBeNull()
    expect(store.currentRole).toBeNull()
  })
})

describe('authStore — login flow', () => {
  it('auto-selects clinic when there is exactly one active membership', async () => {
    const loginResp: LoginResponse = {
      data: { access_token: 'login-tok', token_type: 'Bearer', expires_in: 3600 },
      meta: { memberships: [makeMembership({ clinic_id: 'c1', status: 'active' })] },
    }
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: makeClinicContext() }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({
      login: vi.fn().mockResolvedValue(loginResp),
      me: vi.fn().mockResolvedValue(meResp),
    })

    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.login({ email: 't@example.com', password: 'secret' })

    expect(api.login).toHaveBeenCalledWith({ email: 't@example.com', password: 'secret' })
    expect(api.selectClinic).toHaveBeenCalledWith('c1')
    expect(api.me).toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(true)
    expect(store.hasClinicContext).toBe(true)
    expect(store.currentRole).toBe('doctor')
  })

  it('skips selectClinic when there are zero memberships (onboarding path)', async () => {
    const loginResp: LoginResponse = {
      data: { access_token: 'login-tok', token_type: 'Bearer', expires_in: 3600 },
      meta: { memberships: [] },
    }
    const meResp: MeResponse = {
      data: makeUser({ onboarding_completed: false }),
      meta: { memberships: [] },
    }
    const api = makeAuthApi({
      login: vi.fn().mockResolvedValue(loginResp),
      me: vi.fn().mockResolvedValue(meResp),
    })

    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.login({ email: 't@example.com', password: 'secret' })

    expect(api.selectClinic).not.toHaveBeenCalled()
    expect(store.needsOnboarding).toBe(true)
    expect(store.needsClinicSelection).toBe(false)
  })

  it('flags needsClinicSelection when user has multiple memberships', async () => {
    const loginResp: LoginResponse = {
      data: { access_token: 'login-tok', token_type: 'Bearer', expires_in: 3600 },
      meta: {
        memberships: [
          makeMembership({ id: 'm1', clinic_id: 'c1', status: 'active' }),
          makeMembership({ id: 'm2', clinic_id: 'c2', status: 'active' }),
        ],
      },
    }
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: null }),
      meta: { memberships: loginResp.meta.memberships },
    }
    const api = makeAuthApi({
      login: vi.fn().mockResolvedValue(loginResp),
      me: vi.fn().mockResolvedValue(meResp),
    })

    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.login({ email: 't@example.com', password: 'secret' })

    expect(api.selectClinic).not.toHaveBeenCalled()
    expect(store.memberships).toHaveLength(2)
    expect(store.needsClinicSelection).toBe(true)
  })

  it('fetches user without selecting when memberships are inactive', async () => {
    const loginResp: LoginResponse = {
      data: { access_token: 'login-tok', token_type: 'Bearer', expires_in: 3600 },
      meta: {
        memberships: [makeMembership({ clinic_id: 'c1', status: 'inactive' })],
      },
    }
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: null }),
      meta: { memberships: loginResp.meta.memberships },
    }
    const api = makeAuthApi({
      login: vi.fn().mockResolvedValue(loginResp),
      me: vi.fn().mockResolvedValue(meResp),
    })

    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.login({ email: 't@example.com', password: 'secret' })

    expect(api.selectClinic).not.toHaveBeenCalled()
    expect(api.me).toHaveBeenCalled()
    expect(store.needsClinicSelection).toBe(true)
  })

  it('forwards google auth, google link, confirm link, and signup calls', async () => {
    const api = makeAuthApi({
      googleAuth: vi.fn().mockResolvedValue({
        data: { access_token: 'google-tok', token_type: 'Bearer', expires_in: 3600 },
        meta: { memberships: [] },
      }),
      confirmGoogleLink: vi.fn().mockResolvedValue({
        data: { access_token: 'linked-tok', token_type: 'Bearer', expires_in: 3600 },
        meta: { memberships: [] },
      }),
    })

    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()

    await store.googleLogin('google-credential', true)
    await store.requestGoogleLink('link-credential')
    await store.confirmGoogleLink('t@example.com', '123456', false)
    await store.signup({
      first_name: 'Dr',
      last_name: 'Test',
      email: 't@example.com',
      password: 'secret-password',
      recaptcha_token: 'recaptcha-token',
    })

    expect(api.googleAuth).toHaveBeenCalledWith({ credential: 'google-credential', remember_me: true })
    expect(api.requestGoogleLink).toHaveBeenCalledWith({ credential: 'link-credential' })
    expect(api.confirmGoogleLink).toHaveBeenCalledWith({
      email: 't@example.com',
      token: '123456',
      remember_me: false,
    })
    expect(api.signup).toHaveBeenCalledWith({
      first_name: 'Dr',
      last_name: 'Test',
      email: 't@example.com',
      password: 'secret-password',
      recaptcha_token: 'recaptcha-token',
    })
    expect(api.me).toHaveBeenCalledTimes(2)
    expect(store.token).toBe('linked-tok')
  })
})

describe('authStore — selectClinic', () => {
  it('switches active clinic context and refetches user', async () => {
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: makeClinicContext({ id: 'c2', clinic_name: 'Second Clinic' }) }),
      meta: { memberships: [makeMembership({ id: 'm2', clinic_id: 'c2' })] },
    }
    const api = makeAuthApi({
      me: vi.fn().mockResolvedValue(meResp),
    })

    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.selectClinic('c2')

    expect(api.selectClinic).toHaveBeenCalledWith('c2')
    expect(api.me).toHaveBeenCalled()
    expect(store.currentClinic?.id).toBe('c2')
    expect(store.currentClinic?.clinic_name).toBe('Second Clinic')
  })
})

describe('authStore — permission + feature helpers', () => {
  it('owners always pass hasPermission', async () => {
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: makeClinicContext({ role: 'owner', permissions: [] }) }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.hasPermission('any.thing')).toBe(true)
  })

  it('non-owners check the explicit permissions array', async () => {
    const meResp: MeResponse = {
      data: makeUser({
        current_clinic: makeClinicContext({ role: 'doctor', permissions: ['patient.view'] }),
      }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.hasPermission('patient.view')).toBe(true)
    expect(store.hasPermission('billing.create')).toBe(false)
  })

  it('hasFeature reflects the clinic features array', async () => {
    const meResp: MeResponse = {
      data: makeUser({
        current_clinic: makeClinicContext({ features: ['messages', 'audit_logs'] }),
      }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.hasFeature('messages')).toBe(true)
    expect(store.hasFeature('lab_orders')).toBe(false)
  })

  it('returns false for any permission/feature when there is no clinic context', async () => {
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: null }),
      meta: { memberships: [] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.hasPermission('anything')).toBe(false)
    expect(store.hasFeature('anything')).toBe(false)
  })

  it('getLimit returns max/used/remaining with correct math', async () => {
    const meResp: MeResponse = {
      data: makeUser({
        current_clinic: makeClinicContext({
          limits: {
            team_members: { max: 10, used: 3 },
            pdf_generation_daily: { max: null, used: 5 },
          },
        }),
      }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.getLimit('team_members')).toEqual({ max: 10, used: 3, remaining: 7 })
    // null max → unlimited (remaining null)
    expect(store.getLimit('pdf_generation_daily')).toEqual({ max: null, used: 5, remaining: null })
  })

  it('getLimit defaults missing limits and clamps overage remaining at zero', async () => {
    const meResp: MeResponse = {
      data: makeUser({
        current_clinic: makeClinicContext({
          limits: {
            team_members: { max: 2, used: 5 },
          } as ClinicContext['limits'],
        }),
      }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.getLimit('team_members')).toEqual({ max: 2, used: 5, remaining: 0 })
    expect(store.getLimit('pdf_generation_daily')).toEqual({ max: null, used: 0, remaining: null })
  })
})

describe('authStore — fetchUser side effects', () => {
  it('applies theme and loads specialty config when present', async () => {
    const setTheme = vi.fn()
    const fetchConfig = vi.fn()
    const api = makeAuthApi({
      me: vi.fn().mockResolvedValue({
        data: makeUser({ theme: 'dark', specialty: 'cardiology' }),
        meta: { memberships: [] },
      }),
    })
    vi.doMock('../api/authApi', () => ({ authApi: api }))
    vi.doMock('@/lib/http', () => ({ setAuthToken: vi.fn() }))
    vi.doMock('@/composables/useTheme', () => ({ useTheme: () => ({ setTheme }) }))
    vi.doMock('@/composables/useCentrifugo', () => ({ useCentrifugo: () => ({ disconnect: vi.fn() }) }))
    vi.doMock('@/stores/specialtyConfigStore', () => ({
      useSpecialtyConfigStore: () => ({ fetchConfig }),
    }))
    const { useAuthStore } = await import('./authStore')
    const store = useAuthStore()

    await store.fetchUser()

    expect(setTheme).toHaveBeenCalledWith('dark')
    expect(fetchConfig).toHaveBeenCalledWith('cardiology')
  })
})

describe('authStore — trial / grace / cancel derivations', () => {
  it('isPro mirrors clinic plan', async () => {
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: makeClinicContext({ plan: 'free' }) }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.isPro).toBe(false)
  })

  it('trialDaysLeft computes ceil(diff/day) and clamps at zero', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T00:00:00Z'))

    try {
      const future = new Date(Date.now() + 3.2 * 24 * 60 * 60 * 1000).toISOString()
      const past = new Date(Date.now() - 1000 * 60 * 60).toISOString()
      const api = makeAuthApi({
        me: vi.fn().mockResolvedValue({
          data: makeUser({
            current_clinic: makeClinicContext({ is_trial: true, trial_ends_at: future }),
          }),
          meta: { memberships: [makeMembership()] },
        }),
      })
      const { useAuthStore } = await loadStore(api)
      const store = useAuthStore()
      await store.fetchUser()

      expect(store.isOnTrial).toBe(true)
      expect(store.trialDaysLeft).toBe(4) // ceil(3.2)

      store.user = makeUser({
        current_clinic: makeClinicContext({ is_trial: true, trial_ends_at: past }),
      })
      expect(store.trialDaysLeft).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('isInGracePeriod / willCancel mirror clinic flags', async () => {
    const meResp: MeResponse = {
      data: makeUser({
        current_clinic: makeClinicContext({
          is_in_grace_period: true,
          cancel_at_period_end: true,
          billing_period_ends_at: '2026-05-30T00:00:00Z',
        }),
      }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({ me: vi.fn().mockResolvedValue(meResp) })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()

    expect(store.isInGracePeriod).toBe(true)
    expect(store.willCancel).toBe(true)
    expect(store.billingPeriodEnd).toBe('2026-05-30T00:00:00Z')
  })
})

describe('authStore — silentRefresh', () => {
  it('returns true and refreshes user on success', async () => {
    const meResp: MeResponse = {
      data: makeUser({ current_clinic: makeClinicContext() }),
      meta: { memberships: [makeMembership()] },
    }
    const api = makeAuthApi({
      refresh: vi.fn().mockResolvedValue({ data: { access_token: 'new-tok', token_type: 'Bearer', expires_in: 3600 } }),
      me: vi.fn().mockResolvedValue(meResp),
    })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    const ok = await store.silentRefresh()

    expect(ok).toBe(true)
    expect(api.me).toHaveBeenCalled()
    expect(store.token).toBe('new-tok')
  })

  it('returns false when refresh throws (does not crash)', async () => {
    const api = makeAuthApi({
      refresh: vi.fn().mockRejectedValue(new Error('refresh failed')),
    })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    const ok = await store.silentRefresh()

    expect(ok).toBe(false)
    expect(store.token).toBeNull()
  })
})

describe('authStore — logout', () => {
  it('clears token, user, memberships and calls API', async () => {
    const api = makeAuthApi({
      me: vi.fn().mockResolvedValue({
        data: makeUser({ current_clinic: makeClinicContext() }),
        meta: { memberships: [makeMembership()] },
      }),
    })
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()
    await store.fetchUser()
    expect(store.user).not.toBeNull()

    // Stub indexedDB.deleteDatabase so logout doesn't try to talk to the
    // real (or fake) IDB.
    vi.stubGlobal('indexedDB', { deleteDatabase: vi.fn() })

    store.setToken('tok')
    await store.logout()

    expect(api.logout).toHaveBeenCalled()
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.memberships).toEqual([])
    expect(store.isAuthenticated).toBe(false)
  })

  it('still clears local state when broadcast and indexedDB cleanup are unavailable', async () => {
    const api = makeAuthApi()
    const { useAuthStore } = await loadStore(api)
    const store = useAuthStore()

    store.user = makeUser({ current_clinic: makeClinicContext() })
    store.memberships = [makeMembership()]
    store.setToken('tok')
    vi.stubGlobal('BroadcastChannel', vi.fn(() => {
      throw new Error('not supported')
    }))
    vi.stubGlobal('indexedDB', {
      deleteDatabase: vi.fn(() => {
        throw new Error('not supported')
      }),
    })

    await store.logout()

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.memberships).toEqual([])
  })
})
