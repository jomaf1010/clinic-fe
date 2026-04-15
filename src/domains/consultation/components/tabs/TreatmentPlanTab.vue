<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { CalendarDate, today, getLocalTimeZone, getDayOfWeek } from '@internationalized/date'
import {
  MessageSquareText,
  CalendarDays,
  X,
  LoaderCircle,
  Clock,
  CheckCircle2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ConsultationTreatmentPlan, ConsultationConsumable } from '../../types/consultation.types'
import type { PrescriptionResponse } from '../../types/prescription.types'
import type { LabOrderResponse } from '../../types/labOrder.types'
import type { DaySchedule, Slot } from '@/domains/schedule/types/schedule.types'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import LabOrderSection from '../LabOrderSection.vue'
import PrescriptionSection from '../PrescriptionSection.vue'
import ConsumableSection from '../ConsumableSection.vue'
import ProcedureSection from '@/domains/service/components/ProcedureSection.vue'

const props = defineProps<{
  treatmentPlan: ConsultationTreatmentPlan
  consultationId: string
  patientId: string
  doctorId: string
  consumables: ConsultationConsumable[]
  procedures: Array<{ service_id: string; name: string; quantity: number; unit_price: number | null; notes: string | null }>
  disabled: boolean
  labOrderDisabled: boolean
  prescriptionUpdate?: PrescriptionResponse | null
  labOrderUpdate?: LabOrderResponse | null
  documentUpdate?: { type: string; status: string; download_url?: string | null } | null
}>()

const emit = defineEmits<{
  save: [payload: { treatment_plan: Partial<ConsultationTreatmentPlan> }]
  'update:consumables': [consumables: ConsultationConsumable[]]
  'lab-updated': []
  'procedures-updated': [procedures: Array<{ service_id: string; name: string; quantity: number; unit_price: number | null; notes: string | null }>]
}>()

const authStore = useAuthStore()
const hasConsumables = computed(() => authStore.hasFeature('consumables'))
const hasLabOrders = computed(() => authStore.hasFeature('lab_orders'))
const hasAppointments = computed(() => authStore.hasFeature('appointments'))

const local = reactive({
  advice: props.treatmentPlan.advice ?? '',
  follow_up: props.treatmentPlan.follow_up ?? null as string | null,
})

watch(
  () => props.treatmentPlan,
  (v) => {
    local.advice = v.advice ?? ''
    local.follow_up = v.follow_up ?? null
    if (v.follow_up && v.follow_up_appointment_id) {
      appointmentBooked.value = true
    } else if (!v.follow_up) {
      appointmentBooked.value = false
    }
  },
  { deep: true },
)

const todayDate = today(getLocalTimeZone())
const minDate = todayDate.add({ days: 1 })

// --- Working schedule (for disabling non-working days) ---
const workingDays = ref<DaySchedule[]>([])
const scheduleLoading = ref(false)

const enabledWeekdays = computed(() => {
  const set = new Set<number>()
  for (const d of workingDays.value) {
    if (d.enabled) set.add(d.day)
  }
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
  scheduleLoading.value = true
  try {
    const res = await scheduleApi.getSchedule(props.doctorId)
    workingDays.value = res.data.days
  } catch {
    // No schedule configured — allow all days
  } finally {
    scheduleLoading.value = false
  }
})

// --- Availability slots ---
const slots = ref<Slot[]>([])
const slotsLoading = ref(false)
const selectedDate = ref<string | null>(null)
const selectedSlot = ref<string | null>(null)
const isBooking = ref(false)
const appointmentBooked = ref(!!props.treatmentPlan.follow_up)

const availableSlots = computed(() => slots.value.filter((s) => s.available))

const followUpCalendarValue = computed(() => {
  if (!local.follow_up) return undefined
  const d = new Date(local.follow_up)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const followUpDisplay = computed(() => {
  if (!local.follow_up) return null
  return new Date(local.follow_up).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})

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

function formatSlotTime(isoDatetime: string): string {
  return new Date(isoDatetime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

async function bookFollowUp(slot: Slot): Promise<void> {
  selectedSlot.value = slot.start
  isBooking.value = true

  try {
    const response = await appointmentApi.create({
      patient_id: props.patientId,
      doctor_id: props.doctorId,
      scheduled_at: slot.start,
      reason: 'Follow-up',
      consultation_type: 'follow_up',
    })

    const appointmentId = response.data.id
    local.follow_up = selectedDate.value
    emit('save', { treatment_plan: { follow_up: selectedDate.value, follow_up_appointment_id: appointmentId } })
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
  local.follow_up = null
  selectedDate.value = null
  selectedSlot.value = null
  slots.value = []
  appointmentBooked.value = false
  emit('save', { treatment_plan: { follow_up: null, follow_up_appointment_id: null } })
}

function onAdviceBlur(): void {
  emit('save', { treatment_plan: { advice: local.advice || null } })
}

const followUpPresets = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
] as const

function applyPreset(days: number): void {
  const date = todayDate.add({ days })
  // Find nearest working day if the preset lands on a non-working day
  let candidate = date
  for (let i = 0; i < 7; i++) {
    if (!isDateUnavailable({ year: candidate.year, month: candidate.month, day: candidate.day })) {
      break
    }
    candidate = candidate.add({ days: 1 })
  }
  onDateSelect(candidate)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Prescription -->
    <PrescriptionSection :consultation-id="consultationId" :disabled="disabled" :realtime-update="prescriptionUpdate" :document-update="documentUpdate" />

    <hr class="border-border" />

    <!-- Procedures -->
    <ProcedureSection
      :encounter-id="consultationId"
      :procedures="procedures"
      :disabled="disabled"
      @update="(p) => emit('procedures-updated', p)"
    />

    <hr class="border-border" />

    <!-- Advice / Instructions -->
    <div class="flex flex-col gap-2">
      <Label for="advice" class="flex items-center gap-1.5">
        <MessageSquareText class="size-3.5 text-muted-foreground" />
        Advice / Instructions
      </Label>
      <Textarea
        id="advice"
        v-model="local.advice"
        placeholder="Enter advice, instructions, or recommendations for the patient..."
        :disabled="disabled"
        :rows="5"
        @blur="onAdviceBlur"
      />
    </div>

    <template v-if="hasLabOrders">
      <hr class="border-border" />

      <!-- Lab Orders -->
      <LabOrderSection :consultation-id="consultationId" :disabled="labOrderDisabled" :realtime-update="labOrderUpdate" :document-update="documentUpdate" @lab-updated="emit('lab-updated')" />
    </template>

    <template v-if="hasAppointments">
    <hr class="border-border" />

    <!-- Follow-up -->
    <div class="flex flex-col gap-3">
      <Label class="flex items-center gap-1.5">
        <CalendarDays class="size-3.5 text-muted-foreground" />
        Follow-up Appointment
      </Label>

      <!-- Booked state -->
      <div
        v-if="appointmentBooked && local.follow_up"
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
                {{ selectedDate ? new Date(selectedDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Select a date' }}
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
          >
            {{ preset.label }}
          </button>
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

      <!-- Read-only display -->
      <p v-else-if="local.follow_up" class="text-sm">
        {{ followUpDisplay }}
      </p>
      <p v-else class="text-sm text-muted-foreground">No follow-up scheduled</p>
    </div>
    </template>

    <template v-if="hasConsumables">
      <hr class="border-border" />

      <!-- Consumables -->
      <ConsumableSection
        :consultation-id="consultationId"
        :consumables="consumables"
        :disabled="disabled"
        @update="emit('update:consumables', $event)"
      />
    </template>
  </div>
</template>
