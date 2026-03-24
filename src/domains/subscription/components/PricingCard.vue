<script setup lang="ts">
import { Crown, Check, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuthStore } from '@/domains/auth/stores/authStore'

defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  upgrade: []
}>()

const authStore = useAuthStore()

const features = [
  'Messages & Chat',
  'Appointments & Schedule',
  'Lab Orders & Services',
  'Audit Logs',
  'Custom Roles',
  'Queue Display (TV)',
  'Unlimited PDF Generation',
  'Unlimited Team Members',
]
</script>

<template>
  <Card class="border-amber-200 dark:border-amber-800/50">
    <CardHeader class="text-center pb-2">
      <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Crown class="size-6 text-amber-600 dark:text-amber-400" />
      </div>
      <CardTitle class="text-xl">MediFlow Pro</CardTitle>
      <CardDescription>
        Unlock all premium features for your clinic
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="text-center">
        <span class="text-4xl font-bold">PHP 1,299</span>
        <span class="text-muted-foreground">/month</span>
      </div>

      <div class="grid gap-2">
        <div v-for="feat in features" :key="feat" class="flex items-center gap-2 text-sm">
          <Check class="size-4 text-green-600 dark:text-green-400 shrink-0" />
          <span>{{ feat }}</span>
        </div>
      </div>

      <div class="text-center">
        <p v-if="authStore.isOnTrial" class="mb-3 text-sm text-amber-600 dark:text-amber-400 font-medium">
          Your trial ends in {{ authStore.trialDaysLeft }} day{{ authStore.trialDaysLeft === 1 ? '' : 's' }}.
          Subscribe to keep Pro features.
        </p>
        <Button
          class="w-full gap-2"
          size="lg"
          :disabled="loading"
          @click="emit('upgrade')"
        >
          <Loader2 v-if="loading" class="size-4 animate-spin" />
          <Crown v-else class="size-4" />
          {{ authStore.isOnTrial ? 'Subscribe Now' : 'Upgrade to Pro' }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
