<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { CalendarIcon, Clock, LoaderCircle } from 'lucide-vue-next'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import type { Slot } from '@/domains/schedule/types/schedule.types'

const props = defineProps<{
  doctorId: string | null
  modelValue: string | null
  duration?: number | null // total minutes
  initialDate?: string // ISO date "2026-03-27"
  autoSelectTime?: string // ISO datetime — auto-select matching slot after load
  allowDurationSelection?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:duration': [value: number]
}>()

function parseInitialDate(): CalendarDate {
  const minDate = today(getLocalTimeZone())
  if (props.initialDate) {
    const [y, m, d] = props.initialDate.split('-').map(Number)
    if (y && m && d) {
      const initial = new CalendarDate(y, m, d)
      return initial.compare(minDate) < 0 ? minDate : initial
    }
  }
  return minDate
}

const dateValue = shallowRef<DateValue>(parseInitialDate())
const slots = ref<Slot[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const slotDuration = ref(30) // minutes, from schedule

// Multi-slot selection: track selected slot indices
const selectedIndices = ref<Set<number>>(new Set())

const dateLabel = computed(() => {
  const d = dateValue.value
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.month - 1] ?? ''} ${d.day}, ${d.year}`
})

const selectionSummary = computed(() => {
  const count = selectedIndices.value.size
  if (count === 0) return null
  const totalMin = count * slotDuration.value
  const sorted = [...selectedIndices.value].sort((a, b) => a - b)
  const firstIndex = sorted[0]
  const lastIndex = sorted[sorted.length - 1]
  if (firstIndex === undefined || lastIndex === undefined) return null
  const first = slots.value[firstIndex]
  const last = slots.value[lastIndex]
  if (!first || !last) return null
  return {
    count,
    totalMin,
    startLabel: formatTime(first.start),
    endLabel: formatTime(last.end),
    durationLabel: totalMin >= 60
      ? `${Math.floor(totalMin / 60)}h${totalMin % 60 ? ` ${totalMin % 60}m` : ''}`
      : `${totalMin}m`,
  }
})

// Which indices can be added (adjacent to current selection and available)
const extendableIndices = computed(() => {
  const ext = new Set<number>()
  if (props.allowDurationSelection === false) return ext
  if (selectedIndices.value.size === 0) return ext
  const sorted = [...selectedIndices.value].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === undefined || last === undefined) return ext
  const before = first - 1
  const after = last + 1
  if (before >= 0 && slots.value[before]?.available) ext.add(before)
  if (after < slots.value.length && slots.value[after]?.available) ext.add(after)
  return ext
})

function dateToIso(d: DateValue): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

async function loadAvailability() {
  if (!props.doctorId) return
  isLoading.value = true
  error.value = null
  try {
    const response = await scheduleApi.getAvailability(props.doctorId, dateToIso(dateValue.value))
    slots.value = response.data.slots
    slotDuration.value = response.data.schedule?.slot_duration ?? 30

    // Auto-select the slot matching the prefill time
    if (props.autoSelectTime && selectedIndices.value.size === 0) {
      const targetTs = new Date(props.autoSelectTime).getTime()
      const idx = slots.value.findIndex(s => s.available && new Date(s.start).getTime() === targetTs)
      if (idx >= 0) {
        selectedIndices.value = new Set([idx])
        emitSelection()
      }
    }
  } catch {
    error.value = 'Failed to load availability'
    slots.value = []
  } finally {
    isLoading.value = false
  }
}

function onDateChange(date: DateValue | undefined) {
  if (!date) return
  if (date.compare(today(getLocalTimeZone())) < 0) return
  dateValue.value = date
  clearSelection()
  loadAvailability()
}

function selectSlot(index: number) {
  const slot = slots.value[index]
  if (!slot?.available) return

  if (props.allowDurationSelection === false) {
    selectedIndices.value = new Set([index])
    emitSelection()
    return
  }

  const selected = selectedIndices.value

  if (selected.size === 0) {
    // First selection
    selectedIndices.value = new Set([index])
  } else if (selected.has(index)) {
    // Already selected — shrink if edge, ignore if middle
    const sorted = [...selected].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    if (min === undefined || max === undefined) return
    if (index === min || index === max) {
      const next = new Set(selected)
      next.delete(index)
      selectedIndices.value = next
    }
  } else {
    const sorted = [...selected].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    if (min === undefined || max === undefined) return

    if (index === min - 1) {
      // Extend backward
      selectedIndices.value = new Set([...selected, index])
    } else if (index === max + 1) {
      // Extend forward
      selectedIndices.value = new Set([...selected, index])
    } else {
      // Not adjacent — start new selection
      selectedIndices.value = new Set([index])
    }
  }

  emitSelection()
}

function emitSelection() {
  const selected = selectedIndices.value
  if (selected.size === 0) {
    emit('update:modelValue', null)
    emit('update:duration', slotDuration.value)
    return
  }

  const sorted = [...selected].sort((a, b) => a - b)
  const firstIndex = sorted[0]
  if (firstIndex === undefined) {
    emit('update:modelValue', null)
    emit('update:duration', slotDuration.value)
    return
  }
  const firstSlot = slots.value[firstIndex]
  if (!firstSlot) {
    emit('update:modelValue', null)
    emit('update:duration', slotDuration.value)
    return
  }
  const totalMin = selected.size * slotDuration.value

  emit('update:modelValue', firstSlot.start)
  emit('update:duration', totalMin)
}

function clearSelection() {
  selectedIndices.value = new Set()
  emit('update:modelValue', null)
  emit('update:duration', slotDuration.value)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function slotClass(index: number): string {
  const slot = slots.value[index]
  if (!slot) return ''
  const isSelected = selectedIndices.value.has(index)
  const isExtendable = extendableIndices.value.has(index)

  if (isSelected) return 'border-primary bg-primary text-primary-foreground'
  if (!slot.available) return 'cursor-not-allowed bg-muted text-muted-foreground opacity-50'
  if (isExtendable) return 'cursor-pointer border-primary/40 bg-primary/10 hover:bg-primary/20'
  if (selectedIndices.value.size > 0 && props.allowDurationSelection !== false) return 'cursor-pointer opacity-60 hover:bg-accent'
  return 'cursor-pointer hover:border-primary/50 hover:bg-accent'
}

watch(
  () => props.doctorId,
  (id) => {
    clearSelection()
    if (id) loadAvailability()
    else slots.value = []
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Date picker -->
    <div class="flex items-center gap-3">
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" class="justify-start text-left font-normal">
            <CalendarIcon class="mr-2 size-3.5 text-muted-foreground" />
            {{ dateLabel }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <Calendar
            v-model="dateValue"
            :min-value="today(getLocalTimeZone())"
            @update:model-value="onDateChange"
          />
        </PopoverContent>
      </Popover>
    </div>

    <!-- Selection summary -->
    <div
      v-if="selectionSummary"
      class="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs"
    >
      <span class="font-medium text-primary">
        {{ selectionSummary.startLabel }} — {{ selectionSummary.endLabel }}
      </span>
      <span class="text-muted-foreground">
        {{ selectionSummary.count }} slot{{ selectionSummary.count > 1 ? 's' : '' }} · {{ selectionSummary.durationLabel }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <!-- No doctor selected -->
    <div v-else-if="!doctorId" class="py-8 text-center text-sm text-muted-foreground">
      Select a doctor first
    </div>

    <!-- No slots -->
    <div v-else-if="slots.length === 0" class="py-8 text-center text-sm text-muted-foreground">
      No availability for this date
    </div>

    <!-- Slot grid -->
    <div v-else>
      <p class="mb-2 text-xs text-muted-foreground">
        {{ allowDurationSelection === false ? 'Click a slot to select the new appointment time.' : 'Click a slot to select, click adjacent slots to extend the duration.' }}
      </p>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        <button
          v-for="(slot, index) in slots"
          :key="slot.start"
          :disabled="!slot.available"
          :class="[
            'flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors',
            slotClass(index),
          ]"
          @click="selectSlot(index)"
        >
          <Clock class="size-3" />
          {{ formatTime(slot.start) }}
        </button>
      </div>
    </div>
  </div>
</template>
