import { computed, ref, watchEffect } from 'vue'
import { authApi } from '@/domains/auth/api/authApi'

type Theme = 'light' | 'dark'

const theme = ref<Theme>((localStorage.getItem('theme') as Theme) ?? 'light')

watchEffect(() => {
  const root = document.documentElement
  if (theme.value === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  localStorage.setItem('theme', theme.value)
})

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')

  function setTheme(value: Theme) {
    theme.value = value
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    authApi.updatePreferences({ theme: theme.value }).catch(() => {})
  }

  return { theme, isDark, setTheme, toggleTheme }
}
