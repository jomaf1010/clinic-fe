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
      return { label: 'New', class: 'bg-blue-600/12 text-blue-700 dark:bg-blue-400/14 dark:text-blue-300' }
    case 'active':
      return { label: 'Active', class: 'bg-teal-500/14 text-teal-700 dark:bg-teal-400/14 dark:text-teal-300' }
    case 'inactive':
      return { label: 'Inactive', class: 'bg-slate-500/12 text-slate-600 dark:bg-slate-300/12 dark:text-slate-300' }
    case 'returning':
      return { label: 'Returning', class: 'bg-amber-500/16 text-amber-700 dark:bg-amber-400/16 dark:text-amber-300' }
    default:
      return { label: props.status, class: '' }
  }
})
</script>

<template>
  <Badge
    class="min-h-6 rounded-full border border-white/50 px-2.5 text-xs font-bold shadow-none backdrop-blur-md dark:border-white/10"
    :class="config.class"
  >
    {{ config.label }}
  </Badge>
</template>
