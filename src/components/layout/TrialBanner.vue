<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Crown, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { RouteNames } from '@/router/routeNames'

const router = useRouter()
const authStore = useAuthStore()
const dismissed = ref(false)

const show = computed(() =>
  !dismissed.value
  && authStore.isOnTrial
  && authStore.trialDaysLeft <= 7
  && authStore.trialDaysLeft > 0,
)

const message = computed(() => {
  const days = authStore.trialDaysLeft
  if (days === 1) return 'Your Pro trial ends tomorrow.'
  return `Your Pro trial ends in ${days} days.`
})
</script>

<template>
  <div
    v-if="show"
    class="flex items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2 dark:bg-amber-950/30"
  >
    <div class="flex items-center gap-2 text-sm">
      <Crown class="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span class="text-amber-800 dark:text-amber-200">
        {{ message }}
        <span class="font-medium">Upgrade now to keep all Pro features.</span>
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Button size="sm" class="h-7 gap-1.5 text-xs" @click="router.push({ name: RouteNames.SUBSCRIPTION })">
        <Crown class="size-3" />
        Upgrade
      </Button>
      <button
        type="button"
        class="rounded p-0.5 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
        @click="dismissed = true"
      >
        <X class="size-3.5" />
      </button>
    </div>
  </div>
</template>
