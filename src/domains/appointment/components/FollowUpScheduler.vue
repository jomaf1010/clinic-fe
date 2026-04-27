<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CalendarDate, today, getLocalTimeZone, getDayOfWeek } from '@internationalized/date'
import { CalendarDays, X, LoaderCircle, Clock, CheckCircle2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import type { DaySchedule, Slot } from '@/domains/schedule/types/schedule.types'

/**
 * Reusable follow-up appointment scheduler. Extracted from
 * `consultation/.../TreatmentPlanTab.vue` so dental, OB-GYN, and any future
 * specialty can mount the same affordance with one line.
 *
 * Owns:
 *  - Date picker (gated on the doctor's working days from `scheduleApi`)
 *  - Quick presets (3d / 1wk / 2wk / 1mo / 3mo)
 *  - Slot picker fed by the doctor's availability for the chosen date
 *  - Booking via `appointmentApi.create`
 *  - Cancellation (clears the local follow-up date and emits null pair)
 *
 * Doesn't own: persistence of `follow_up` / `follow_up_appointment_id` on
 * the visit/encounter. The host is responsible for saving the values that
 * come back via `update:follow-up` + `update:follow-up-appointment-id`.
 *
 * Hidden when the clinic doesn't have the `appointments` feature.
 */

interface Props {
  doctorId: string
  patientId: string
  /** ISO date (YYYY-MM-DD) — the booked follow-up day, or null. */
  followUp: string | null
  /** UUID of the booked appointment, or null. */
  followUpAppointmentId: string | null
  disabled?: boolean
  /** Reason recorded on the appointment. Defaults to "Follow-up". */
  reason?: string
  /** Appointment.consultation_type. Defaults to 'follow_up'. */
  consultationType?: 'default' | 'follow_up'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  reason: 'Follow-up',
  consultationType: 'follow_up',
})

const emit = defineEmits<{
  /** Single atomic event so the parent can save both fields together —
   *  emitting them separately races against any debounced save and the
   *  appointment-id half can get clobbered by the server reply to the
   *  date-only save. */
  'update:booking': [{ followUp: string | null; appointmentId: string | null }]
}>()

const authStore = useAuthStore()
const hasAppointments = computed(() => authStore.hasFeature('appointments'))

const todayDate = today(getLocalTimeZone())
const minDate = todayDate.add({ days: 1 })

// ── Working schedule (disables non-working days on the picker) ───────
const workingDays = ref<DaySchedule[]>([])

const enabledWeekdays = computed(() => {
  const set = new Set<number>()
  for (const d of workingDays.value) if (d.enabled) set.add(d.day)
  return set
})

function isDateUnavailable(date: { year: number; month: number; day: number }): boolean {
  if (enabledWeekdays.value.size === 0) return false
  const calDate = new CalendarDate(date.year, date.month, date.day)
  const dow = getDayOfWeek(calDate, 'en-US')
  return !enabledWeekdays.value.has(dow)
}

onMounted(async () => {
  if (!props.doctorId) return
  try {
    const res = await scheduleApi.getSchedule(props.doctorId)
    workingDays.value = res.data.days
  } catch {
    // No schedule configured — allow all days; the slot fetch will simply
    // return empty for unworked days.
  }
})

// ── Availability slots ───────────────────────────────────────────────
const slots = ref<Slot[]>([])
const slotsLoading = ref(false)
const selectedDate = ref<string | null>(null)
const selectedSlot = ref<string | null>(null)
const isBooking = ref(false)
const appointmentBooked = ref(!!props.followUp && !!props.followUpAppointmentId)

watch(
  () => [props.followUp, props.followUpAppointmentId] as const,
  ([fu, fuId]) => {
    appointmentBooked.value = !!fu && !!fuId
    if (!fu) {
      selectedDate.value = null
      selectedSlot.value = null
      slots.value = []
    }
  },
)

const availableSlots = computed(() => slots.value.filter((s) => s.available))

