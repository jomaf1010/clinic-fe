import { computed, ref, watchEffect } from 'vue'

export type SurfaceMode = 'performance' | 'full'

const STORAGE_KEY = 'surface-mode'

function storedSurfaceMode(): SurfaceMode {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'full' || value === 'performance' ? value : 'performance'
}

const surfaceMode = ref<SurfaceMode>(storedSurfaceMode())

watchEffect(() => {
  document.documentElement.dataset.surfaceMode = surfaceMode.value
  localStorage.setItem(STORAGE_KEY, surfaceMode.value)
})

export function useSurfaceMode() {
  const isFullGlass = computed(() => surfaceMode.value === 'full')

  function setSurfaceMode(value: SurfaceMode) {
    surfaceMode.value = value
  }

  function toggleSurfaceMode() {
    surfaceMode.value = surfaceMode.value === 'full' ? 'performance' : 'full'
  }

  return { surfaceMode, isFullGlass, setSurfaceMode, toggleSurfaceMode }
}
