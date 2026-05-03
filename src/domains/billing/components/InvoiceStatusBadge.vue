<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import type { InvoiceStatus } from '../types/billing.types'

const props = defineProps<{
  status: InvoiceStatus
}>()

const config = computed(() => {
  switch (props.status) {
    case 'unpaid':
      return { label: 'Unpaid', variant: 'outline' as const, class: 'bg-rose-100/70 text-rose-700 dark:bg-rose-400/12 dark:text-rose-300' }
    case 'partial':
      return { label: 'Partial', variant: 'outline' as const, class: 'bg-amber-100/70 text-amber-700 dark:bg-amber-400/12 dark:text-amber-300' }
    case 'paid':
      return { label: 'Paid', variant: 'outline' as const, class: 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300' }
    case 'void':
      return { label: 'Void', variant: 'outline' as const, class: 'bg-slate-100/70 text-slate-600 dark:bg-white/8 dark:text-slate-300' }
    default:
      return { label: props.status, variant: 'outline' as const, class: '' }
  }
})
</script>

<template>
  <Badge
    :variant="config.variant"
    :class="[
      'min-h-6 rounded-full border-white/50 px-2.5 text-xs font-bold shadow-none backdrop-blur-md dark:border-white/10',
      config.class,
    ]"
  >
    {{ config.label }}
  </Badge>
</template>