const followUpCalendarValue = computed(() => {
  if (!props.followUp) return undefined
  const d = new Date(props.followUp)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const followUpDisplay = computed(() => {
  if (!props.followUp) return null
  return new Date(props.followUp).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
})

function formatSlotTime(isoDatetime: string): string {
  return new Date(isoDatetime).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

async function onDateSelect(date: CalendarDate): Promise<void> {
  const iso = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  selectedDate.value = iso
  selectedSlot.value = null
  appointmentBooked.value = false

  slotsLoading.value = true
  try {
    const res = await scheduleApi.getAvailability(props.doctorId, iso)
    slots.value = res.data.slots
  } catch {
    slots.value = []
  } finally {
    slotsLoading.value = false
  }
}

const followUpPresets = [
  { label: '3 days',  days: 3 },
  { label: '1 week',  days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
] as const

function applyPreset(days: number): void {
  const target = todayDate.add({ days })
  void onDateSelect(target)
}

async function bookFollowUp(slot: Slot): Promise<void> {
  selectedSlot.value = slot.start
  isBooking.value = true
  try {
    const response = await appointmentApi.create({
      patient_id: props.patientId,
      doctor_id: props.doctorId,
      scheduled_at: slot.start,
      reason: props.reason,
      consultation_type: props.consultationType,
    })
    const appointmentId = response.data.id
    emit('update:booking', { followUp: selectedDate.value, appointmentId })
    appointmentBooked.value = true
    toast.success('Follow-up appointment booked')
  } catch {
    toast.error('Failed to book appointment. Please try again.')
    selectedSlot.value = null
  } finally {
    isBooking.value = false
  }
}

function clearFollowUp(): void {
  selectedDate.value = null
  selectedSlot.value = null
  slots.value = []
  appointmentBooked.value = false
  emit('update:booking', { followUp: null, appointmentId: null })
}
</script>

<template>
  <div v-if="hasAppointments" class="flex flex-col gap-4">
    <!-- Booked state -->
    <div
      v-if="appointmentBooked && followUp"
      class="flex items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3 dark:border-green-700 dark:bg-green-950"
    >
      <CheckCircle2 class="size-5 shrink-0 text-green-600 dark:text-green-400" />
      <div class="flex-1">
        <p class="text-sm font-medium text-green-800 dark:text-green-300">Follow-up booked</p>
        <p class="text-xs text-green-700 dark:text-green-400">
          {{ followUpDisplay }}
          <span v-if="selectedSlot"> at {{ formatSlotTime(selectedSlot) }}</span>
        </p>
      </div>
      <Button
        v-if="!disabled"
        variant="ghost"
        size="icon"
        class="size-7 text-green-700 hover:text-destructive dark:text-green-400"
        @click="clearFollowUp"
      >
        <X class="size-4" />
      </Button>
    </div>

    <!-- Date + slot picker -->
    <template v-else-if="!disabled">
      <div class="flex items-center gap-2">
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="w-[240px] justify-start text-left font-normal"
              :class="{ 'text-muted-foreground': !selectedDate }"
            >
              <CalendarDays class="mr-2 size-4" />
              {{ selectedDate
                ? new Date(selectedDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                : 'Select a date' }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0" align="start">
            <Calendar
              :model-value="followUpCalendarValue"
              :min-value="minDate"
              :is-date-unavailable="isDateUnavailable"
              @update:model-value="onDateSelect"
            />
          </PopoverContent>
        </Popover>
        <Button
          v-if="selectedDate"
          variant="ghost"
          size="icon"
          class="size-8"
          @click="clearFollowUp"
        >
          <X class="size-4" />
        </Button>
      </div>

      <!-- Quick presets -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs text-muted-foreground">Quick:</span>
        <button
          v-for="preset in followUpPresets"
          :key="preset.days"
          type="button"
          class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
          @click="applyPreset(preset.days)"
        >{{ preset.label }}</button>
      </div>

      <!-- Slot picker -->
      <div v-if="selectedDate" class="mt-1">
        <div v-if="slotsLoading" class="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <LoaderCircle class="size-4 animate-spin" />
          Loading available slots...
        </div>

        <div v-else-if="availableSlots.length === 0" class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">
          No available slots on this date. Please select another day.
        </div>

        <div v-else class="flex flex-col gap-2">
          <p class="text-xs text-muted-foreground">
            {{ availableSlots.length }} available slot{{ availableSlots.length > 1 ? 's' : '' }} — select a time:
          </p>
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="slot in availableSlots"
              :key="slot.start"
              variant="outline"
              size="sm"
              class="h-8"
              :class="{ 'border-primary bg-primary/10 text-primary': selectedSlot === slot.start }"
              :disabled="isBooking"
              @click="bookFollowUp(slot)"
            >
              <Clock class="mr-1 size-3" />
              {{ formatSlotTime(slot.start) }}
            </Button>
          </div>
          <div v-if="isBooking" class="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle class="size-3 animate-spin" />
            Booking appointment...
          </div>
        </div>
      </div>
    </template>

    <!-- Read-only fallback when finalized without a booking -->
    <p v-else-if="followUp" class="text-sm">{{ followUpDisplay }}</p>
    <p v-else class="text-sm text-muted-foreground">No follow-up scheduled</p>
  </div>
</template>
