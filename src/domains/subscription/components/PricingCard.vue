<script setup lang="ts">
import { computed } from 'vue'
import { Crown, Check, Loader2, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { CheckoutPlan } from '../types/subscription.types'

const props = withDefaults(defineProps<{
  variant?: CheckoutPlan
  loading?: boolean
  featured?: boolean
}>(), {
  variant: 'pro',
  loading: false,
  featured: false,
})

const emit = defineEmits<{
  upgrade: [plan: CheckoutPlan]
}>()

const authStore = useAuthStore()

const meta = computed(() => {
  if (props.variant === 'max') {
    return {
      title: 'MediFlow Max',
      tagline: 'Multi-doctor clinics, up to 6 practising doctors.',
      price: 'PHP 4,999',
      icon: Sparkles,
      features: [
        'Everything in Pro',
        'Up to 6 practising doctors (owner + 5)',
        'Multi-doctor scheduling and queue routing',
        'Per-doctor activity and revenue reports',
        'Priority email and chat support',
      ],
    }
  }
  return {
    title: 'MediFlow Pro',
    tagline: 'Solo practice, up to 2 practising doctors.',
    price: 'PHP 1,499',
    icon: Crown,
    features: [
      'Patients, consultations, queue, billing, prescriptions',
      'Up to 2 practising doctors (owner + 1)',
      'Messages, appointments, schedules',
      'Lab orders + lab services catalog',
      'Specialty workflows (FM, IM, Peds, OB-GYN, Dental)',
      'Audit logs, custom roles, queue display',
      'Unlimited PDFs, no watermark',
      'Unlimited non-doctor staff',
    ],
  }
})

const ctaLabel = computed(() => {
  if (authStore.isOnTrial && props.variant === 'pro') return 'Subscribe Now'
  return `Upgrade to ${props.variant === 'max' ? 'Max' : 'Pro'}`
})
</script>

<template>
  <Card
    :class="featured
      ? 'border-amber-200 dark:border-amber-800/50 shadow-md'
      : ''"
  >
    <CardHeader class="text-center pb-2">
      <div
        class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full"
        :class="variant === 'max'
          ? 'bg-gradient-to-br from-amber-100 to-teal-100 dark:from-amber-900/30 dark:to-teal-900/30'
          : 'bg-amber-100 dark:bg-amber-900/30'"
      >
        <component :is="meta.icon" class="size-6 text-amber-600 dark:text-amber-400" />
      </div>
      <CardTitle class="text-xl">{{ meta.title }}</CardTitle>
      <CardDescription>{{ meta.tagline }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="text-center">
        <span class="text-4xl font-bold">{{ meta.price }}</span>
        <span class="text-muted-foreground">/month</span>
      </div>

      <div class="grid gap-2">
        <div v-for="feat in meta.features" :key="feat" class="flex items-start gap-2 text-sm">
          <Check class="size-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <span>{{ feat }}</span>
        </div>
      </div>

      <div class="text-center">
        <p
          v-if="authStore.isOnTrial && variant === 'pro'"
          class="mb-3 text-sm text-amber-600 dark:text-amber-400 font-medium"
        >
          Your trial ends in {{ authStore.trialDaysLeft }} day{{ authStore.trialDaysLeft === 1 ? '' : 's' }}.
          Subscribe to keep Pro features.
        </p>
        <Button
          class="w-full gap-2"
          size="lg"
          :disabled="loading"
          @click="emit('upgrade', variant)"
        >
          <Loader2 v-if="loading" class="size-4 animate-spin" />
          <component :is="meta.icon" v-else class="size-4" />
          {{ ctaLabel }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
