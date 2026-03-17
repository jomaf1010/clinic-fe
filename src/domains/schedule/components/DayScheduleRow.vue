<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import BreakEditor from './BreakEditor.vue'
import type { Break, DaySchedule } from '../types/schedule.types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const props = defineProps<{
  day: DaySchedule
}>()

const emit = defineEmits<{
  'update:day': [value: DaySchedule]
}>()

function toggleEnabled(checked: boolean | string) {
  emit('update:day', { ...props.day, enabled: Boolean(checked) })
}

function updateField(field: 'start_time' | 'end_time', value: string) {
  emit('update:day', { ...props.day, [field]: value })
}

function updateBreaks(breaks: Break[]) {
  emit('update:day', { ...props.day, breaks })
}
</script>

<template>
  <div
    class="rounded-lg border p-3 transition-colors"
    :class="day.enabled ? 'border-border bg-background' : 'border-border/50 bg-muted/20'"
  >
    <!-- Row header: day name + toggle -->
    <div class="flex items-center gap-3">
      <Checkbox
        :id="`day-${day.day}`"
        :model-value="Boolean(day.enabled)"
        @update:model-value="toggleEnabled"
      />
      <Label
        :for="`day-${day.day}`"
        class="w-24 cursor-pointer select-none font-medium"
        :class="day.enabled ? 'text-foreground' : 'text-muted-foreground'"
      >
        {{ DAY_NAMES[day.day] }}
      </Label>

      <template v-if="day.enabled">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1.5">
            <Label class="text-xs text-muted-foreground">From</Label>
            <Input
              type="time"
              :model-value="day.start_time"
              class="h-7 w-28 text-xs"
              @update:model-value="updateField('start_time', String($event))"
            />
          </div>
          <div class="flex items-center gap-1.5">
            <Label class="text-xs text-muted-foreground">To</Label>
            <Input
              type="time"
              :model-value="day.end_time"
              class="h-7 w-28 text-xs"
              @update:model-value="updateField('end_time', String($event))"
            />
          </div>
        </div>
      </template>

      <span v-else class="text-sm text-muted-foreground">Day off</span>
    </div>

    <!-- Breaks (only when enabled) -->
    <div v-if="day.enabled" class="mt-1 pl-7">
      <BreakEditor
        :breaks="day.breaks"
        :day-start="day.start_time"
        :day-end="day.end_time"
        @update:breaks="updateBreaks"
      />
    </div>
  </div>
</template>
