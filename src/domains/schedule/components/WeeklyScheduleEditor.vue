<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoaderCircle, Save } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import DayScheduleRow from './DayScheduleRow.vue'
import type { DaySchedule, UpsertWorkingSchedulePayload, WorkingSchedule } from '../types/schedule.types'

const SLOT_DURATIONS = [
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
]

function buildDefaultDays(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    enabled: true,
    start_time: '08:00',
    end_time: '17:00',
    breaks: [],
  }))
}

const props = defineProps<{
  schedule: WorkingSchedule | null
  isSaving: boolean
}>()

const emit = defineEmits<{
  save: [payload: UpsertWorkingSchedulePayload]
}>()

const timezone = ref('Asia/Manila')
const slotDuration = ref('30')
const days = ref<DaySchedule[]>(buildDefaultDays())

function syncFromProp() {
  if (props.schedule) {
    timezone.value = props.schedule.timezone
    slotDuration.value = String(props.schedule.slot_duration)
    // Merge existing days, filling any missing ones with defaults
    const defaultDays = buildDefaultDays()
    days.value = defaultDays.map((def) => {
      const existing = props.schedule!.days.find((d) => d.day === def.day)
      if (!existing) return def
      return {
        ...existing,
        enabled: Boolean(existing.enabled),
        breaks: existing.breaks ? existing.breaks.map((b) => ({ ...b })) : [],
      }
    })
  } else {
    timezone.value = 'Asia/Manila'
    slotDuration.value = '30'
    days.value = buildDefaultDays()
  }
}

watch(() => props.schedule, syncFromProp, { immediate: true })

function updateDay(index: number, updated: DaySchedule) {
  days.value = days.value.map((d, i) => (i === index ? updated : d))
}

function handleSave() {
  emit('save', {
    timezone: timezone.value,
    slot_duration: Number(slotDuration.value),
    days: days.value,
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Config row -->
    <div class="flex flex-wrap gap-4">
      <div class="min-w-[180px] flex-1">
        <Label for="timezone" class="mb-1.5 block text-sm">Timezone</Label>
        <Input
          id="timezone"
          v-model="timezone"
          placeholder="e.g. Asia/Manila"
        />
      </div>
      <div class="w-44">
        <Label class="mb-1.5 block text-sm">Slot duration</Label>
        <Select v-model="slotDuration">
          <SelectTrigger>
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in SLOT_DURATIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Day rows -->
    <div class="space-y-2">
      <DayScheduleRow
        v-for="(day, index) in days"
        :key="day.day"
        :day="day"
        @update:day="updateDay(index, $event)"
      />
    </div>

    <!-- Save -->
    <div class="flex justify-end">
      <Button :disabled="isSaving" @click="handleSave">
        <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        Save schedule
      </Button>
    </div>
  </div>
</template>
