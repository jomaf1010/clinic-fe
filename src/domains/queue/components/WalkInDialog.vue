<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { LoaderCircle, Search, Stethoscope, User, UserPlus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { HttpError } from '@/lib/http'
import { patientApi } from '@/domains/patient/api/patientApi'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import type { PatientSearchResult } from '@/domains/patient/types/patient.types'
import type { ClinicDoctor } from '@/domains/appointment/types/appointment.types'
import { useQueueStore } from '../stores/queueStore'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: []
}>()

const queueStore = useQueueStore()

const searchQuery = ref('')
const searchResults = ref<PatientSearchResult[]>([])
const isSearching = ref(false)
const selectedPatient = ref<PatientSearchResult | null>(null)
const doctorId = ref<string>('none')
const reason = ref('')
const generalError = ref<string | null>(null)

// Doctors list
const doctors = ref<ClinicDoctor[]>([])
const isLoadingDoctors = ref(false)

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

let searchDebounce: ReturnType<typeof setTimeout> | null = null

async function handleSearchInput() {
  selectedPatient.value = null
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchResults.value = []
    return
  }
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(async () => {
    isSearching.value = true
    try {
      const response = await patientApi.search(q)
      searchResults.value = response.data
    } catch {
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectPatient(patient: PatientSearchResult) {
  selectedPatient.value = patient
  searchQuery.value = patient.full_name
  searchResults.value = []
}

async function submit() {
  if (!selectedPatient.value) return
  generalError.value = null

  try {
    await queueStore.createWalkIn({
      patient_id: selectedPatient.value.id,
      doctor_id: doctorId.value !== 'none' ? doctorId.value : undefined,
      reason: reason.value.trim() || undefined,
    })
    toast.success('Walk-in patient added to queue')
    emit('created')
    emit('update:open', false)
    reset()
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as { message?: string }
      generalError.value = body.message ?? 'Validation failed.'
    } else {
      generalError.value = 'Failed to add patient to queue.'
    }
  }
}

function reset() {
  searchQuery.value = ''
  searchResults.value = []
  selectedPatient.value = null
  doctorId.value = 'none'
  reason.value = ''
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
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <UserPlus class="size-5 text-primary" />
          Walk-in Patient
        </DialogTitle>
      </DialogHeader>

      <div
        v-if="generalError"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ generalError }}
      </div>

      <div class="flex flex-col gap-4">
        <!-- Patient search -->
        <div class="flex flex-col gap-2">
          <Label class="flex items-center gap-1.5">
            <User class="size-3.5 text-muted-foreground" />
            Patient
          </Label>
          <div class="relative">
            <Search class="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              class="pl-8"
              placeholder="Search by name..."
              autocomplete="off"
              @input="handleSearchInput"
            />
            <LoaderCircle
              v-if="isSearching"
              class="pointer-events-none absolute right-2.5 top-2.5 size-3.5 animate-spin text-muted-foreground"
            />
          </div>
          <!-- Search results dropdown -->
          <div
            v-if="searchResults.length > 0"
            class="rounded-md border bg-popover shadow-md"
          >
            <button
              v-for="patient in searchResults"
              :key="patient.id"
              type="button"
              class="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
              @click="selectPatient(patient)"
            >
              <span class="font-medium">{{ patient.full_name }}</span>
              <span class="text-xs text-muted-foreground">{{ patient.address }}</span>
            </button>
          </div>
          <p v-if="selectedPatient" class="text-xs text-muted-foreground">
            Selected: <span class="font-medium text-foreground">{{ selectedPatient.full_name }}</span>
          </p>
        </div>

        <!-- Doctor -->
        <div class="flex flex-col gap-2">
          <Label class="flex items-center gap-1.5">
            <Stethoscope class="size-3.5 text-muted-foreground" />
            Assign Doctor (optional)
          </Label>
          <Select v-model="doctorId" :disabled="isLoadingDoctors">
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              <SelectItem v-for="doc in doctors" :key="doc.id" :value="doc.id">
                {{ doc.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Reason -->
        <div class="flex flex-col gap-2">
          <Label>Reason (optional)</Label>
          <Input v-model="reason" placeholder="Reason for visit..." />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancel</Button>
        <Button :disabled="!selectedPatient || queueStore.isCreating" @click="submit">
          <LoaderCircle v-if="queueStore.isCreating" class="size-3.5 animate-spin" />
          Add to Queue
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
