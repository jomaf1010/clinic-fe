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
  Camera,
  ArrowRight,
  Trash2,
  AlertTriangle,
  HeartPulse,
  CalendarCheck,
  SlidersHorizontal,
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
import type { EncounterStatus } from '@/domains/encounter/types/encounter.types'
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

const latestFinalizedId = computed(() =>
  visibleConsultations.value.find(c => c.status === 'finalized')?.id ?? null,
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

const lastVisitFull = computed(() => {
  if (!lastVisitDate.value) return 'No finalized visits yet'
  return formatDate(lastVisitDate.value.toISOString())
})

const finalizedConsultations = computed(() =>
  visibleConsultations.value.filter(c => c.status === 'finalized'),
)

const draftCount = computed(() =>
  visibleConsultations.value.filter(c => c.status === 'draft').length,
)

const encountersLast12Months = computed(() => {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  return visibleConsultations.value.filter(c => new Date(c.created_at) >= cutoff).length
})

const profilePercent = computed(() => Math.round(profileCompleteness.value * 100))

const careSignal = computed(() => {
  if (draftConsultation.value) {
    return {
      label: 'Draft waiting',
      detail: 'Finish the active encounter before starting another one.',
      tone: 'warning',
    }
  }
  if (activeProblemsCount.value > 0 || pdStore.allergies.length > 0) {
    return {
      label: 'Moderate',
      detail: 'Review active problems and allergy notes during the visit.',
      tone: 'attention',
    }
  }
  return {
    label: 'Stable',
    detail: 'No active problem alerts from the loaded chart.',
    tone: 'stable',
  }
})

const nextMove = computed(() => {
  if (draftConsultation.value) {
    return {
      label: 'Continue draft',
      detail: draftConsultation.value.doctor_name
        ? `Started with Dr. ${draftConsultation.value.doctor_name}`
        : 'Resume the encounter in progress',
      action: 'Continue Encounter',
    }
  }

  return {
    label: 'Ready for consult',
    detail: lastVisitDate.value ? `Last visit was ${lastVisitFormatted.value}` : 'Start this patient’s first encounter',
    action: 'New Consult',
  }
})

const timelineStatusFilter = ref<'all' | EncounterStatus>('all')

const timelineConsultations = computed(() => {
  if (timelineStatusFilter.value === 'all') return visibleConsultations.value
  return visibleConsultations.value.filter(c => c.status === timelineStatusFilter.value)
})

function openNextMove() {
  if (!patient.value) return
  if (draftConsultation.value) {
    router.push({ name: RouteNames.ENCOUNTER_DETAIL, params: { patientId: patient.value.id, id: draftConsultation.value.id } })
    return
  }
  router.push({ name: RouteNames.ENCOUNTER_NEW, params: { patientId: patient.value.id } })
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

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
    class="patient-detail-shell grid flex-1 gap-6 pt-4 xl:grid-cols-[minmax(0,1fr)_360px]"
  >
    <main class="patient-detail-main flex min-w-0 flex-col gap-6">
      <section class="patient-summary-grid grid gap-4">
        <button
          type="button"
          class="patient-summary-card surface-card rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5"
          @click="editDialogOpen = true"
        >
          <div class="patient-summary-body flex items-start gap-4">
            <div
              class="patient-summary-icon"
              :class="careSignal.tone === 'warning'
                ? 'patient-summary-icon--warning'
                : careSignal.tone === 'attention'
                  ? 'patient-summary-icon--danger'
                  : 'patient-summary-icon--stable'"
            >
              <HeartPulse class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-muted-foreground">Care Signal</p>
              <p
                class="mt-2 text-2xl font-bold"
                :class="careSignal.tone === 'warning'
                  ? 'text-amber-500'
                  : careSignal.tone === 'attention'
                    ? 'text-rose-500'
                    : 'text-emerald-500'"
              >
                {{ careSignal.label }}
              </p>
              <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{{ careSignal.detail }}</p>
            </div>
          </div>
          <div class="patient-summary-link mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
            View details
            <ArrowRight class="size-4" />
          </div>
        </button>

        <div class="patient-summary-card surface-card rounded-2xl p-4">
          <div class="patient-summary-body flex items-start gap-4">
            <div class="patient-summary-icon patient-summary-icon--timeline">
              <Clock class="size-5" />
            </div>
            <div>
              <p class="text-sm font-semibold text-muted-foreground">Timeline</p>
              <p class="mt-2 text-3xl font-bold text-primary">{{ encountersLast12Months }}</p>
              <p class="mt-1 text-sm leading-relaxed text-muted-foreground">Encounters in the last 12 months</p>
            </div>
          </div>
          <div class="patient-summary-link mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
            {{ draftCount }} draft{{ draftCount === 1 ? '' : 's' }} loaded
            <ArrowRight class="size-4" />
          </div>
        </div>

        <button
          type="button"
          class="patient-summary-card surface-card rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5"
          @click="editDialogOpen = true"
        >
          <div class="patient-summary-body flex items-start gap-4">
            <div class="patient-summary-icon patient-summary-icon--profile">
              <User class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-muted-foreground">Profile Complete</p>
              <div class="patient-complete-row mt-2 flex items-center gap-3">
                <PatientCompletenessRing :completeness="profileCompleteness" content-class="p-[4px]">
                  <div class="flex size-14 items-center justify-center rounded-full bg-white/55 text-base font-bold text-primary dark:bg-white/10">
                    {{ profilePercent }}%
                  </div>
                </PatientCompletenessRing>
                <p class="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  Chart basics ready
                </p>
              </div>
            </div>
          </div>
          <div class="patient-summary-link mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
            Complete profile
            <ArrowRight class="size-4" />
          </div>
        </button>

        <button
          type="button"
          class="patient-summary-card surface-card rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5"
          @click="openNextMove"
        >
          <div class="patient-summary-body flex items-start gap-4">
            <div class="patient-summary-icon patient-summary-icon--next">
              <CalendarCheck class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-muted-foreground">Next Move</p>
              <p class="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">{{ nextMove.label }}</p>
              <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{{ nextMove.detail }}</p>
            </div>
          </div>
          <div class="patient-summary-link mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
            {{ nextMove.action }}
            <ArrowRight class="size-4" />
          </div>
        </button>
      </section>

      <div class="space-y-3">
        <!-- Advisory: pediatrician looking at an adult chart -->
        <div
          v-if="showPediatricAgeAdvisory"
          role="status"
          class="patient-advisory flex items-start gap-3 rounded-2xl px-4 py-3 text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div class="text-sm leading-snug">
            <span class="font-medium">Outside pediatric age range.</span>
            This patient is {{ age }}; pediatric-specific tools may not apply. No restrictions imposed.
          </div>
        </div>

        <!-- Advisory: OB-GYN looking at a male chart -->
        <div
          v-if="showObgynMaleAdvisory"
          role="status"
          class="patient-advisory flex items-start gap-3 rounded-2xl px-4 py-3 text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div class="text-sm leading-snug">
            <span class="font-medium">Outside OB-GYN patient scope.</span>
            Pregnancy, GYN, and contraception tools won't apply. No restrictions imposed.
          </div>
        </div>
      </div>

      <section class="patient-timeline-card order-2 surface-card rounded-2xl p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div>
              <h2 class="text-lg font-bold">Encounter Timeline</h2>
              <p class="text-sm text-muted-foreground">All encounters, drafts, and clinical documents.</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div class="surface-muted patient-status-tabs inline-flex rounded-xl p-1">
              <button
                type="button"
                class="patient-status-tab"
                :class="{ 'is-active': timelineStatusFilter === 'all' }"
                @click="timelineStatusFilter = 'all'"
              >
                All
              </button>
              <button
                type="button"
                class="patient-status-tab"
                :class="{ 'is-active': timelineStatusFilter === 'draft' }"
                @click="timelineStatusFilter = 'draft'"
              >
                Drafts
              </button>
              <button
                type="button"
                class="patient-status-tab"
                :class="{ 'is-active': timelineStatusFilter === 'finalized' }"
                @click="timelineStatusFilter = 'finalized'"
              >
                Finalized
              </button>
            </div>

            <div class="flex items-center gap-2">
              <Select v-model="filterMonth">
                <SelectTrigger class="patient-filter-trigger h-10 w-[130px] rounded-xl text-sm">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="m in months" :key="m.value" :value="m.value">
                    {{ m.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select v-model="filterYear">
                <SelectTrigger class="patient-filter-trigger h-10 w-[96px] rounded-xl text-sm">
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
                class="patient-icon-button surface-muted"
                @click="clearFilter"
              >
                <X class="size-4" />
              </button>
              <div v-else class="patient-icon-button surface-muted" aria-hidden="true">
                <SlidersHorizontal class="size-4" />
              </div>
            </div>
          </div>
        </div>

        <!-- Skeleton loading state -->
        <div v-if="encounterStore.isLoadingEncounters" class="mt-6">
          <div
            v-for="n in 5"
            :key="n"
            class="patient-timeline-row flex gap-4"
          >
            <div class="patient-timeline-marker-col">
              <Skeleton class="mt-3 size-8 shrink-0 rounded-full" />
              <div v-if="n < 5" class="patient-timeline-line" />
            </div>
            <div
              class="patient-timeline-skeleton surface-card min-w-0 flex-1 rounded-2xl p-4"
              :class="n < 5 ? 'mb-3' : ''"
            >
              <Skeleton class="mb-3 h-3 w-24" />
              <Skeleton class="mb-2 h-5 w-3/4" />
              <Skeleton class="mb-4 h-3 w-1/2" />
              <div class="flex gap-2">
                <Skeleton class="h-8 w-24 rounded-xl" />
                <Skeleton class="h-8 w-20 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="timelineConsultations.length === 0"
          class="patient-empty-state mt-6 flex flex-col items-center justify-center rounded-2xl py-14 text-center text-muted-foreground"
        >
          <Stethoscope class="mb-3 size-10 opacity-60" />
          <p class="text-sm font-medium text-foreground">No encounters match this view yet</p>
          <p class="mt-1 max-w-sm text-sm">When the patient has activity here, the clinical story will show up in the timeline.</p>
        </div>

        <!-- Timeline -->
        <div v-else class="mt-6">
          <div
            v-for="(consultation, index) in timelineConsultations"
            :key="consultation.id"
            class="patient-timeline-row flex gap-4"
          >
            <div class="patient-timeline-marker-col">
              <div
                class="patient-timeline-marker"
                :class="
                  consultation.status === 'draft'
                    ? 'patient-timeline-marker--draft'
                    : consultation.id === latestFinalizedId
                      ? 'patient-timeline-marker--latest'
                      : 'patient-timeline-marker--finalized'
                "
              >
                <Pencil v-if="consultation.status === 'draft'" class="size-3.5" />
                <CheckCircle2 v-else class="size-3.5" />
              </div>
              <div
                v-if="index < timelineConsultations.length - 1 || encounterStore.hasMore"
                class="patient-timeline-line"
                :class="{ 'patient-timeline-line--draft': consultation.status === 'draft' }"
              />
            </div>

            <!-- Draft card + vitals comparison -->
            <div v-if="consultation.status === 'draft'" class="min-w-0 flex-1 flex flex-col gap-3" :class="index < timelineConsultations.length - 1 ? 'mb-3' : ''">
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
              :latest="consultation.id === latestFinalizedId"
              :previous-vitals="timelineConsultations[index + 1]?.display_summary?.vitals ?? null"
              class="min-w-0 flex-1"
              :class="index < timelineConsultations.length - 1 ? 'mb-3' : ''"
              @show-lab-order="(summary, e) => showLabOrderDialog(summary, e)"
            />
          </div>

          <!-- Infinite scroll sentinel (skeleton card) -->
          <div
            v-if="encounterStore.hasMore && timelineStatusFilter === 'all'"
            ref="sentinel"
            class="patient-timeline-row flex gap-4"
          >
            <div class="patient-timeline-marker-col">
              <Skeleton class="mt-3 size-8 shrink-0 rounded-full" />
            </div>
            <div class="patient-timeline-skeleton surface-card mt-3 min-w-0 flex-1 rounded-2xl p-4">
              <Skeleton class="mb-2 h-3 w-24" />
              <Skeleton class="mb-2 h-4 w-3/4" />
              <Skeleton class="mb-3 h-3 w-1/2" />
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle class="size-3.5 animate-spin" />
                Loading more...
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="patient-modules-card order-1 surface-card rounded-2xl p-5">
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div>
              <h2 class="text-lg font-bold">Specialty Modules</h2>
              <p class="text-sm text-muted-foreground">Clinical modules tailored to this patient’s care.</p>
            </div>
          </div>
        </div>
        <PatientSpecialtyFactory class="patient-specialty-grid" />
      </section>
    </main>

    <aside class="patient-profile-sidebar xl:self-start">
      <section class="patient-profile-card surface-card overflow-hidden rounded-2xl">
        <div class="patient-profile-banner relative">
          <div class="absolute left-4 top-4">
            <button
              type="button"
              class="patient-banner-button"
              aria-label="Back"
              @click="router.back()"
            >
              <ArrowLeft class="size-4" />
            </button>
          </div>
          <div class="absolute right-4 top-4">
            <span
              class="patient-status-pill"
              :class="patient.status === 'active' || patient.status === 'returning'
                ? 'patient-status-pill--active'
                : patient.status === 'new'
                  ? 'patient-status-pill--new'
                  : 'patient-status-pill--muted'"
            >
              <span class="size-2 rounded-full bg-current" />
              {{ statusLabel(patient.status) }}
            </span>
          </div>
          <div class="absolute inset-x-0 -bottom-12 flex justify-center">
            <PatientCompletenessRing
              :completeness="profileCompleteness"
              content-class="group relative p-[6px]"
            >
              <PatientAvatar
                :avatar-url="displayAvatarUrl"
                :sex="patient.sex"
                :name="patient.full_name"
                class="size-28 ring-4 ring-white/70 dark:ring-slate-950/50"
              />
              <button
                v-if="authStore.hasPermission('patients.edit')"
                type="button"
                class="absolute inset-[6px] flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                :disabled="isUploadingAvatar"
                aria-label="Upload patient photo"
                @click="avatarCropOpen = true"
              >
                <LoaderCircle v-if="isUploadingAvatar" class="size-4 animate-spin text-white" />
                <Camera v-else class="size-4 text-white" />
              </button>
            </PatientCompletenessRing>
          </div>
        </div>

        <div class="px-5 pb-5 pt-16">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-2xl font-bold leading-tight">{{ patient.full_name }}</h1>
              <p class="mt-3 text-sm font-medium text-muted-foreground">
                <template v-if="age !== null">{{ age }}</template>
                <template v-if="age !== null"> · </template>
                {{ statusLabel(patient.sex) }}
              </p>
              <p class="mt-1 text-sm text-muted-foreground">Born on {{ formatDate(patient.date_of_birth) }}</p>
            </div>
            <button
              v-if="authStore.hasPermission('patients.edit')"
              type="button"
              class="patient-icon-button surface-muted shrink-0"
              aria-label="Edit profile"
              @click="editDialogOpen = true"
            >
              <Pencil class="size-4" />
            </button>
          </div>

          <div class="patient-profile-actions mt-5 grid gap-2">
            <button
              v-if="draftConsultation"
              type="button"
              class="patient-primary-action"
              @click="openNextMove"
            >
              <PlayCircle class="size-4" />
              Continue Encounter
            </button>
            <button
              v-else-if="authStore.hasPermission('encounters.create')"
              type="button"
              class="patient-primary-action"
              @click="openNextMove"
            >
              <Stethoscope class="size-4" />
              New Consult
            </button>
            <button
              v-if="!draftConsultation && authStore.hasPermission('encounters.create')"
              type="button"
              class="patient-secondary-action surface-muted"
              @click="router.push({ name: RouteNames.ENCOUNTER_NEW, params: { patientId: patient!.id }, query: { type: 'follow_up' } })"
            >
              <ArrowRight class="size-4" />
              Follow Up
            </button>
            <button
              v-if="draftConsultation && authStore.hasPermission('encounters.delete')"
              type="button"
              class="patient-secondary-action surface-muted text-destructive hover:text-destructive"
              @click="requestDiscardDraft(draftConsultation)"
            >
              <Trash2 class="size-4" />
              Discard Draft
            </button>
          </div>

          <div class="patient-contact-list mt-5 space-y-3">
            <a
              v-if="patient.email"
              :href="`mailto:${patient.email}`"
              class="patient-contact-row"
            >
              <Mail class="size-4" />
              <span class="min-w-0 break-all">{{ patient.email }}</span>
            </a>
            <a
              v-if="patient.contact_number"
              :href="`tel:${patient.contact_number}`"
              class="patient-contact-row"
            >
              <Phone class="size-4" />
              <span>{{ patient.contact_number }}</span>
            </a>
            <div v-if="patient.formatted_address" class="patient-contact-row">
              <MapPin class="size-4" />
              <span>{{ patient.formatted_address }}</span>
            </div>
            <div v-if="patient.blood_type" class="patient-contact-row">
              <FlaskConical class="size-4" />
              <span>{{ patient.blood_type }}</span>
            </div>
            <div v-if="patient.note" class="patient-contact-row items-start">
              <StickyNote class="mt-0.5 size-4" />
              <span class="whitespace-pre-wrap">{{ patient.note }}</span>
            </div>
          </div>

          <div class="patient-profile-stats surface-muted mt-5 grid grid-cols-3 rounded-2xl p-4 text-center">
            <div>
              <p class="text-2xl font-bold text-primary">{{ finalizedConsultations.length }}</p>
              <p class="mt-1 text-xs text-muted-foreground">Visits</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-primary">{{ activeProblemsCount }}</p>
              <p class="mt-1 text-xs text-muted-foreground">Active Problems</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-primary">{{ pdStore.medications.filter(m => m.status === 'active').length }}</p>
              <p class="mt-1 text-xs text-muted-foreground">Medications</p>
            </div>
          </div>

          <div class="patient-mini-card surface-muted mt-5 rounded-2xl p-4">
            <div class="flex items-start gap-3">
              <CalendarDays class="mt-0.5 size-5 text-primary" />
              <div>
                <p class="text-sm font-semibold">Last Visit</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ lastVisitFull }}</p>
                <p v-if="finalizedConsultations[0]?.doctor_name" class="text-sm text-muted-foreground">Dr. {{ finalizedConsultations[0].doctor_name }}</p>
              </div>
            </div>
          </div>

          <div class="patient-mini-card surface-muted mt-4 rounded-2xl p-4">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-semibold">Chart Readiness</p>
                <p class="mt-1 text-sm text-muted-foreground">Profile and core clinical fields</p>
              </div>
              <span class="text-sm font-bold text-emerald-600 dark:text-emerald-300">{{ profilePercent }}%</span>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                class="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500"
                :style="{ width: `${profilePercent}%` }"
              />
            </div>
          </div>
        </div>
      </section>
    </aside>

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
.patient-detail-shell {
  align-items: start;
}

.patient-summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(15.5rem, 1fr));
}

