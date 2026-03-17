<script setup lang="ts">
import { CalendarX, LoaderCircle, Pencil, Trash2 } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BlockType, CalendarBlock } from '../types/schedule.types'

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  leave: 'Leave',
  meeting: 'Meeting',
  holiday: 'Holiday',
  personal: 'Personal',
  unavailable: 'Unavailable',
}

const BLOCK_TYPE_CLASSES: Record<BlockType, string> = {
  leave: 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400',
  meeting: 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400',
  holiday: 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400',
  personal: 'border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-400',
  unavailable: 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400',
}

const props = defineProps<{
  blocks: CalendarBlock[]
  isLoading: boolean
  timezone?: string
}>()

const emit = defineEmits<{
  edit: [block: CalendarBlock]
  delete: [id: string]
}>()

function formatInTimezone(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const tz = props.timezone || 'Asia/Manila'
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
  const timeStr = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
  return { date: dateStr, time: timeStr }
}

function formatDateRange(block: CalendarBlock): string {
  const s = formatInTimezone(block.start)
  const e = formatInTimezone(block.end)

  if (block.all_day) {
    return s.date === e.date ? s.date : `${s.date} – ${e.date}`
  }

  if (s.date === e.date) {
    return `${s.date} ${s.time} – ${e.time}`
  }
  return `${s.date} ${s.time} – ${e.date} ${e.time}`
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
      v-else-if="blocks.length === 0"
      class="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground"
    >
      <CalendarX class="size-10 opacity-40" />
      <p class="text-sm">No calendar blocks for this period.</p>
    </div>

    <!-- List -->
    <div v-else class="divide-y">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="flex items-start gap-3 px-1 py-3"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ block.title }}</span>
            <Badge variant="outline" :class="BLOCK_TYPE_CLASSES[block.type]">
              {{ BLOCK_TYPE_LABELS[block.type] }}
            </Badge>
            <Badge v-if="block.all_day" variant="outline" class="text-xs">
              All day
            </Badge>
            <Badge v-if="block.recurring" variant="outline" class="text-xs">
              Daily
            </Badge>
          </div>
          <p class="mt-0.5 text-sm text-muted-foreground">{{ formatDateRange(block) }}</p>
          <p v-if="block.notes" class="mt-0.5 text-xs text-muted-foreground">{{ block.notes }}</p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Edit block"
            @click="emit('edit', block)"
          >
            <Pencil class="size-3.5" />
          </button>
          <button
            type="button"
            class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete block"
            @click="emit('delete', block.id)"
          >
            <Trash2 class="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
