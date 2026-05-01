<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  User,
  MapPin,
  CalendarDays,
  Phone,
  Mail,
  StickyNote,
  LoaderCircle,
  Stethoscope,
  Pencil,
  PlayCircle,
  X,
  FlaskConical,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Camera,
  ArrowRight,
  Trash2,
  AlertTriangle,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import PatientAvatar from '@/components/PatientAvatar.vue'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import EditPatientDialog from '../components/EditPatientDialog.vue'
import ImageCropDialog from '@/components/ImageCropDialog.vue'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import type { LabOrderSummary } from '@/domains/consultation/types/consultation.types'
import { RouteNames } from '@/router/routeNames'
import DraftConsultationCard from '@/domains/patient/components/DraftConsultationCard.vue'
import FinalizedConsultationCard from '@/domains/patient/components/FinalizedConsultationCard.vue'
import VitalsComparisonCard from '@/domains/patient/components/VitalsComparisonCard.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { useNotificationStore } from '@/domains/notification/stores/notificationStore'
import { usePatientSync } from '../composables/usePatientSync'
import PatientSpecialtyFactory from '../components/specialties/PatientSpecialtyFactory.vue'
import PatientCompletenessRing from '../components/PatientCompletenessRing.vue'
import { calculatePatientProfileCompleteness } from '../utils/profileCompleteness'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const encounterStore = useEncounterStore()
const notificationStore = useNotificationStore()
const pdStore = usePatientDetailStore()
const specialtyStore = useSpecialtyConfigStore()
const patient = computed(() => pdStore.patient)
const isLoading = ref(false)
const error = ref<string | null>(null)

const patientIdRef = computed(() => route.params.id as string)
const clinicIdRef = computed(() => authStore.currentClinic?.id)
usePatientSync(
  patientIdRef,
  clinicIdRef,
  (updated) => {
    pdStore.updatePatientFromSync(updated)
  },
  (data) => {
    const idx = encounterStore.patientEncounters.findIndex((e) => e.id === data.encounter_id)
    const existing = idx >= 0 ? encounterStore.patientEncounters[idx] : null
    if (existing) {
      encounterStore.patientEncounters[idx] = {
        ...existing,
        auto_display_line: data.auto_display_line,
        auto_display_summary: data.auto_display_summary,
        updated_at: data.updated_at,
      }
    }
  },
)

const avatarCropOpen = ref(false)
const isUploadingAvatar = ref(false)
const avatarUrl = ref<string | null>(null)

const displayAvatarUrl = computed(() => avatarUrl.value ?? patient.value?.avatar_url ?? null)

async function handleAvatarCrop(blob: Blob) {
  if (!patient.value) return
  const file = new File([blob], 'avatar.png', { type: 'image/png' })
  isUploadingAvatar.value = true
  try {
    avatarUrl.value = await pdStore.uploadAvatar(file)
    toast.success('Patient photo updated')
  } catch {
    toast.error('Failed to upload photo')
  } finally {
    isUploadingAvatar.value = false
  }
}

const isOwner = computed(() => authStore.currentClinic?.role === 'owner')
const currentRole = computed(() => authStore.currentClinic?.role)
const currentUserId = computed(() => authStore.user?.id)
const isSecretaryOrStaff = computed(() => currentRole.value === 'secretary' || currentRole.value === 'staff')
const canSeeDrafts = computed(() => isOwner.value || authStore.hasPermission('encounters.edit-triage'))
// Mirrors backend ensureDraftOwnership: owner OR assigned doctor OR secretary/staff with edit-triage.
const canEditDraftOfOthers = computed(() => isSecretaryOrStaff.value && authStore.hasPermission('encounters.edit-triage'))

const visibleConsultations = computed(() =>
  encounterStore.patientEncounters.filter(c =>
    c.status !== 'draft' || canSeeDrafts.value || c.doctor_id === currentUserId.value,
  ),
)

