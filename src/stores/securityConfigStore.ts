import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'

export interface SecurityConfig {
  security_min_password_length: number
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  security_min_password_length: 10,
}

export const useSecurityConfigStore = defineStore('securityConfig', () => {
  const config = ref<SecurityConfig>({ ...DEFAULT_SECURITY_CONFIG })

  async function fetchConfig(): Promise<void> {
    try {
      const response = await http.get<SecurityConfig>('/security-config')
      config.value = { ...DEFAULT_SECURITY_CONFIG, ...response }
    } catch {
      // silently fall back to defaults
    }
  }

  return { config, fetchConfig }
})
