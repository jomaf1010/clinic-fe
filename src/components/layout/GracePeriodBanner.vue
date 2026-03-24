<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { RouteNames } from '@/router/routeNames'

const router = useRouter()
const authStore = useAuthStore()
const dismissed = ref(false)

const show = computed(() =>
  !dismissed.value && authStore.isInGracePeriod,
)
</script>

<template>
  <div
    v-if="show"
    class="flex items-center justify-between gap-3 border-b bg-red-50 px-4 py-2 dark:bg-red-950/30"
  >
    <div class="flex items-center gap-2 text-sm">
      <AlertTriangle class="size-4 text-red-600 dark:text-red-400 shrink-0" />
      <span class="text-red-800 dark:text-red-200">
        Your billing is overdue.
        <span class="font-medium">Renew now to keep Pro features.</span>
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Button
        size="sm"
        variant="destructive"
        class="h-7 text-xs"
        @click="router.push({ name: RouteNames.SUBSCRIPTION })"
      >
        Renew Now
      </Button>
      <button
        type="button"
        class="rounded p-0.5 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
        @click="dismissed = true"
      >
        <X class="size-3.5" />
      </button>
    </div>
  </div>
</template>
