<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Break } from '../types/schedule.types'

const props = defineProps<{
  breaks: Break[]
  dayStart: string
  dayEnd: string
}>()

const emit = defineEmits<{
  'update:breaks': [value: Break[]]
}>()

function addBreak() {
  emit('update:breaks', [
    ...props.breaks,
    { label: 'Break', start_time: props.dayStart, end_time: props.dayStart },
  ])
}

function removeBreak(index: number) {
  const updated = [...props.breaks]
  updated.splice(index, 1)
  emit('update:breaks', updated)
}

function updateBreak(index: number, field: keyof Break, value: string) {
  const updated = props.breaks.map((b, i) => (i === index ? { ...b, [field]: value } : b))
  emit('update:breaks', updated)
}
</script>

<template>
  <div class="mt-2 space-y-2">
    <div v-if="breaks.length > 0" class="space-y-2">
      <div
        v-for="(brk, index) in breaks"
        :key="index"
        class="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2"
      >
        <div class="min-w-[100px] flex-1">
          <Label class="mb-1 text-xs text-muted-foreground">Label</Label>
          <Input
            :model-value="brk.label"
            placeholder="e.g. Lunch"
            class="h-7 text-xs"
            @update:model-value="updateBreak(index, 'label', String($event))"
          />
        </div>
        <div class="w-24">
          <Label class="mb-1 text-xs text-muted-foreground">Start</Label>
          <Input
            type="time"
            :model-value="brk.start_time"
            class="h-7 text-xs"
            @update:model-value="updateBreak(index, 'start_time', String($event))"
          />
        </div>
        <div class="w-24">
          <Label class="mb-1 text-xs text-muted-foreground">End</Label>
          <Input
            type="time"
            :model-value="brk.end_time"
            class="h-7 text-xs"
            @update:model-value="updateBreak(index, 'end_time', String($event))"
          />
        </div>
        <button
          type="button"
          class="mb-0.5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove break"
          @click="removeBreak(index)"
        >
          <X class="size-3.5" />
        </button>
      </div>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="h-7 px-2 text-xs text-muted-foreground"
      @click="addBreak"
    >
      <Plus class="size-3" />
      Add break
    </Button>
  </div>
</template>
