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

  function hasPermission(permission: string): boolean {
    const clinic = currentClinic.value
    if (!clinic) return false
    if (clinic.role === 'owner') return true
    return clinic.permissions?.includes(permission) ?? false
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

  function logout(): void {
    useCentrifugo().disconnect()
    token.value = null
    user.value = null
    memberships.value = []
    localStorage.removeItem(TOKEN_KEY)
  }

  return {
    token,
    user,
    memberships,
    isAuthenticated,
    hasClinicContext,
    currentClinic,
    currentRole,
    needsOnboarding,
    needsClinicSelection,
    hasPermission,
    setToken,
    fetchUser,
    login,
    signup,
    selectClinic,
    logout,
  }
})
