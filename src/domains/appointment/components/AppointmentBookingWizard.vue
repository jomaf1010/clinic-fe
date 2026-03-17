<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Stethoscope,
  User,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HttpError } from '@/lib/http'
import { useAppointmentStore } from '../stores/appointmentStore'
import { appointmentApi } from '../api/appointmentApi'
import DateSlotPicker from './DateSlotPicker.vue'
import PatientSelector from './PatientSelector.vue'
import type { PatientSearchResult } from '@/domains/patient/types/patient.types'
import type { ClinicDoctor } from '../types/appointment.types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: []
}>()

const appointmentStore = useAppointmentStore()

const step = ref(1)
const totalSteps = 4

// Step 1: Doctor
const doctorId = ref<string | null>(null)
const doctorName = ref('')
const doctors = ref<ClinicDoctor[]>([])
const isLoadingDoctors = ref(false)

// Step 2: Date/Slot
const selectedSlot = ref<string | null>(null)

// Step 3: Patient
const patientId = ref<string | null>(null)
const patientName = ref('')

// Step 4: Details
const reason = ref('')
const notes = ref('')

const generalError = ref<string | null>(null)

async function loadDoctors() {
  isLoadingDoctors.value = true
  try {
    const response = await appointmentApi.getDoctors()
    doctors.value = response.data
  } catch {
    doctors.value = []
  } finally {
    isLoadingDoctors.value = false
  }
}

function selectDoctor(doc: ClinicDoctor) {
  doctorId.value = doc.id
  doctorName.value = doc.name
}

function handlePatientSelect(patient: PatientSearchResult) {
  patientName.value = patient.full_name
}

const canNext = computed(() => {
  switch (step.value) {
    case 1:
      return !!doctorId.value
    case 2:
      return !!selectedSlot.value
    case 3:
      return !!patientId.value
    case 4:
      return true
    default:
      return false
  }
})

function next() {
  if (step.value < totalSteps && canNext.value) step.value++
}

function prev() {
  if (step.value > 1) step.value--
}

async function submit() {
  if (!doctorId.value || !selectedSlot.value || !patientId.value) return
  generalError.value = null

  try {
    await appointmentStore.createAppointment({
      patient_id: patientId.value,
      doctor_id: doctorId.value,
      scheduled_at: selectedSlot.value,
      reason: reason.value || undefined,
      notes: notes.value || undefined,
    })
    toast.success('Appointment booked')
    emit('created')
    emit('update:open', false)
    reset()
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as { message?: string; errors?: Record<string, string[]> }
      generalError.value = body.message ?? 'Validation failed.'
    } else {
      generalError.value = 'Failed to book appointment. Please try again.'
    }
  }
}

function reset() {
  step.value = 1
  doctorId.value = null
  doctorName.value = ''
  selectedSlot.value = null
  patientId.value = null
  patientName.value = ''
  reason.value = ''
  notes.value = ''
  generalError.value = null
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      reset()
      loadDoctors()
    }
  },
)

const stepTitle = computed(() => {
  switch (step.value) {
    case 1:
      return 'Select Doctor'
    case 2:
      return 'Choose Date & Time'
    case 3:
      return 'Select Patient'
    case 4:
      return 'Review & Confirm'
    default:
      return ''
  }
})

function formatSlotTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-h-[85vh] sm:max-w-lg" :class="step === 3 ? 'overflow-visible' : 'overflow-y-auto'">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <CalendarCheck class="size-5 text-primary" />
          Book Appointment
        </DialogTitle>
        <div class="flex items-center gap-2 pt-2">
          <div
            v-for="s in totalSteps"
            :key="s"
            :class="['h-1 flex-1 rounded-full', s <= step ? 'bg-primary' : 'bg-muted']"
          />
        </div>
        <p class="text-sm text-muted-foreground">
          Step {{ step }} of {{ totalSteps }}: {{ stepTitle }}
        </p>
      </DialogHeader>

      <div
        v-if="generalError"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ generalError }}
      </div>

      <!-- Step 1: Doctor -->
      <div v-if="step === 1" class="flex flex-col gap-2">
        <div v-if="isLoadingDoctors" class="flex items-center justify-center py-8">
          <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <button
            v-for="doc in doctors"
            :key="doc.id"
            :class="[
              'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
              doctorId === doc.id ? 'border-primary bg-primary/5' : 'hover:bg-accent',
            ]"
            @click="selectDoctor(doc)"
          >
            <div class="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Stethoscope class="size-4 text-primary" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ doc.name }}</p>
              <p class="text-xs text-muted-foreground capitalize">{{ doc.role }}</p>
            </div>
          </button>
          <p v-if="doctors.length === 0" class="py-4 text-center text-sm text-muted-foreground">
            No doctors found in this clinic
          </p>
        </template>
      </div>

      <!-- Step 2: Date/Slot -->
      <div v-if="step === 2">
        <DateSlotPicker v-model="selectedSlot" :doctor-id="doctorId" />
      </div>

      <!-- Step 3: Patient -->
      <div v-if="step === 3" class="flex flex-col gap-3">
        <Label class="flex items-center gap-1.5">
          <User class="size-3.5 text-muted-foreground" />
          Patient
        </Label>
        <PatientSelector v-model="patientId" @select="handlePatientSelect" />
      </div>

      <!-- Step 4: Confirm -->
      <div v-if="step === 4" class="flex flex-col gap-4">
        <div class="rounded-lg border p-4">
          <div class="grid gap-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Doctor</span>
              <span class="font-medium">{{ doctorName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Date & Time</span>
              <span class="font-medium">{{ formatSlotTime(selectedSlot) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Patient</span>
              <span class="font-medium">{{ patientName }}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <Label class="text-sm">Reason (optional)</Label>
          <Input v-model="reason" placeholder="Reason for visit..." />
        </div>
        <div class="flex flex-col gap-2">
          <Label class="text-sm">Notes (optional)</Label>
          <Textarea v-model="notes" placeholder="Additional notes..." :rows="2" />
        </div>
      </div>

      <DialogFooter class="flex-row gap-2">
        <Button v-if="step > 1" variant="outline" @click="prev">
          <ChevronLeft class="size-4" />
          Back
        </Button>
        <div class="flex-1" />
        <Button v-if="step < totalSteps" :disabled="!canNext" @click="next">
          Next
          <ChevronRight class="size-4" />
        </Button>
        <Button v-if="step === totalSteps" :disabled="appointmentStore.isCreating" @click="submit">
          <LoaderCircle v-if="appointmentStore.isCreating" class="size-3.5 animate-spin" />
          Book Appointment
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
