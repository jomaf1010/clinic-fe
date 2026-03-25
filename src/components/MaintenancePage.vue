<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Construction, RefreshCw, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import AppLogo from '@/components/AppLogo.vue'
import { isMaintenanceMode } from '@/lib/http'

const isChecking = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

const BASE_URL = import.meta.env.VITE_API_URL as string

async function checkStatus() {
  isChecking.value = true
  try {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (response.status !== 503) {
      isMaintenanceMode.value = false
      window.location.reload()
    }
  } catch {
    // Server unreachable, still in maintenance
  } finally {
    isChecking.value = false
  }
}

onMounted(() => {
  // Auto-check every 30 seconds
  interval = setInterval(checkStatus, 30000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
    <div class="w-full max-w-md text-center">
      <AppLogo class="mx-auto mb-8 h-20 w-auto" />

      <div class="rounded-xl border bg-card p-8 shadow-sm">
        <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-500/10">
          <Construction class="size-8 text-amber-500" />
        </div>

        <h1 class="text-2xl font-bold tracking-tight">Under Maintenance</h1>
        <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
          We're performing scheduled maintenance to improve your experience. This won't take long — please check back shortly.
        </p>

        <Button
          variant="outline"
          class="mt-6 w-full"
          :disabled="isChecking"
          @click="checkStatus"
        >
          <LoaderCircle v-if="isChecking" class="size-4 animate-spin" />
          <RefreshCw v-else class="size-4" />
          {{ isChecking ? 'Checking...' : 'Check again' }}
        </Button>
      </div>

      <p class="mt-6 text-xs text-muted-foreground">
        If the issue persists, please contact support.
      </p>
    </div>
  </div>
</template>
