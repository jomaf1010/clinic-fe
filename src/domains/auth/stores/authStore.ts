import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { authApi } from '../api/authApi'
import type { ClinicContext, LoginCredentials, Membership, SignupCredentials, User } from '../types/auth.types'

const TOKEN_KEY = 'auth_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<User | null>(null)
  const memberships = ref<Membership[]>([])

  const isAuthenticated = computed(() => token.value !== null)

  const hasClinicContext = computed(
    () => user.value?.current_clinic !== null && user.value?.current_clinic !== undefined,
  )

  const currentClinic = computed<ClinicContext | null>(() => user.value?.current_clinic ?? null)

  const currentRole = computed<string | null>(() => user.value?.current_clinic?.role ?? null)

  const needsOnboarding = computed(
    () => memberships.value.length === 0 && user.value?.onboarding_completed === false,
  )

  const needsClinicSelection = computed(
    () => memberships.value.length > 0 && !hasClinicContext.value,
  )

  const isPro = computed(() => currentClinic.value?.plan === 'pro')

  const isOnTrial = computed(() => currentClinic.value?.is_trial ?? false)

  const trialDaysLeft = computed(() => {
    const endsAt = currentClinic.value?.trial_ends_at
    if (!endsAt) return 0
    const diff = new Date(endsAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })

  function hasPermission(permission: string): boolean {
    const clinic = currentClinic.value
    if (!clinic) return false
    if (clinic.role === 'owner') return true
    return clinic.permissions?.includes(permission) ?? false
  }

  function hasFeature(feature: string): boolean {
    return currentClinic.value?.features?.includes(feature) ?? false
  }

  function getLimit(key: 'team_members' | 'pdf_generation_daily') {
    const limit = currentClinic.value?.limits?.[key]
    const max = limit?.max ?? null
    const used = limit?.used ?? 0
    return { max, used, remaining: max === null ? null : Math.max(0, max - used) }
  }

  function setToken(newToken: string): void {
    token.value = newToken
    localStorage.setItem(TOKEN_KEY, newToken)
  }

  async function fetchUser(): Promise<void> {
    const response = await authApi.me()
    user.value = response.data
    memberships.value = response.meta.memberships
    if (response.data.theme) {
      useTheme().setTheme(response.data.theme)
    }
  }

  async function selectClinic(clinicId: string): Promise<void> {
    const response = await authApi.selectClinic(clinicId)
    setToken(response.data.access_token)
    await fetchUser()
  }

  async function login(credentials: LoginCredentials): Promise<void> {
    const response = await authApi.login(credentials)
    setToken(response.data.access_token)
    memberships.value = response.meta.memberships
    const activeMemberships = response.meta.memberships.filter((m) => m.status === 'active')
    if (activeMemberships.length === 1) {
      await selectClinic(activeMemberships[0]!.clinic_id)
    } else if (activeMemberships.length === 0 && response.meta.memberships.length === 0) {
      // No memberships at all — will trigger onboarding
      await fetchUser()
    } else {
      await fetchUser()
    }
  }

  async function signup(credentials: SignupCredentials): Promise<void> {
    await authApi.signup(credentials)
  }

  async function logout(): Promise<void> {
    await authApi.logout()
    useCentrifugo().disconnect()
    try {
      const channel = new BroadcastChannel('auth_token_sync')
      channel.postMessage({ type: 'logged_out' })
      channel.close()
    } catch {
      // BroadcastChannel not supported — fine
    }
    token.value = null
    user.value = null
    memberships.value = []
    localStorage.removeItem(TOKEN_KEY)
  }

  async function silentRefresh(): Promise<boolean> {
    try {
      const response = await authApi.refresh()
      setToken(response.data.access_token)
      await fetchUser()
      return true
    } catch {
      return false
    }
  }

  return {
    token,
    user,
    memberships,
    isAuthenticated,
    hasClinicContext,
    currentClinic,
    currentRole,
    isPro,
    isOnTrial,
    trialDaysLeft,
    needsOnboarding,
    needsClinicSelection,
    hasPermission,
    hasFeature,
    getLimit,
    setToken,
    fetchUser,
    login,
    signup,
    selectClinic,
    logout,
    silentRefresh,
  }
})
