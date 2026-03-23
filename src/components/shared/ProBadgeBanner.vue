<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles, Clock } from 'lucide-vue-next'
import { useAuthStore } from '@/domains/auth/stores/authStore'

const authStore = useAuthStore()

const isPro = computed(() => authStore.isPro)
const isOnTrial = computed(() => authStore.isOnTrial)
const trialDaysLeft = computed(() => authStore.trialDaysLeft)
const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? 'Your Clinic')
</script>

<template>
  <!-- Pro (paid) -->
  <div v-if="isPro && !isOnTrial" class="relative overflow-hidden rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:border-amber-800/40 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-amber-950/40">
    <div class="flex items-center gap-4 px-5 py-2.5">
      <img src="/images/pro-badge.svg" alt="Pro" class="size-8 shrink-0 drop-shadow-sm" />
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-amber-900 dark:text-amber-100">{{ clinicName }}</span>
          <span class="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            <Sparkles class="size-2.5" />
            Pro
          </span>
        </div>
        <p class="text-xs text-amber-600/80 dark:text-amber-400/70">
          All premium features unlocked
        </p>
      </div>
    </div>
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5" />
  </div>

  <!-- Trial -->
  <div v-else-if="isPro && isOnTrial" class="rounded-xl border border-sky-200/60 bg-gradient-to-r from-sky-50/80 to-indigo-50/50 dark:border-sky-800/40 dark:from-sky-950/30 dark:to-indigo-950/20">
    <div class="flex items-center gap-4 px-5 py-2.5">
      <img src="/images/pro-badge.svg" alt="Pro" class="size-8 shrink-0 opacity-70" />
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-sky-900 dark:text-sky-100">{{ clinicName }}</span>
          <span class="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-sky-300 bg-sky-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-sky-700 dark:border-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
            Trial
          </span>
        </div>
        <p class="text-xs text-sky-600/80 dark:text-sky-400/70">
          Pro features active &middot; {{ trialDaysLeft }} day{{ trialDaysLeft === 1 ? '' : 's' }} remaining
        </p>
      </div>
      <button type="button" class="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600">
        Upgrade
      </button>
    </div>
  </div>
</template>
