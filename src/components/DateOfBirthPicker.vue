<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import type { DateValue } from 'reka-ui'
import { CalendarIcon } from 'lucide-vue-next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'

const model = defineModel<string | undefined>()

const props = withDefaults(defineProps<{
  invalid?: boolean
}>(), {
  invalid: false,
})

const months = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
]

const currentYear = today(getLocalTimeZone()).year

const selectedMonth = ref<string | undefined>()
const selectedDay = ref<string | undefined>()
const selectedYear = ref<string | undefined>()
const calendarOpen = ref(false)

const years = computed(() => {
  const result: string[] = []
  for (let y = currentYear; y >= 1900; y--) {
    result.push(String(y))
  }
  return result
})

const daysInMonth = computed(() => {
  const m = selectedMonth.value ? Number(selectedMonth.value) : 1
  const y = selectedYear.value ? Number(selectedYear.value) : currentYear
  const count = new Date(y, m, 0).getDate()
  const result: string[] = []
  for (let d = 1; d <= count; d++) {
    result.push(String(d))
  }
  return result
})

// Clamp day when month/year changes
watch([selectedMonth, selectedYear], () => {
  if (selectedDay.value) {
    const maxDay = daysInMonth.value.length
    if (Number(selectedDay.value) > maxDay) {
      selectedDay.value = String(maxDay)
    }
  }
})

const age = computed(() => {
  if (!model.value) return null
  const dob = new Date(model.value)
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    years--
  }
  return years >= 0 ? years : null
})

// Sync dropdowns → model
watch([selectedMonth, selectedDay, selectedYear], () => {
  if (selectedMonth.value && selectedDay.value && selectedYear.value) {
    const y = selectedYear.value.padStart(4, '0')
    const m = selectedMonth.value.padStart(2, '0')
    const d = selectedDay.value.padStart(2, '0')
    model.value = `${y}-${m}-${d}`
  }
})

// Sync model → dropdowns (on initial load from draft)
watch(
  () => model.value,
  async (val) => {
    if (!val) return
    // Handle full ISO datetime strings (e.g. "2000-05-15T00:00:00.000Z")
    const dateOnly = val.includes('T') ? val.split('T')[0] : val
    const parts = (dateOnly ?? '').split('-')
    if (parts.length === 3) {
      const y = String(Number(parts[0]))
      const m = String(Number(parts[1]))
      const d = String(Number(parts[2]))
      if (selectedYear.value !== y) selectedYear.value = y
      if (selectedMonth.value !== m) selectedMonth.value = m
      // Wait for daysInMonth to recompute with new month/year before setting day
      await nextTick()
      if (selectedDay.value !== d) selectedDay.value = d
    }
  },
  { immediate: true },
)

const calendarValue = computed<DateValue | undefined>({
  get() {
    if (!model.value) return undefined
    const parts = model.value.split('-')
    if (parts.length !== 3) return undefined
    return new CalendarDate(Number(parts[0]), Number(parts[1]), Number(parts[2]))
  },
  set(val: DateValue | undefined) {
    if (!val) return
    const y = String(val.year).padStart(4, '0')
    const m = String(val.month).padStart(2, '0')
    const d = String(val.day).padStart(2, '0')
    model.value = `${y}-${m}-${d}`
    calendarOpen.value = false
  },
})

const maxDate = today(getLocalTimeZone())
const minDate = new CalendarDate(1900, 1, 1)
</script>

<template>
  <div class="dob-picker flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-1.5">
      <Select v-model="selectedMonth">
        <SelectTrigger class="h-10 w-[84px] rounded-xl px-3" size="sm" :aria-invalid="props.invalid">
          <SelectValue placeholder="Mon" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="m in months" :key="m.value" :value="m.value">
            {{ m.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="selectedDay">
        <SelectTrigger class="h-10 w-[74px] rounded-xl px-3" size="sm" :aria-invalid="props.invalid">
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="d in daysInMonth" :key="d" :value="d">
            {{ d }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="selectedYear">
        <SelectTrigger class="h-10 w-[92px] rounded-xl px-3" size="sm" :aria-invalid="props.invalid">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="y in years" :key="y" :value="y">
            {{ y }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Popover v-model:open="calendarOpen">
      <PopoverTrigger as-child>
        <Button variant="outline" size="icon" type="button" class="size-10 shrink-0 rounded-xl">
          <CalendarIcon class="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        class="w-auto overflow-hidden rounded-[1.55rem] border-[var(--surface-border)] bg-[var(--surface-floating)] p-0 shadow-[var(--surface-shadow-strong)] backdrop-blur-[26px]"
        align="start"
      >
        <Calendar
          v-model="calendarValue"
          :max-value="maxDate"
          :min-value="minDate"
          layout="month-and-year"
          initial-focus
        />
      </PopoverContent>
    </Popover>

    <span v-if="age !== null" class="text-sm text-muted-foreground whitespace-nowrap">
      {{ age }} years old
    </span>
  </div>
</template>

<style scoped>
.dob-picker {
  --dob-control-shadow: 0 10px 24px rgb(15 23 42 / 0.055);
}

:deep([data-slot='select-trigger']),
:deep([data-slot='button'][data-variant='outline']) {
  box-shadow: var(--dob-control-shadow);
}

:global(.dark) .dob-picker {
  --dob-control-shadow: 0 12px 26px rgb(0 0 0 / 0.22);
}
</style>
