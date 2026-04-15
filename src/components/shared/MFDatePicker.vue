<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  modelValue: string | null
  placeholder?: string
  disabled?: boolean
  disableFuture?: boolean
  class?: string
}>(), {
  placeholder: 'Pick a date',
  disabled: false,
  disableFuture: false,
})

const maxValue = computed(() => props.disableFuture ? today(getLocalTimeZone()) : undefined)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

function parseToCalendarDate(dateStr: string | null): DateValue | undefined {
  if (!dateStr) return undefined
  const parts = dateStr.split('-')
  if (parts.length !== 3) return undefined
  return new CalendarDate(Number(parts[0]), Number(parts[1]), Number(parts[2]))
}

function formatDisplay(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const calendarValue = computed({
  get() {
    return parseToCalendarDate(props.modelValue)
  },
  set(val: DateValue | undefined) {
    if (!val) {
      emit('update:modelValue', null)
      return
    }
    const y = String(val.year).padStart(4, '0')
    const m = String(val.month).padStart(2, '0')
    const d = String(val.day).padStart(2, '0')
    emit('update:modelValue', `${y}-${m}-${d}`)
  },
})
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        :disabled="disabled"
        :class="cn(
          'h-9 w-full justify-start text-left font-normal',
          !modelValue && 'text-muted-foreground',
          props.class,
        )"
      >
        <CalendarIcon class="mr-2 size-4" />
        {{ modelValue ? formatDisplay(modelValue) : placeholder }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        v-model="calendarValue"
        :max-value="maxValue"
        layout="month-and-year"
        initial-focus
      />
    </PopoverContent>
  </Popover>
</template>