@media (min-width: 1536px) {
  .patient-summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.patient-summary-card,
.patient-timeline-card,
.patient-modules-card,
.patient-profile-card,
.patient-timeline-skeleton {
  position: relative;
  border: 0;
  background:
    radial-gradient(circle at 16% 0%, rgb(59 130 246 / 0.08), transparent 34%),
    radial-gradient(circle at 84% 18%, rgb(20 184 166 / 0.08), transparent 32%),
    linear-gradient(135deg, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.44) 56%, rgb(255 255 255 / 0.58)),
    var(--surface-panel-strong);
  overflow: hidden;
}

.patient-summary-card {
  display: flex;
  min-height: 13rem;
  flex-direction: column;
  justify-content: space-between;
}

.patient-summary-body {
  min-height: 0;
}

.patient-complete-row {
  min-width: 0;
}

.patient-summary-card:hover {
  box-shadow: var(--surface-shadow-strong);
}

.patient-summary-card::before,
.patient-timeline-card::before,
.patient-modules-card::before,
.patient-profile-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.55),
    inset 1px 0 0 rgb(255 255 255 / 0.28);
}

.patient-summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: white;
  transform: translateZ(0);
  box-shadow:
    0 14px 30px rgb(15 23 42 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.patient-summary-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 1.25rem;
}

