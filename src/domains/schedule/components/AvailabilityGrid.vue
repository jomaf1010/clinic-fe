<script setup lang="ts">
import { LoaderCircle, Clock } from 'lucide-vue-next'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Slot } from '../types/schedule.types'

defineProps<{
  slots: Slot[]
  isLoading: boolean
}>()

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
}

function slotLabel(slot: Slot): string {
  return `${formatTime(slot.start)} – ${formatTime(slot.end)}`
}

function unavailableReason(slot: Slot): string {
  if (slot.reason === 'break') return slot.label ? `Break: ${slot.label}` : 'Break'
  if (slot.reason === 'block') return slot.block_title ? `Blocked: ${slot.block_title}` : 'Blocked'
  return 'Unavailable'
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="slots.length === 0"
      class="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground"
    >
      <Clock class="size-10 opacity-40" />
      <p class="text-sm">No availability data for this date.</p>
    </div>

    <!-- Grid -->
    <TooltipProvider v-else :delay-duration="200">
      <div class="flex flex-wrap gap-2">
        <Tooltip
          v-for="slot in slots"
          :key="slot.start"
        >
          <TooltipTrigger as-child>
            <div
              class="flex cursor-default items-center justify-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
              :class="slot.available
                ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
                : 'border-border bg-muted/50 text-muted-foreground line-through'"
            >
              {{ slotLabel(slot) }}
            </div>
          </TooltipTrigger>
          <TooltipContent v-if="!slot.available">
            <p>{{ unavailableReason(slot) }}</p>
          </TooltipContent>
          <TooltipContent v-else>
            <p>Available</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- Legend -->
      <div class="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-950" />
          Available
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border bg-muted/50" />
          Unavailable
        </div>
      </div>
    </TooltipProvider>
  </div>
</template>
