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
      return { label: 'Unpaid', variant: 'destructive' as const, class: '' }
    case 'partial':
      return { label: 'Partial', variant: 'outline' as const, class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' }
    case 'paid':
      return { label: 'Paid', variant: 'outline' as const, class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' }
    case 'void':
      return { label: 'Void', variant: 'secondary' as const, class: '' }
    default:
      return { label: props.status, variant: 'outline' as const, class: '' }
  }
})
</script>

<template>
  <Badge :variant="config.variant" :class="config.class">
    {{ config.label }}
  </Badge>
</template>
