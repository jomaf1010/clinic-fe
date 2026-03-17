<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import type { AppointmentStatus } from '../types/appointment.types'

const props = defineProps<{
  status: AppointmentStatus
}>()

const config = computed(() => {
  switch (props.status) {
    case 'scheduled':
      return {
        label: 'Scheduled',
        class:
          'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400',
      }
    case 'checked_in':
      return {
        label: 'Checked In',
        class:
          'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
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
    case 'no_show':
      return {
        label: 'No Show',
        class:
          'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400',
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
