<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import type { PatientStatus } from '../types/patient.types'

const props = defineProps<{
  status: PatientStatus
}>()

const config = computed(() => {
  switch (props.status) {
    case 'new':
      return { label: 'New', class: 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400' }
    case 'active':
      return { label: 'Active', class: 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400' }
    case 'inactive':
      return { label: 'Inactive', class: 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400' }
    case 'returning':
      return { label: 'Returning', class: 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400' }
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