const draftConsultation = computed(() =>
  visibleConsultations.value.find(c =>
    c.status === 'draft' && (c.doctor_id === currentUserId.value || isOwner.value || canEditDraftOfOthers.value),
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

const age = computed(() => pdStore.patientAgeLabel)

// Advisory banner for pediatricians looking at adult charts. We don't
// block anything — pediatric fellows/consultants do sometimes see >18
// patients (adolescent follow-ups, graduating complex-care kids). The
// banner is just a visual cue that specialty-specific tools (growth
// chart, milestone screens) won't carry their usual weight.
const showPediatricAgeAdvisory = computed(() => {
  return authStore.user?.specialty === 'pediatrics'
    && pdStore.patientAge !== null
    && pdStore.patientAge >= 18
})

// Same shape of advisory for OB-GYN viewing a male chart. Prenatal,
// pregnancy, contraception, GYN assessment tools won't apply; the
// doctor may still be running a general-medicine consult so no
// functionality is blocked.
const showObgynMaleAdvisory = computed(() => {
  return authStore.user?.specialty === 'obgyn'
    && pdStore.patient?.sex === 'male'
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
    const id = route.params.id as string
    await pdStore.loadPatient(id)
    await Promise.all([
      encounterStore.loadForPatient(id),
      pdStore.loadCore(),
    ])
    // Load specialty-specific data
    if (specialtyStore.config?.key) {
      pdStore.loadSpecialty(specialtyStore.config.key)
    }
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
    encounterStore.loadForPatient(patient.value?.id ?? '')
  }
})

const editDialogOpen = ref(false)
const mobileCardExpanded = ref(false)

// ── Discard draft ─────────────────────────────────────────────────────────
const discardTarget = ref<typeof draftConsultation.value | null>(null)
const discardOpen = ref(false)
const discardInFlight = ref(false)

function requestDiscardDraft(draft: typeof draftConsultation.value): void {
  if (!draft) return
  discardTarget.value = draft
  discardOpen.value = true
}

async function confirmDiscardDraft(): Promise<void> {
  if (!discardTarget.value) return
  discardInFlight.value = true
  try {
    await encounterStore.deleteEncounter(discardTarget.value.id)
    discardOpen.value = false
    discardTarget.value = null
  } catch {
    toast.error('Failed to discard draft')
  } finally {
    discardInFlight.value = false
  }
}

// Problems count from store
const activeProblemsCount = computed(() =>
  pdStore.problems.filter(p => p.status !== 'resolved').length,
)

// Profile completeness (0 to 1)
const profileCompleteness = computed(() => {
  if (!patient.value) return 0
  return calculatePatientProfileCompleteness(patient.value, displayAvatarUrl.value)
})

// Last visit date from finalized consultations
const lastVisitDate = computed(() => {
  const finalized = visibleConsultations.value.find(c => c.status === 'finalized')
  if (!finalized) return null
  return new Date(finalized.created_at)
})

const lastVisitFormatted = computed(() => {
  if (!lastVisitDate.value) return '—'
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions =
    lastVisitDate.value.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return lastVisitDate.value.toLocaleDateString('en-US', opts)
})

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
  encounterStore.loadForPatient(patient.value.id, filters)
}

function clearFilter() {
  filterMonth.value = ''
  filterYear.value = ''
  if (!patient.value) return
  encounterStore.loadForPatient(patient.value.id)
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
      if (entries[0]?.isIntersecting && patient.value) {
        encounterStore.loadMoreForPatient(patient.value.id)
      }
    },
    { rootMargin: '100px' },
  )
  observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  encounterStore.clearPatientEncounters()
  pdStore.$reset()
})
</script>

