import { describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import router, { canAccessRequiredPermission } from './index'
import { RouteNames } from './routeNames'

function metaFor(routeName: string) {
  const route = router.getRoutes().find((candidate) => candidate.name === routeName)
  expect(route, `route ${routeName} should exist`).toBeTruthy()
  return route!.meta
}

describe('sensitive route guards', () => {
  it('allows array-based route permissions when the user has any required permission', () => {
    expect(canAccessRequiredPermission(['billing.view', 'billing.view-own'], (permission) => permission === 'billing.view-own')).toBe(true)
    expect(canAccessRequiredPermission(['billing.view', 'billing.view-own'], (permission) => permission === 'patients.view')).toBe(false)
  })

  it('requires billing permissions for the billing route', () => {
    expect(metaFor(RouteNames.BILLING).requiredPermission).toEqual(['billing.view', 'billing.view-own'])
  })

  it('requires patient view permission for patient routes', () => {
    for (const routeName of [
      RouteNames.PATIENT_LIST,
      RouteNames.PATIENT_DETAIL,
      RouteNames.ENCOUNTER_NEW,
      RouteNames.ENCOUNTER_DETAIL,
      RouteNames.PREGNANCY_CREATE,
      RouteNames.PREGNANCY_DETAIL,
      RouteNames.PRENATAL_VISIT_CREATE,
      RouteNames.PRENATAL_VISIT_DETAIL,
    ]) {
      expect(metaFor(routeName).requiredPermission).toBe('patients.view')
    }
  })

  it('requires schedule permission and feature access for the schedule route', () => {
    expect(metaFor(RouteNames.SCHEDULE).requiredPermission).toBe('schedule.view')
    expect(metaFor(RouteNames.SCHEDULE).requiredFeature).toBe('schedule')
  })

  it('requires permissions and features for direct-access operational routes', () => {
    expect(metaFor(RouteNames.APPOINTMENT_LIST).requiredPermission).toBe('appointments.view')
    expect(metaFor(RouteNames.APPOINTMENT_LIST).requiredFeature).toBe('appointments')
    expect(metaFor(RouteNames.QUEUE).requiredPermission).toBe('queue.view')
    expect(metaFor(RouteNames.MESSAGES).requiredPermission).toBe('messages.view')
    expect(metaFor(RouteNames.MESSAGES).requiredFeature).toBe('messages')
  })

  it('requires clinic management for clinic settings access', () => {
    expect(metaFor(RouteNames.CLINIC_SETTINGS).requiredPermission).toBe('clinic.manage')
  })

  it('requires owner-level clinic management for subscription access', () => {
    expect(metaFor(RouteNames.SUBSCRIPTION).requiredPermission).toBe('clinic.manage')
  })

  it('requires clinic management for template list and editor routes', () => {
    expect(metaFor(RouteNames.CLINIC_TEMPLATES).requiredPermission).toBe('clinic.manage')
    expect(metaFor(RouteNames.TEMPLATE_EDITOR).requiredPermission).toBe('clinic.manage')
  })

  it('requires matching permissions and features for clinic inventory/service tabs', () => {
    expect(metaFor(RouteNames.CLINIC_CONSUMABLES).requiredPermission).toBe('consumables.view')
    expect(metaFor(RouteNames.CLINIC_CONSUMABLES).requiredFeature).toBe('consumables')
    expect(metaFor(RouteNames.CLINIC_LAB_SERVICES).requiredPermission).toBe('lab-services.view')
    expect(metaFor(RouteNames.CLINIC_LAB_SERVICES).requiredFeature).toBe('lab_services')
    expect(metaFor(RouteNames.CLINIC_SERVICES).requiredPermission).toBe('lab-services.view')
  })

  it('does not expose the retired odontogram playground route', () => {
    expect(router.getRoutes().some((route) => route.path === '/odontogram')).toBe(false)
    expect(router.getRoutes().some((route) => route.name === 'odontogram-playground')).toBe(false)
  })

  it('redirects authenticated users away from every requiresGuest route', async () => {
    const authStore = useAuthStore()
    authStore.setToken('test-token')
    authStore.user = {
      id: 'user-1',
      name: 'Doctor Test',
      email: 'doctor@example.test',
      email_verified_at: '2026-05-08T00:00:00Z',
      onboarding_completed: true,
      current_clinic: {
        id: 'clinic-1',
        name: 'Test Clinic',
        role: 'owner',
        permissions: [],
        features: [],
        plan: 'pro',
      },
    } as typeof authStore.user
    authStore.memberships = [{ clinic_id: 'clinic-1', status: 'active' }] as typeof authStore.memberships

    for (const routeName of [RouteNames.FORGOT_PASSWORD, RouteNames.RESET_PASSWORD]) {
      await router.push({ name: routeName })

      expect(router.currentRoute.value.name).toBe(RouteNames.HOME)
    }
  })

  it('scrubs legacy queue display path tokens before authenticated refresh can fetch user state', async () => {
    const authStore = useAuthStore()
    authStore.setToken('test-token')
    authStore.user = null
    authStore.memberships = [] as typeof authStore.memberships
    sessionStorage.removeItem('mediflow.queueDisplay.token')
    const fetchUser = vi.spyOn(authStore, 'fetchUser')

    await router.push('/queue-display/legacy-token')

    expect(fetchUser).not.toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/queue-display')
    expect(sessionStorage.getItem('mediflow.queueDisplay.token')).toBe('legacy-token')
  })
})
