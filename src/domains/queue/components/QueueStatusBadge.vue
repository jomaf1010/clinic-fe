<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import type { QueueVisitStatus } from '../types/queue.types'

const props = defineProps<{
  status: QueueVisitStatus
}>()

const config = computed(() => {
  switch (props.status) {
    case 'waiting':
      return {
        label: 'Waiting',
        class:
          'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400',
      }
    case 'in_progress':
      return {
        label: 'In Progress',
        class:
          'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400',
      }
    case 'completed':
      return {
        label: 'Completed',
        class:
          'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        class:
          'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
      }
    default:
      return { label: props.status, class: '' }
  }
})
</script>

<template>
  <Badge variant="outline" :class="config.class">
    {{ config.label }}
  </Badge>
</template>
