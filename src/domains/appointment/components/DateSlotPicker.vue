<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarIcon, Clock, LoaderCircle } from 'lucide-vue-next'
import { getLocalTimeZone, today } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import type { Slot } from '@/domains/schedule/types/schedule.types'

const props = defineProps<{
  doctorId: string | null
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dateValue = ref<any>(today(getLocalTimeZone()))
const slots = ref<Slot[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const dateLabel = computed(() => {
  const d = dateValue.value
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.month - 1]} ${d.day}, ${d.year}`
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
  } catch {
    error.value = 'Failed to load availability'
    slots.value = []
  } finally {
    isLoading.value = false
  }
}

function onDateChange(date: DateValue | undefined) {
  if (!date) return
  dateValue.value = date
  emit('update:modelValue', null)
  loadAvailability()
}

function selectSlot(slot: Slot) {
  if (!slot.available) return
  emit('update:modelValue', slot.start)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

watch(
  () => props.doctorId,
  (id) => {
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
          <Calendar v-model="dateValue" @update:model-value="onDateChange" />
        </PopoverContent>
      </Popover>
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
    <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      <button
        v-for="slot in slots"
        :key="slot.start"
        :disabled="!slot.available"
        :class="[
          'flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors',
          slot.available && slot.start !== modelValue
            ? 'cursor-pointer hover:border-primary/50 hover:bg-accent'
            : '',
          !slot.available ? 'cursor-not-allowed bg-muted text-muted-foreground opacity-50' : '',
          slot.start === modelValue ? 'border-primary bg-primary text-primary-foreground' : '',
        ]"
        @click="selectSlot(slot)"
      >
        <Clock class="size-3" />
        {{ formatTime(slot.start) }}
      </button>
    </div>
  </div>
</template>
