import { computed, ref } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'

export function useFeatureGate(feature: string) {
  const authStore = useAuthStore()
  const hasAccess = computed(() => authStore.hasFeature(feature))
  const showUpgrade = ref(false)

  function guardAction(callback: () => void) {
    if (hasAccess.value) {
      callback()
    } else {
      showUpgrade.value = true
    }
  }

  return { hasAccess, showUpgrade, guardAction }
}