.patient-summary-icon--danger {
  background: linear-gradient(135deg, rgb(251 113 133), rgb(249 115 22));
  box-shadow: 0 14px 30px rgb(244 63 94 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.patient-summary-icon--warning {
  background: linear-gradient(135deg, rgb(245 158 11), rgb(20 184 166));
  box-shadow: 0 14px 30px rgb(245 158 11 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.patient-summary-icon--stable,
.patient-summary-icon--next {
  background: linear-gradient(135deg, rgb(16 185 129), rgb(20 184 166));
  box-shadow: 0 14px 30px rgb(20 184 166 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.patient-summary-icon--timeline {
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow: 0 14px 30px rgb(37 99 235 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.patient-summary-icon--profile {
  background: linear-gradient(135deg, rgb(96 165 250), rgb(14 165 233));
  box-shadow: 0 14px 30px rgb(14 165 233 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.patient-summary-link {
  padding-top: 0.9rem;
  border-top: 1px solid rgb(255 255 255 / 0.36);
}

.patient-advisory {
  background:
    radial-gradient(circle at 12% 10%, rgb(245 158 11 / 0.14), transparent 34%),
    rgb(255 255 255 / 0.42);
  box-shadow: inset 0 0 0 1px rgb(245 158 11 / 0.18);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.patient-status-tabs {
  border: 0;
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.06);
}

.patient-status-tab {
  min-width: 4.5rem;
  border-radius: 0.75rem;
  padding: 0.55rem 0.85rem;
  color: var(--muted-foreground);
  font-size: 0.875rem;
  font-weight: 600;
  transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

.patient-status-tab.is-active {
  color: white;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow:
    0 12px 26px rgb(37 99 235 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.26);
}

.patient-filter-trigger,
.patient-icon-button,
.patient-banner-button,
.patient-secondary-action {
  border: 0;
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.06);
}

.patient-icon-button,
.patient-banner-button {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: var(--foreground);
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
}

.patient-icon-button:hover,
.patient-banner-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--surface-shadow-strong);
}

.patient-timeline-marker-col {
  display: flex;
  width: 2.25rem;
  flex: none;
  flex-direction: column;
  align-items: center;
}

.patient-timeline-marker {
  margin-top: 0.5rem;
  display: flex;
  width: 2rem;
  height: 2rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: white;
  box-shadow:
    0 10px 22px rgb(15 23 42 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.patient-timeline-marker--draft {
  background: linear-gradient(135deg, rgb(245 158 11), rgb(249 115 22));
}

.patient-timeline-marker--latest {
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  animation: pulse-primary 2.2s ease-out infinite;
}

.patient-timeline-marker--finalized {
  background: linear-gradient(135deg, rgb(20 184 166), rgb(16 185 129));
}

.patient-timeline-line {
  margin-top: 0.5rem;
  width: 2px;
  flex: 1 1 auto;
  min-height: 2rem;
  background: linear-gradient(to bottom, rgb(37 99 235 / 0.22), rgb(20 184 166 / 0.14));
}

.patient-timeline-line--draft {
  background: linear-gradient(to bottom, rgb(245 158 11 / 0.38), rgb(20 184 166 / 0.16));
}

.patient-empty-state {
  background: rgb(255 255 255 / 0.28);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.28);
}

.patient-profile-sidebar {
  min-width: 0;
}

@media (max-width: 1279px) {
  .patient-profile-sidebar {
    order: -1;
  }
}

.patient-profile-banner {
  height: 11.5rem;
  background:
    radial-gradient(circle at 26% 24%, rgb(255 255 255 / 0.58), transparent 24%),
    radial-gradient(circle at 88% 8%, rgb(20 184 166 / 0.22), transparent 28%),
    linear-gradient(135deg, rgb(125 211 252 / 0.5), rgb(20 184 166 / 0.2) 48%, rgb(59 130 246 / 0.24));
}

.patient-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 9999px;
  padding: 0.55rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 700;
  background: rgb(255 255 255 / 0.7);
  box-shadow: 0 12px 26px rgb(15 23 42 / 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.patient-status-pill--active {
  color: rgb(5 150 105);
}

.patient-status-pill--new {
  color: rgb(37 99 235);
}

.patient-status-pill--muted {
  color: var(--muted-foreground);
}

.patient-contact-list {
  padding-top: 1rem;
  border-top: 1px solid rgb(255 255 255 / 0.36);
}

.patient-contact-row {
  display: flex;
  gap: 0.9rem;
  align-items: center;
  color: var(--muted-foreground);
  font-size: 0.875rem;
  line-height: 1.5;
}

.patient-contact-row svg {
  flex: none;
  color: rgb(100 116 139 / 0.9);
}

.patient-profile-stats {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.28);
}

.patient-profile-stats > div + div {
  box-shadow: inset 1px 0 0 rgb(255 255 255 / 0.34);
}

.patient-mini-card {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.28);
}

.patient-primary-action,
.patient-secondary-action {
  display: inline-flex;
  min-height: 3rem;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  border-radius: 9999px;
  font-weight: 700;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.patient-primary-action {
  color: white;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow:
    0 16px 34px rgb(37 99 235 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.26);
}

.patient-primary-action:hover,
.patient-secondary-action:hover {
  transform: translateY(-1px);
}

:global(.patient-specialty-grid > *) {
  min-width: 0;
}

:global(.dark .patient-summary-card),
:global(.dark .patient-timeline-card),
:global(.dark .patient-modules-card),
:global(.dark .patient-profile-card),
:global(.dark .patient-timeline-skeleton) {
  background:
    radial-gradient(circle at 86% 88%, rgb(20 184 166 / 0.12), transparent 34%),
    radial-gradient(circle at 18% 10%, rgb(59 130 246 / 0.12), transparent 30%),
    linear-gradient(135deg, rgb(15 23 42 / 0.58), rgb(15 23 42 / 0.28) 54%, rgb(15 23 42 / 0.42)),
    rgb(15 23 42 / 0.12);
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 1px 0 0 rgb(255 255 255 / 0.035),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .patient-summary-link),
:global(.dark .patient-contact-list) {
  border-color: rgb(255 255 255 / 0.1);
}

:global(.dark .patient-advisory) {
  background:
    radial-gradient(circle at 12% 10%, rgb(245 158 11 / 0.16), transparent 34%),
    rgb(15 23 42 / 0.3);
  box-shadow: inset 0 0 0 1px rgb(245 158 11 / 0.18);
}

:global(.dark .patient-status-tabs) {
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.62), rgb(15 23 42 / 0.28)),
    rgb(15 23 42 / 0.2);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 16px 38px rgb(0 0 0 / 0.26);
}

:global(.dark .patient-status-tab.is-active) {
  box-shadow:
    0 0 0 1px rgb(125 211 252 / 0.14),
    0 14px 34px rgb(56 189 248 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}

:global(.dark .patient-filter-trigger),
:global(.dark .patient-icon-button),
:global(.dark .patient-banner-button),
:global(.dark .patient-secondary-action),
:global(.dark .patient-mini-card),
:global(.dark .patient-profile-stats) {
  background:
    linear-gradient(145deg, rgb(15 23 42 / 0.76), rgb(2 6 23 / 0.52)),
    rgb(15 23 42 / 0.5) !important;
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 14px 30px rgb(0 0 0 / 0.22);
}

:global(.dark .patient-profile-banner) {
  background:
    radial-gradient(circle at 28% 22%, rgb(59 130 246 / 0.24), transparent 28%),
    radial-gradient(circle at 88% 8%, rgb(20 184 166 / 0.16), transparent 30%),
    linear-gradient(135deg, rgb(15 23 42 / 0.8), rgb(2 6 23 / 0.5) 56%, rgb(15 23 42 / 0.62));
}

:global(.dark .patient-status-pill) {
  background: rgb(15 23 42 / 0.72);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    0 12px 26px rgb(0 0 0 / 0.24);
}

:global(.dark .patient-profile-stats > div + div) {
  box-shadow: inset 1px 0 0 rgb(255 255 255 / 0.08);
}

@keyframes pulse-primary {
  0% {
    box-shadow:
      0 14px 30px rgb(37 99 235 / 0.18),
      0 0 0 0 rgb(37 99 235 / 0.32),
      inset 0 1px 0 rgb(255 255 255 / 0.28);
  }
  100% {
    box-shadow:
      0 14px 30px rgb(37 99 235 / 0.18),
      0 0 0 12px rgb(37 99 235 / 0),
      inset 0 1px 0 rgb(255 255 255 / 0.28);
  }
}

</style>
