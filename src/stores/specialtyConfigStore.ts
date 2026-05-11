import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'
import type { SpecialtyConfig } from '@/domains/specialty/types/specialty.types'

export const useSpecialtyConfigStore = defineStore('specialtyConfig', () => {
  const config = ref<SpecialtyConfig | null>(null)
  const isLoading = ref(false)

  async function fetchConfig(specialtyKey: string): Promise<void> {
    if (config.value?.key === specialtyKey) return
    isLoading.value = true
    try {
      const response = await http.get<{ data: SpecialtyConfig }>(`/specialties/${specialtyKey}`)
      config.value = response.data
    } catch {
      // silently fall back to defaults
      config.value = null
    } finally {
      isLoading.value = false
    }
  }

  return { config, isLoading, fetchConfig }
})
