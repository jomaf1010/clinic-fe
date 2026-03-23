<script setup lang="ts">
import { computed } from 'vue'
import { Crown, Check, Lock } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/domains/auth/stores/authStore'

const props = withDefaults(defineProps<{
  open?: boolean
  feature?: string
  inline?: boolean
}>(), {
  open: false,
  inline: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const authStore = useAuthStore()

const trialText = computed(() => {
  if (!authStore.isOnTrial) return null
  const days = authStore.trialDaysLeft
  return days > 0 ? `Your Pro trial ends in ${days} day${days === 1 ? '' : 's'}.` : 'Your Pro trial has expired.'
})

const proFeatures = [
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
  <!-- Inline variant -->
  <div v-if="inline" class="flex flex-col items-center justify-center gap-6 py-16 px-4">
    <div class="flex size-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
      <Lock class="size-7 text-amber-600 dark:text-amber-400" />
    </div>
    <div class="text-center">
      <h3 class="text-lg font-semibold">Pro Feature</h3>
      <p class="mt-1 text-sm text-muted-foreground max-w-sm">
        {{ feature ? `The ${feature} feature is` : 'This feature is' }} available on the Pro plan.
        Upgrade to unlock all premium features.
      </p>
      <p v-if="trialText" class="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
        {{ trialText }}
      </p>
    </div>
    <div class="flex flex-col gap-2 text-sm">
      <div v-for="feat in proFeatures" :key="feat" class="flex items-center gap-2">
        <Check class="size-4 text-green-600 dark:text-green-400 shrink-0" />
        <span>{{ feat }}</span>
      </div>
    </div>
    <Button class="gap-2">
      <Crown class="size-4" />
      Upgrade to Pro
    </Button>
  </div>

  <!-- Dialog variant -->
  <Dialog v-else :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Crown class="size-5 text-amber-500" />
          Upgrade to Pro
        </DialogTitle>
        <DialogDescription>
          {{ feature ? `The ${feature} feature is` : 'This feature is' }} available on the Pro plan.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <p v-if="trialText" class="text-sm text-amber-600 dark:text-amber-400 font-medium">
          {{ trialText }}
        </p>

        <div class="grid grid-cols-1 gap-1.5 text-sm">
          <div v-for="feat in proFeatures" :key="feat" class="flex items-center gap-2">
            <Check class="size-3.5 text-green-600 dark:text-green-400 shrink-0" />
            <span>{{ feat }}</span>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button variant="outline" @click="emit('update:open', false)">
          Maybe Later
        </Button>
        <Button class="gap-2">
          <Crown class="size-4" />
          Upgrade
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
