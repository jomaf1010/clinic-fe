<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  User,
  MapPin,
  CalendarDays,
  Phone,
  Mail,
  ShieldAlert,
  HeartPulse,
  StickyNote,
  LoaderCircle,
  Stethoscope,
  Plus,
  Pencil,
  PlayCircle,
  Filter,
  X,
  FlaskConical,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronDown,
  Camera,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import PatientAvatar from '@/components/PatientAvatar.vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import EditPatientDialog from '../components/EditPatientDialog.vue'
import ImageCropDialog from '@/components/ImageCropDialog.vue'
import { patientApi } from '../api/patientApi'
import type { PatientResponse } from '../types/patient.types'
import type { LabOrderSummary } from '@/domains/consultation/types/consultation.types'
import { RouteNames } from '@/router/routeNames'
import DraftConsultationCard from '@/domains/patient/components/DraftConsultationCard.vue'
import FinalizedConsultationCard from '@/domains/patient/components/FinalizedConsultationCard.vue'
import VitalsComparisonCard from '@/domains/patient/components/VitalsComparisonCard.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useConsultationStore } from '@/domains/consultation/stores/consultationStore'
import { useNotificationStore } from '@/domains/notification/stores/notificationStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const consultationStore = useConsultationStore()
const notificationStore = useNotificationStore()
const patient = ref<PatientResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

const avatarCropOpen = ref(false)
const isUploadingAvatar = ref(false)
const avatarUrl = ref<string | null>(null)

const displayAvatarUrl = computed(() => avatarUrl.value ?? patient.value?.avatar_url ?? null)

async function handleAvatarCrop(blob: Blob) {
  if (!patient.value) return
  const file = new File([blob], 'avatar.png', { type: 'image/png' })
  isUploadingAvatar.value = true
  try {
    const res = await patientApi.uploadAvatar(patient.value.id, file)
    avatarUrl.value = res.data.avatar_url
    toast.success('Patient photo updated')
  } catch {
    toast.error('Failed to upload photo')
  } finally {
    isUploadingAvatar.value = false
  }
}

const isOwner = computed(() => authStore.currentClinic?.role === 'owner')
const currentUserId = computed(() => authStore.user?.id)
const canSeeDrafts = computed(() => isOwner.value || authStore.hasPermission('consultations.edit-triage'))

const visibleConsultations = computed(() =>
  consultationStore.patientConsultations.filter(c =>
    c.status !== 'draft' || canSeeDrafts.value || c.created_by === currentUserId.value,
  ),
)

const draftConsultation = computed(() =>
  visibleConsultations.value.find(c =>
    c.status === 'draft' && (c.created_by === currentUserId.value || isOwner.value),
  ) ?? null,
)

const latestFinalizedIndex = computed(() =>
  visibleConsultations.value.findIndex(c => c.status === 'finalized'),
)

const showVitalsComparison = computed(() => {
  if (!draftConsultation.value?.triage) return false
  const idx = latestFinalizedIndex.value
  if (idx < 0) return false
  return !!visibleConsultations.value[idx]?.triage
})

const previousTriage = computed(() => {
  const idx = latestFinalizedIndex.value
  if (idx < 0) return null
  return visibleConsultations.value[idx]?.triage ?? null
})

const age = computed(() => {
  if (!patient.value) return null
  const dob = new Date(patient.value.date_of_birth)
  const today = new Date()
  let years = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    years--
  }
  return years
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function fetchPatient() {
  isLoading.value = true
  error.value = null
  avatarUrl.value = null

  try {
    const response = await patientApi.get(route.params.id as string)
    patient.value = response.data

    await consultationStore.loadForPatient(response.data.id)
  } catch {
    error.value = 'Failed to load patient details. Please try again.'
  } finally {
    isLoading.value = false
  }
}

watch(() => route.params.id, () => fetchPatient(), { immediate: true })

// Refresh timeline when a med cert is generated
watch(() => notificationStore.notifications[0], (newest) => {
  if (newest?.type === 'medcert.completed' || newest?.type === 'document.generated') {
    consultationStore.loadForPatient(patient.value?.id ?? '')
  }
})

const editDialogOpen = ref(false)
const mobileCardExpanded = ref(false)

const labOrderDialogOpen = ref(false)
const labOrderDialogData = ref<LabOrderSummary | null>(null)

function showLabOrderDialog(summary: LabOrderSummary, e: Event) {
  e.stopPropagation()
  labOrderDialogData.value = summary
  labOrderDialogOpen.value = true
}

const filterMonth = ref<string>('')
const filterYear = ref<string>('')

const months = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const years = computed(() => {
  const currentYear = new Date().getFullYear()
  const startYear = patient.value ? new Date(patient.value.created_at).getFullYear() : currentYear
  const result: string[] = []
  for (let y = currentYear; y >= startYear; y--) {
    result.push(String(y))
  }
  return result
})

const hasActiveFilter = computed(() => filterMonth.value !== '' || filterYear.value !== '')

function applyFilter() {
  if (!patient.value) return
  const filters: { month?: number; year?: number } = {}
  if (filterMonth.value) filters.month = Number(filterMonth.value)
  if (filterYear.value) filters.year = Number(filterYear.value)
  consultationStore.loadForPatient(patient.value.id, filters)
}

function clearFilter() {
  filterMonth.value = ''
  filterYear.value = ''
  if (!patient.value) return
  consultationStore.loadForPatient(patient.value.id)
}

watch([filterMonth, filterYear], () => {
  applyFilter()
})

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

watch(sentinel, (el) => {
  if (observer) observer.disconnect()
  if (!el) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && patient.value) {
        consultationStore.loadMoreForPatient(patient.value.id)
      }
    },
    { rootMargin: '100px' },
  )
  observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  consultationStore.clearPatientConsultations()
})
</script>

