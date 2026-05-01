<script setup lang="ts">
import type { Component } from 'vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'

const props = defineProps<{
  label: string
  value: string | number
  icon: Component
  colorClass: 'stat-blue' | 'stat-green' | 'stat-purple' | 'stat-orange'
  loading: boolean
}>()

const iconBgClass: Record<typeof props.colorClass, string> = {
  'stat-blue': 'bg-stat-blue/10',
  'stat-green': 'bg-stat-green/10',
  'stat-purple': 'bg-stat-purple/10',
  'stat-orange': 'bg-stat-orange/10',
}

const iconColorClass: Record<typeof props.colorClass, string> = {
  'stat-blue': 'text-stat-blue',
  'stat-green': 'text-stat-green',
  'stat-purple': 'text-stat-purple',
  'stat-orange': 'text-stat-orange',
}
</script>

<template>
  <div class="surface-card h-full rounded-xl border p-6 text-card-foreground">
    <div class="flex items-start justify-between">
      <div class="flex flex-col gap-3">
        <span class="text-sm font-medium text-muted-foreground">{{ label }}</span>
        <Skeleton v-if="loading" class="h-9 w-20" />
        <span v-else class="text-3xl font-bold tabular-nums">{{ value }}</span>
      </div>
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-lg"
        :class="iconBgClass[colorClass]"
      >
        <component :is="icon" class="size-5" :class="iconColorClass[colorClass]" />
      </div>
    </div>
  </div>
</template>
