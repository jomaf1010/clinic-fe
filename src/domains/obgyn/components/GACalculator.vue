<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  edd: string
}>()

const ga = computed(() => {
  const eddDate = new Date(props.edd)
  const today = new Date()
  const totalDays = 280 - Math.round((eddDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (totalDays < 0) return null
  const weeks = Math.floor(totalDays / 7)
  const days = totalDays % 7
  return { weeks, days, totalDays }
})

const trimester = computed(() => {
  if (!ga.value) return null
  const { weeks } = ga.value
  if (weeks < 14) return 'First Trimester'
  if (weeks < 28) return 'Second Trimester'
  return 'Third Trimester'
})

const trimesterVariant = computed((): 'default' | 'secondary' | 'outline' => {
  if (!trimester.value) return 'outline'
  if (trimester.value === 'First Trimester') return 'secondary'
  if (trimester.value === 'Second Trimester') return 'default'
  return 'secondary'
})

const weeksToEdd = computed(() => {
  if (!ga.value) return null
  return Math.max(0, 40 - ga.value.weeks)
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div v-if="ga" class="text-xl font-bold tabular-nums">
      {{ ga.weeks }}w {{ ga.days }}d
    </div>
    <div v-else class="text-sm text-muted-foreground">
      GA unavailable
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      <Badge v-if="trimester" :variant="trimesterVariant" class="text-xs">
        {{ trimester }}
      </Badge>
      <span v-if="weeksToEdd !== null" class="text-xs text-muted-foreground">
        {{ weeksToEdd }} week{{ weeksToEdd === 1 ? '' : 's' }} to EDD
      </span>
    </div>
  </div>
</template>