<template>
  <div v-if="isLoading" class="flex flex-1 items-center justify-center pt-16">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div
    v-else-if="error"
    role="alert"
    class="surface-card mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {{ error }}
  </div>

  <div
    v-else-if="patient"
    class="-mx-4 -mt-4 -mb-4 flex flex-1 flex-col gap-0 overflow-y-auto md:min-h-0 md:flex-row md:overflow-y-hidden"
  >
    <!-- Left panel -->
    <div class="shrink-0 border-b p-4 md:w-1/3 md:overflow-y-auto md:border-b-0 md:border-r md:p-5">
      <!-- Advisory: pediatrician looking at an adult chart -->
      <div
        v-if="showPediatricAgeAdvisory"
        role="status"
        class="mb-3 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div class="text-xs leading-snug">
          <span class="font-medium">Outside pediatric age range.</span>
          This patient is {{ age }}; pediatric-specific tools (growth chart, milestone tracker) may not apply. No restrictions imposed.
        </div>
      </div>

      <!-- Advisory: OB-GYN looking at a male chart -->
      <div
        v-if="showObgynMaleAdvisory"
        role="status"
        class="mb-3 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div class="text-xs leading-snug">
          <span class="font-medium">Outside OB-GYN patient scope.</span>
          This is a male patient; pregnancy, GYN, and contraception tools won't apply. No restrictions imposed.
        </div>
      </div>

      <!-- Profile card -->
      <div class="surface-card overflow-hidden rounded-3xl border">
        <!-- Inset banner -->
        <div class="relative m-2 rounded-2xl bg-gradient-to-br from-blue-400/30 to-blue-500/30 h-[120px] sm:h-[140px]">
          <button
            type="button"
            class="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-blue-900 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Back"
            @click="router.back()"
          >
            <ArrowLeft class="size-4" />
            Back
          </button>
          <button
            type="button"
            class="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full bg-white/70 text-blue-900 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Edit profile"
            @click="editDialogOpen = true"
          >
            <Pencil class="size-4" />
          </button>
        </div>

        <!-- Avatar with rainbow completeness ring -->
        <div class="-mt-12 flex justify-center relative z-10">
          <PatientCompletenessRing
            :completeness="profileCompleteness"
            content-class="group relative p-[5px]"
          >
            <PatientAvatar
              :avatar-url="displayAvatarUrl"
              :sex="patient.sex"
              :name="patient.full_name"
              class="size-24 ring-2 ring-card ring-offset-0"
            />
            <button
              v-if="authStore.hasPermission('patients.edit')"
              type="button"
              class="absolute inset-[5px] flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              :disabled="isUploadingAvatar"
              aria-label="Upload patient photo"
              @click="avatarCropOpen = true"
            >
              <LoaderCircle v-if="isUploadingAvatar" class="size-4 animate-spin text-white" />
              <Camera v-else class="size-4 text-white" />
            </button>
          </PatientCompletenessRing>
        </div>

        <!-- Name + meta -->
        <div class="mt-2 px-4 text-center">
          <h2 class="text-lg font-bold leading-tight">{{ patient.full_name }}</h2>
          <div class="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              :class="patient.status === 'active' || patient.status === 'returning'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : patient.status === 'new'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-muted text-muted-foreground'"
            >
              {{ patient.status.charAt(0).toUpperCase() + patient.status.slice(1) }}
            </span>
            <template v-if="age !== null">
              <span class="text-muted-foreground text-xs">·</span>
              <span class="text-xs text-muted-foreground">{{ age }}</span>
            </template>
            <span class="text-muted-foreground text-xs">·</span>
            <span class="text-xs text-muted-foreground">{{ patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1) }}</span>
          </div>
        </div>

        <!-- Stats row -->
        <div class="surface-muted mx-3 my-3 rounded-2xl border px-2 py-3">
          <div class="grid grid-cols-3 divide-x divide-border">
            <!-- Visits -->
            <div class="flex flex-col items-center gap-0.5 px-2">
              <span class="text-base font-bold leading-none">{{ visibleConsultations.filter(c => c.status === 'finalized').length }}</span>
              <span class="text-[10px] text-muted-foreground mt-0.5">Visits</span>
            </div>
            <!-- Problems -->
            <div class="flex flex-col items-center gap-0.5 px-2">
              <span class="text-base font-bold leading-none">{{ activeProblemsCount }}</span>
              <span class="text-[10px] text-muted-foreground mt-0.5">Problems</span>
            </div>
            <!-- Last visit -->
            <div class="flex flex-col items-center gap-0.5 px-2">
              <span class="text-base font-bold leading-none truncate max-w-full">{{ lastVisitFormatted }}</span>
              <span class="text-[10px] text-muted-foreground mt-0.5">Last Visit</span>
            </div>
          </div>
        </div>

        <!-- Action grid -->
        <div class="grid grid-cols-2 gap-2 mx-3 mb-3">
          <!-- Continue Draft + Discard (only when a draft exists) -->
          <template v-if="draftConsultation">
            <button
              type="button"
              class="surface-interactive flex flex-col items-center gap-1.5 rounded-2xl border border-transparent py-3 px-1 transition-colors hover:bg-muted/50 active:scale-95"
              @click="router.push({ name: RouteNames.ENCOUNTER_DETAIL, params: { patientId: patient!.id, id: draftConsultation.id } })"
            >
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center text-white">
                <PlayCircle class="size-4" />
              </div>
              <span class="text-[11px] font-medium text-center leading-tight">Continue Draft</span>
            </button>
            <button
              v-if="authStore.hasPermission('encounters.delete')"
              type="button"
              class="surface-interactive flex flex-col items-center gap-1.5 rounded-2xl border border-transparent py-3 px-1 transition-colors hover:bg-muted/50 active:scale-95"
              @click="requestDiscardDraft(draftConsultation)"
            >
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-rose-400 flex items-center justify-center text-white">
                <Trash2 class="size-4" />
              </div>
              <span class="text-[11px] font-medium text-center leading-tight">Discard Draft</span>
            </button>
          </template>

          <!-- No draft → Follow Up + New Consult -->
          <template v-else>
            <button
              v-if="authStore.hasPermission('encounters.create')"
              type="button"
              class="surface-interactive flex flex-col items-center gap-1.5 rounded-2xl border border-transparent py-3 px-1 transition-colors hover:bg-muted/50 active:scale-95"
              @click="router.push({ name: RouteNames.ENCOUNTER_NEW, params: { patientId: patient!.id }, query: { type: 'follow_up' } })"
            >
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-white">
                <ArrowRight class="size-4" />
              </div>
              <span class="text-[11px] font-medium text-center leading-tight">Follow Up</span>
            </button>
            <button
              v-if="authStore.hasPermission('encounters.create')"
              type="button"
              class="surface-interactive flex flex-col items-center gap-1.5 rounded-2xl border border-transparent py-3 px-1 transition-colors hover:bg-muted/50 active:scale-95"
              @click="router.push({ name: RouteNames.ENCOUNTER_NEW, params: { patientId: patient!.id } })"
            >
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-400 flex items-center justify-center text-white">
                <Stethoscope class="size-4" />
              </div>
              <span class="text-[11px] font-medium text-center leading-tight">New Consult</span>
            </button>
          </template>
        </div>

        <!-- Expandable details toggle (mobile only) -->
        <div class="flex justify-center pb-3 md:hidden">
          <button
            type="button"
            class="surface-muted flex h-7 w-7 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted/80"
            :aria-label="mobileCardExpanded ? 'Collapse details' : 'Expand details'"
            @click="mobileCardExpanded = !mobileCardExpanded"
          >
            <ChevronDown v-if="!mobileCardExpanded" class="size-3.5" />
            <ChevronUp v-else class="size-3.5" />
          </button>
        </div>

        <!-- Detail rows — always visible on desktop, toggled on mobile -->
        <div :class="mobileCardExpanded ? 'block' : 'hidden md:block'">
          <div class="px-4 pb-4 space-y-2.5 border-t pt-3">
            <!-- Note -->
            <div v-if="patient.note" class="flex items-start gap-2 text-sm">
              <StickyNote class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p class="whitespace-pre-wrap text-muted-foreground">{{ patient.note }}</p>
            </div>
            <!-- DOB -->
            <div class="flex items-start gap-2 text-sm">
              <CalendarDays class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <span class="text-muted-foreground">Born </span>{{ formatDate(patient.date_of_birth) }}
              </div>
            </div>
            <!-- Sex -->
            <div class="flex items-start gap-2 text-sm">
              <User class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span>{{ patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1) }}</span>
            </div>
            <!-- Blood Type -->
            <div v-if="patient.blood_type" class="flex items-start gap-2 text-sm">
              <FlaskConical class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span>{{ patient.blood_type }}</span>
            </div>
            <!-- Phone -->
            <div v-if="patient.contact_number" class="flex items-start gap-2 text-sm">
              <Phone class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span>{{ patient.contact_number }}</span>
            </div>
            <!-- Email -->
            <div v-if="patient.email" class="flex items-start gap-2 text-sm">
              <Mail class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span class="break-all">{{ patient.email }}</span>
            </div>
            <!-- Address -->
            <div v-if="patient.formatted_address" class="flex items-start gap-2 text-sm">
              <MapPin class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span class="text-muted-foreground">{{ patient.formatted_address }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <div class="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
      <!-- Specialty-specific patient sections (between patient info and consultation timeline) -->
      <PatientSpecialtyFactory class="mb-6" />

      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Stethoscope class="size-4 text-muted-foreground" />
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Consultations
          </h3>
          <span class="surface-muted rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
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
      <div v-if="encounterStore.isLoadingEncounters" class="mt-4">
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
            class="surface-card min-w-0 flex-1 rounded-lg border p-3"
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
              v-if="index < visibleConsultations.length - 1 || encounterStore.hasMore"
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
              v-if="showVitalsComparison && consultation.triage"
              :current="consultation.triage"
              :previous="previousTriage!"
              :encounter-id="consultation.id"
            />
          </div>

          <!-- Finalized card -->
          <FinalizedConsultationCard
            v-else
            :consultation="consultation"
            :patient-id="patient!.id"
            :latest="index === latestFinalizedIndex"
            :previous-vitals="visibleConsultations[index + 1]?.display_summary?.vitals ?? null"
            class="min-w-0 flex-1"
            :class="index < visibleConsultations.length - 1 ? 'mb-3' : ''"
            @show-lab-order="(summary, e) => showLabOrderDialog(summary, e)"
          />
        </div>

        <!-- Infinite scroll sentinel -->
        <!-- Infinite scroll sentinel (skeleton card) -->
        <div
          v-if="encounterStore.hasMore"
          ref="sentinel"
          class="flex gap-3"
        >
          <div class="flex flex-col items-center">
            <Skeleton class="mt-3.5 size-2 shrink-0 rounded-full" />
          </div>
          <div class="surface-card mt-3 min-w-0 flex-1 rounded-lg border p-3">
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

    <!-- Discard Draft Encounter Confirmation -->
    <AlertDialog :open="discardOpen" @update:open="discardOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2">
            <AlertTriangle class="size-5 text-destructive" />
            Discard draft encounter?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the in-progress encounter and everything attached to it. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p class="font-medium text-foreground">The following will be deleted:</p>
          <ul class="mt-2 space-y-1 text-muted-foreground list-disc pl-5">
            <li>Triage vitals &amp; chief complaint</li>
            <li>Assessment notes &amp; diagnoses</li>
            <li>Treatment plan &amp; prescription</li>
            <li>Laboratory orders &amp; results</li>
            <li>Generated documents (if any)</li>
          </ul>
          <p class="mt-2 text-xs text-muted-foreground">
            The queue visit or appointment entry will be retained, but the encounter link will be removed.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="discardInFlight">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="discardInFlight"
            @click="confirmDiscardDraft"
          >
            <LoaderCircle v-if="discardInFlight" class="size-4 animate-spin" />
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
