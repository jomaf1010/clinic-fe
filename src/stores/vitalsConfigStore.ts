import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'
import { DEFAULT_VITALS_CONFIG, type VitalsConfig } from '@/lib/vitals'

export const useVitalsConfigStore = defineStore('vitalsConfig', () => {
  const config = ref<VitalsConfig>({ ...DEFAULT_VITALS_CONFIG })

  async function fetchConfig(): Promise<void> {
    try {
      const response = await http.get<VitalsConfig>('/vitals-config')
      config.value = { ...DEFAULT_VITALS_CONFIG, ...response }
    } catch {
      // silently fall back to defaults
    }
  }

  return { config, fetchConfig }
})