<template>
  <div v-if="isLoading" class="flex flex-1 items-center justify-center pt-16">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div
    v-else-if="error"
    role="alert"
    class="mx-auto max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {{ error }}
  </div>

  <div
    v-else-if="patient"
    class="-mx-4 -mt-4 -mb-4 flex flex-1 flex-col gap-0 overflow-y-auto md:min-h-0 md:flex-row md:overflow-y-hidden"
  >
    <!-- Left panel -->
    <div class="shrink-0 border-b p-4 md:w-1/3 md:overflow-y-auto md:border-b-0 md:border-r md:p-6">
      <Button
        variant="outline"
        size="sm"
        class="-ml-2 mb-3 gap-1.5"
        @click="router.back()"
      >
        <ArrowLeft class="size-3.5" />
        Back
      </Button>

      <!-- Header — always visible -->
      <div class="flex items-center gap-3 md:flex-col md:items-center md:text-center">
        <!-- Patient avatar -->
        <div class="group relative shrink-0">
          <PatientAvatar
            :avatar-url="displayAvatarUrl"
            :sex="patient.sex"
            :name="patient.full_name"
            class="size-12 md:size-16"
          />

          <button
            v-if="authStore.hasPermission('patients.edit')"
            type="button"
            class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            :disabled="isUploadingAvatar"
            aria-label="Upload patient photo"
            @click="avatarCropOpen = true"
          >
            <LoaderCircle v-if="isUploadingAvatar" class="size-4 animate-spin text-white" />
            <Camera v-else class="size-4 text-white" />
          </button>
        </div>
        <div class="min-w-0 flex-1 md:mt-2 md:w-full md:flex-none">
          <h2 class="text-base font-semibold md:text-lg">{{ patient.full_name }}</h2>
          <p v-if="patient.formatted_address" class="mt-0.5 flex max-w-full items-center gap-1 text-sm text-muted-foreground md:justify-center" :title="patient.formatted_address">
            <MapPin class="size-3.5 shrink-0" />
            <span class="truncate">{{ patient.formatted_address }}</span>
          </p>
        </div>
      </div>

      <!-- Action buttons — always visible -->
      <div class="mt-3 flex gap-2">
        <Button
          v-if="draftConsultation"
          size="sm"
          variant="secondary"
          class="flex-1"
          @click="router.push({ name: RouteNames.CONSULTATION_DETAIL, params: { patientId: patient!.id, id: draftConsultation.id } })"
        >
          <PlayCircle class="size-3.5" />
          Continue Draft
        </Button>
        <template v-else-if="authStore.hasPermission('consultations.create')">
          <Button
            size="sm"
            class="flex-1"
            @click="router.push({ name: RouteNames.CONSULTATION_NEW, params: { patientId: patient!.id } })"
          >
            <Plus class="size-3.5" />
            Consultation
          </Button>
          <Button
            size="sm"
            variant="secondary"
            class="flex-1"
            @click="router.push({ name: RouteNames.CONSULTATION_NEW, params: { patientId: patient!.id }, query: { type: 'follow_up' } })"
          >
            <Plus class="size-3.5" />
            Follow-up
          </Button>
        </template>
        <Button variant="outline" size="sm" @click="editDialogOpen = true">
          <Pencil class="size-3.5" />
        </Button>
      </div>

      <!-- Mobile expand toggle -->
      <button
        type="button"
        class="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground md:hidden"
        @click="mobileCardExpanded = !mobileCardExpanded"
      >
        {{ mobileCardExpanded ? 'Show less' : 'Show more details' }}
        <ChevronDown class="size-3.5 transition-transform" :class="mobileCardExpanded ? 'rotate-180' : ''" />
      </button>

      <!-- Expandable sections — hidden on mobile unless expanded, always visible on desktop -->
      <div :class="mobileCardExpanded ? '' : 'hidden md:block'">
        <!-- Medical (top priority) -->
        <div
          v-if="patient.allergies.length > 0 || patient.chronic_conditions.length > 0"
          class="mt-5 border-t pt-4"
        >
          <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Medical
          </h3>
          <div class="space-y-3">
            <div v-if="patient.allergies.length > 0">
              <div class="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                <ShieldAlert class="size-4 shrink-0" />
                Allergies
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="allergy in patient.allergies"
                  :key="allergy"
                  class="rounded-md border border-red-300 bg-red-100 px-2.5 py-1 text-sm font-medium text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400"
                >
                  {{ allergy }}
                </span>
              </div>
            </div>
            <div v-if="patient.chronic_conditions.length > 0">
              <div class="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                <HeartPulse class="size-4 shrink-0" />
                Conditions
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="condition in patient.chronic_conditions"
                  :key="condition"
                  class="rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
                >
                  {{ condition }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Basic Info -->
        <div class="mt-5 border-t pt-4">
          <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Basic Info
          </h3>
          <div class="space-y-2.5">
            <div v-if="age !== null" class="flex items-start gap-2 text-sm">
              <CalendarDays class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <span class="text-muted-foreground">Age: </span>
                {{ age }} yrs old
              </div>
            </div>
            <div class="flex items-start gap-2 text-sm">
              <CalendarDays class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <span class="text-muted-foreground">DOB: </span>
                {{ formatDate(patient.date_of_birth) }}
              </div>
            </div>
            <div class="flex items-start gap-2 text-sm">
              <User class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <span class="text-muted-foreground">Sex: </span>
                {{ patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1) }}
              </div>
            </div>
            <div v-if="patient.contact_number" class="flex items-start gap-2 text-sm">
              <Phone class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <span class="text-muted-foreground">Phone: </span>
                {{ patient.contact_number }}
              </div>
            </div>
            <div v-if="patient.email" class="flex items-start gap-2 text-sm">
              <Mail class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <span class="text-muted-foreground">Email: </span>
                {{ patient.email }}
              </div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="patient.note" class="mt-5 border-t pt-4">
          <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </h3>
          <div class="flex items-start gap-2 text-sm">
            <StickyNote class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p class="whitespace-pre-wrap">{{ patient.note }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <div class="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Stethoscope class="size-4 text-muted-foreground" />
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Consultations
          </h3>
          <span class="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {{ visibleConsultations.length }}
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <Select v-model="filterMonth">
            <SelectTrigger class="h-7 w-[120px] text-xs">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in months" :key="m.value" :value="m.value">
                {{ m.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filterYear">
            <SelectTrigger class="h-7 w-[80px] text-xs">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="y in years" :key="y" :value="y">
                {{ y }}
              </SelectItem>
            </SelectContent>
          </Select>
          <button
            v-if="hasActiveFilter"
            aria-label="Clear filter"
            class="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="clearFilter"
          >
            <X class="size-3" />
          </button>
        </div>
      </div>

      <!-- Skeleton loading state -->
      <div v-if="consultationStore.isLoadingConsultations" class="mt-4">
        <div
          v-for="n in 5"
          :key="n"
          class="flex gap-3"
        >
          <div class="flex flex-col items-center">
            <Skeleton class="mt-3.5 size-2 shrink-0 rounded-full" />
            <div v-if="n < 5" class="mt-1 flex-1 w-[2px] bg-foreground/15" />
          </div>
          <div
            class="min-w-0 flex-1 rounded-lg border bg-card p-3"
            :class="n < 5 ? 'mb-3' : ''"
          >
            <Skeleton class="h-3 w-20 mb-2" />
            <Skeleton class="h-4 w-3/4 mb-2" />
            <div class="flex gap-1.5">
              <Skeleton class="h-5 w-20 rounded-md" />
              <Skeleton class="h-5 w-16 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="visibleConsultations.length === 0"
        class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
      >
        <Stethoscope class="size-10 mb-3 opacity-50" />
        <p class="text-sm">No consultations yet</p>
      </div>

      <!-- Timeline -->
      <div v-else class="mt-4">
        <div
          v-for="(consultation, index) in visibleConsultations"
          :key="consultation.id"
          class="flex gap-3"
        >
          <div class="flex w-3 flex-col items-center">
            <div
              class="mt-3.5 shrink-0 rounded-full"
              :class="
                consultation.status === 'draft'
                  ? 'size-3 bg-amber-400 pulse-ring-amber'
                  : index === latestFinalizedIndex
                    ? 'size-3 bg-primary pulse-ring-primary'
                    : 'size-2 bg-primary'
              "
            />
            <div
              v-if="index < visibleConsultations.length - 1 || consultationStore.hasMore"
              class="mt-1 flex-1 w-[2px]"
              :class="consultation.status === 'draft' ? 'bg-amber-300' : 'bg-foreground/15'"
            />
          </div>
          <!-- Draft card + vitals comparison -->
          <div v-if="consultation.status === 'draft'" class="min-w-0 flex-1 flex flex-col gap-2" :class="index < visibleConsultations.length - 1 ? 'mb-3' : ''">
            <DraftConsultationCard
              :consultation="consultation"
              :patient-id="patient!.id"
              @show-lab-order="(summary, e) => showLabOrderDialog(summary, e)"
            />
            <VitalsComparisonCard
              v-if="showVitalsComparison"
              :current="consultation.triage"
              :previous="previousTriage!"
              :consultation-id="consultation.id"
            />
          </div>

          <!-- Finalized card -->
          <FinalizedConsultationCard
            v-else
            :consultation="consultation"
            :patient-id="patient!.id"
            :latest="index === latestFinalizedIndex"
            class="min-w-0 flex-1"
            :class="index < visibleConsultations.length - 1 ? 'mb-3' : ''"
            @show-lab-order="(summary, e) => showLabOrderDialog(summary, e)"
          />
        </div>

        <!-- Infinite scroll sentinel -->
        <!-- Infinite scroll sentinel (skeleton card) -->
        <div
          v-if="consultationStore.hasMore"
          ref="sentinel"
          class="flex gap-3"
        >
          <div class="flex flex-col items-center">
            <Skeleton class="mt-3.5 size-2 shrink-0 rounded-full" />
          </div>
          <div class="mt-3 min-w-0 flex-1 rounded-lg border bg-card p-3">
            <Skeleton class="h-3 w-24 mb-2" />
            <Skeleton class="h-4 w-3/4 mb-2" />
            <Skeleton class="h-3 w-1/2 mb-3" />
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle class="size-3.5 animate-spin" />
              Loading more...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lab Order Summary Dialog -->
    <Dialog v-model:open="labOrderDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <FlaskConical class="size-4" />
            Lab Order Summary
          </DialogTitle>
          <DialogDescription class="sr-only">Lab order items breakdown</DialogDescription>
        </DialogHeader>
        <div v-if="labOrderDialogData" class="flex flex-col gap-4">
          <div v-if="labOrderDialogData.completed_items.length">
            <p class="mb-2 flex items-center gap-1.5 text-sm font-medium text-green-600">
              <CheckCircle2 class="size-3.5" />
              Completed ({{ labOrderDialogData.completed }})
            </p>
            <ul class="ml-5 list-disc space-y-1 text-sm">
              <li v-for="name in labOrderDialogData.completed_items" :key="name">{{ name }}</li>
            </ul>
          </div>
          <div v-if="labOrderDialogData.pending_items.length">
            <p class="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-600">
              <Clock class="size-3.5" />
              Pending ({{ labOrderDialogData.pending }})
            </p>
            <ul class="ml-5 list-disc space-y-1 text-sm">
              <li v-for="name in labOrderDialogData.pending_items" :key="name">{{ name }}</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Edit Patient Dialog -->
    <EditPatientDialog
      v-if="patient"
      :open="editDialogOpen"
      :patient="patient"
      @update:open="editDialogOpen = $event"
      @updated="fetchPatient()"
    />

    <!-- Avatar Crop Dialog -->
    <ImageCropDialog
      v-model:open="avatarCropOpen"
      title="Upload Patient Photo"
      description="Position the photo within the circle."
      :output-size="256"
      @crop="handleAvatarCrop"
    />
  </div>
</template>

<style scoped>
.pulse-ring-amber {
  animation: pulse-amber 2s ease-out infinite;
}
.pulse-ring-primary {
  animation: pulse-primary 2s ease-out infinite;
}

@keyframes pulse-amber {
  0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.6); }
  100% { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
}
@keyframes pulse-primary {
  0% { box-shadow: 0 0 0 0 oklch(0.283 0.090 253.827 / 0.5); }
  100% { box-shadow: 0 0 0 10px oklch(0.283 0.090 253.827 / 0); }
}
</style>
