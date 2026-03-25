<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { CalendarDate, type DateValue, getLocalTimeZone, today, parseDate } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { CalendarIcon, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  BlockType,
  CalendarBlock,
  StoreCalendarBlockPayload,
  UpdateCalendarBlockPayload,
} from '../types/schedule.types'

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: 'leave', label: 'Leave' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'personal', label: 'Personal' },
  { value: 'unavailable', label: 'Unavailable' },
]

const props = defineProps<{
  open: boolean
  block: CalendarBlock | null
  isSaving?: boolean
  userId: string
  timezone?: string
  prefillDateTime?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: StoreCalendarBlockPayload | UpdateCalendarBlockPayload]
}>()

const isEdit = computed(() => props.block !== null)

// Form state
const title = ref('')
const type = ref<BlockType>('leave')
const allDay = ref(true)
const recurring = ref(false)
const singleDate = ref<DateValue>(today(getLocalTimeZone()))
const dateRange = ref<DateRange>({
  start: today(getLocalTimeZone()),
  end: today(getLocalTimeZone()),
})
const startTime = ref('08:00')
const endTime = ref('17:00')
const notes = ref('')

function utcToLocal(iso: string): { date: CalendarDate; time: string } {
  const d = new Date(iso)
  const tz = props.timezone || 'Asia/Manila'
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number)
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
  return { date: new CalendarDate(year!, month!, day!), time: timeStr }
}

function calendarDateToIso(d: DateValue): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

function formatDisplayDate(d: DateValue): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.month - 1]} ${d.day}, ${d.year}`
}

function resetForm() {
  if (props.block) {
    title.value = props.block.title
    type.value = props.block.type
    allDay.value = props.block.all_day
    recurring.value = props.block.recurring ?? false
    const startLocal = utcToLocal(props.block.start)
    const endLocal = utcToLocal(props.block.end)
    singleDate.value = startLocal.date
    dateRange.value = { start: startLocal.date, end: endLocal.date }
    if (!props.block.all_day) {
      startTime.value = startLocal.time
      endTime.value = endLocal.time
    }
    notes.value = props.block.notes ?? ''
  } else {
    title.value = ''
    type.value = 'leave'
    recurring.value = false
    notes.value = ''

    if (props.prefillDateTime) {
      const prefill = utcToLocal(props.prefillDateTime)
      allDay.value = false
      singleDate.value = prefill.date
      dateRange.value = { start: prefill.date, end: prefill.date }
      startTime.value = prefill.time
      // Default end time: 1 hour after start
      const [h, m] = prefill.time.split(':').map(Number)
      endTime.value = `${String(Math.min(23, h! + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    } else {
      allDay.value = true
      const now = today(getLocalTimeZone())
      singleDate.value = now
      dateRange.value = { start: now, end: now }
      startTime.value = '08:00'
      endTime.value = '17:00'
    }
  }
}

watch(() => props.open, (val) => {
  if (val) resetForm()
})

const singleDateLabel = computed(() => formatDisplayDate(singleDate.value))

const rangeDateLabel = computed(() => {
  if (!dateRange.value.start || !dateRange.value.end) return 'Pick a date range'
  const s = formatDisplayDate(dateRange.value.start)
  const e = formatDisplayDate(dateRange.value.end)
  return s === e ? s : `${s} – ${e}`
})

const canSave = computed(() => {
  if (!title.value) return false
  if (allDay.value || !recurring.value) return !!singleDate.value
  return !!dateRange.value.start && !!dateRange.value.end
})

function handleSave() {
  let start: string
  let end: string

  if (allDay.value) {
    const dateStr = calendarDateToIso(singleDate.value)
    start = dateStr
    end = dateStr
  } else if (recurring.value) {
    start = `${calendarDateToIso(dateRange.value.start!)}T${startTime.value}:00`
    end = `${calendarDateToIso(dateRange.value.end!)}T${endTime.value}:00`
  } else {
    const dateStr = calendarDateToIso(singleDate.value)
    start = `${dateStr}T${startTime.value}:00`
    end = `${dateStr}T${endTime.value}:00`
  }

  if (isEdit.value) {
    const payload: UpdateCalendarBlockPayload = {
      title: title.value,
      type: type.value,
      all_day: allDay.value,
      recurring: recurring.value,
      start,
      end,
      notes: notes.value || null,
    }
    emit('save', payload)
  } else {
    const payload: StoreCalendarBlockPayload = {
      user_id: props.userId,
      title: title.value,
      type: type.value,
      all_day: allDay.value,
      recurring: recurring.value,
      start,
      end,
      notes: notes.value || null,
    }
    emit('save', payload)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg" @close-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle>{{ isEdit ? 'Edit Calendar Block' : 'Add Calendar Block' }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <!-- Title -->
        <div>
          <Label for="block-title" class="mb-1.5 block">Title</Label>
          <Input
            id="block-title"
            v-model="title"
            placeholder="e.g. Annual leave"
          />
        </div>

        <!-- Type -->
        <div>
          <Label class="mb-1.5 block">Type</Label>
          <Select v-model="type">
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in BLOCK_TYPES"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Toggles -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div class="flex items-center gap-2">
            <Checkbox
              id="all-day"
              :model-value="allDay"
              @update:model-value="allDay = Boolean($event)"
            />
            <Label for="all-day" class="cursor-pointer">All day</Label>
          </div>
          <div v-if="!allDay" class="flex items-center gap-2">
            <Checkbox
              id="recurring"
              :model-value="recurring"
              @update:model-value="recurring = Boolean($event)"
            />
            <Label for="recurring" class="cursor-pointer">Recurring daily</Label>
          </div>
        </div>
        <p v-if="!allDay && recurring" class="text-xs text-muted-foreground -mt-2">
          The time range will repeat every day within the selected dates.
        </p>

        <!-- Single date picker (all-day or single-day timed block) -->
        <div v-if="allDay || !recurring">
          <Label class="mb-1.5 block">Date</Label>
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-start text-left font-normal">
                <CalendarIcon class="mr-2 size-4 text-muted-foreground" />
                {{ singleDateLabel }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <Calendar v-model="singleDate" />
            </PopoverContent>
          </Popover>
        </div>

        <!-- Date range picker (recurring timed block) -->
        <div v-else>
          <Label class="mb-1.5 block">Date range</Label>
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-start text-left font-normal">
                <CalendarIcon class="mr-2 size-4 text-muted-foreground" />
                {{ rangeDateLabel }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <RangeCalendar v-model="dateRange" :number-of-months="2" />
            </PopoverContent>
          </Popover>
        </div>

        <!-- Time range (only when not all-day) -->
        <div v-if="!allDay" class="flex flex-wrap gap-3">
          <div class="flex-1 min-w-[130px]">
            <Label for="start-time" class="mb-1.5 block">Start time</Label>
            <Input
              id="start-time"
              v-model="startTime"
              type="time"
            />
          </div>
          <div class="flex-1 min-w-[130px]">
            <Label for="end-time" class="mb-1.5 block">End time</Label>
            <Input
              id="end-time"
              v-model="endTime"
              type="time"
            />
          </div>
        </div>

        <!-- Notes -->
        <div>
          <Label for="block-notes" class="mb-1.5 block">Notes</Label>
          <Textarea
            id="block-notes"
            v-model="notes"
            placeholder="Optional notes..."
            class="resize-none"
            :rows="3"
          />
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button :disabled="isSaving || !canSave" @click="handleSave">
          <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
          {{ isEdit ? 'Save changes' : 'Add block' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
