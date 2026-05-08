import { describe, expect, it } from 'vitest'
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

  it('requires owner-level clinic management for subscription access', () => {
    expect(metaFor(RouteNames.SUBSCRIPTION).requiredPermission).toBe('clinic.manage')
  })

  it('requires clinic management for template list and editor routes', () => {
    expect(metaFor(RouteNames.CLINIC_TEMPLATES).requiredPermission).toBe('clinic.manage')
    expect(metaFor(RouteNames.TEMPLATE_EDITOR).requiredPermission).toBe('clinic.manage')
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
})
