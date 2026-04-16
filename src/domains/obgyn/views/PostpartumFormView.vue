<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HttpError } from '@/lib/http'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Baby,
  Check as CheckIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CalendarDays,
  ClipboardList,
  Clock,
  DollarSign,
  LoaderCircle,
  Lock,
  Stethoscope,
  WifiOff,
  X,
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import ComboboxViewport from '@/components/ui/combobox/ComboboxViewport.vue'
import { ComboboxInput } from 'reka-ui'
import { toast } from 'vue-sonner'
import { useOfflineSync } from '@/composables/useOfflineSync'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { useEncounterSync } from '@/domains/encounter/composables/useEncounterSync'
import { usePatientSync } from '@/domains/patient/composables/usePatientSync'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import { CalendarDate, today, getLocalTimeZone, getDayOfWeek } from '@internationalized/date'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import type { DaySchedule, Slot } from '@/domains/schedule/types/schedule.types'
import PaymentTab from '@/domains/consultation/components/tabs/PaymentTab.vue'
import PrescriptionSection from '@/domains/consultation/components/PrescriptionSection.vue'
import LabOrderSection from '@/domains/consultation/components/LabOrderSection.vue'
import ProcedureSection from '@/domains/service/components/ProcedureSection.vue'
import type {
  PostpartumTriage,
  PostpartumAssessment,
  PostpartumPlan,
} from '@/domains/encounter/types/encounter.types'
import type { ContraceptionMethod } from '@/domains/obgyn/types/obgyn.types'
import { CONTRACEPTION_OPTIONS, contraceptionLabel } from '@/domains/obgyn/types/obgyn.types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
const { isOnline, pendingCount } = useOfflineSync()

const encounterId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const patientId = computed(() => store.current?.patient_id)
const { prescriptionUpdate, labOrderUpdate, documentUpdate } = useEncounterSync(encounterId, clinicId)
usePatientSync(patientId, clinicId, () => {})

const canFinalize = computed(() => authStore.hasPermission('consultations.finalize'))

const activeTab = ref('triage')
const showFinalizeModal = ref(false)
const loadError = ref<string | null>(null)

// ── Days postpartum (read-only, from encounter) ───────────────────────────
const daysPostpartum = computed(() => store.current?.postpartum_visit?.days_postpartum ?? null)

// ── Local triage state ────────────────────────────────────────────────────
const localTriage = reactive<{
  concerns: string | null
  vitals: {
    bp_systolic: number | null
    bp_diastolic: number | null
    heart_rate: number | null
    respiratory_rate: number | null
    temperature: number | null
    weight: number | null
  }
}>({
  concerns: null,
  vitals: {
    bp_systolic: null,
    bp_diastolic: null,
    heart_rate: null,
    respiratory_rate: null,
    temperature: null,
    weight: null,
  },
})

// ── Local assessment state ────────────────────────────────────────────────
const localAssessment = reactive<{
  general_recovery: string | null
  lochia: PostpartumAssessment['lochia']
  wound_healing: PostpartumAssessment['wound_healing']
  incision_notes: string | null
  breast_exam: string | null
  abdominal_exam: string | null
  phq2_q1: number | null
  phq2_q2: number | null
}>({
  general_recovery: null,
  lochia: null,
  wound_healing: null,
  incision_notes: null,
  breast_exam: null,
  abdominal_exam: null,
  phq2_q1: null,
  phq2_q2: null,
})

// ── Local plan state ──────────────────────────────────────────────────────
const localPlan = reactive<{
  contraception_discussed: boolean
  contraception_methods: string[]
  infant_feeding: PostpartumPlan['infant_feeding']
  breastfeeding_challenges: string | null
  return_to_activity_cleared: boolean
  sexual_activity_cleared: boolean
  additional_follow_up_needed: boolean
  next_visit_date: string | null
  notes: string | null
}>({
  contraception_discussed: false,
  contraception_methods: [],
  infant_feeding: null,
  breastfeeding_challenges: null,
  return_to_activity_cleared: false,
  sexual_activity_cleared: false,
  additional_follow_up_needed: false,
  next_visit_date: null,
  notes: null,
})

// ── PHQ-2 computed ────────────────────────────────────────────────────────
const phq2Total = computed(() => {
  const q1 = localAssessment.phq2_q1 ?? 0
  const q2 = localAssessment.phq2_q2 ?? 0
  if (localAssessment.phq2_q1 === null && localAssessment.phq2_q2 === null) return null
  return q1 + q2
})

const phq2RiskLevel = computed((): 'none' | 'low' | 'moderate' | 'high' | null => {
  const t = phq2Total.value
  if (t === null) return null
  if (t === 0) return 'none'
  if (t <= 2) return 'low'
  if (t <= 4) return 'moderate'
  return 'high'
})

const phq2RiskClass = computed(() => {
  switch (phq2RiskLevel.value) {
    case 'none': return 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
    case 'low': return 'border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
    case 'moderate': return 'border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-400'
    case 'high': return 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400'
    default: return ''
  }
})

const showIncisionNotes = computed(() => localAssessment.wound_healing !== 'intact' && localAssessment.wound_healing !== null)
const showBreastfeedingChallenges = computed(() => localPlan.infant_feeding === 'breastfeeding' || localPlan.infant_feeding === 'mixed')

// ── Sync local state from store ───────────────────────────────────────────
function syncFromStore() {
  const visit = store.current?.postpartum_visit
  if (!visit) return

  const t = visit.triage as PostpartumTriage
  localTriage.concerns = t.concerns
  localTriage.vitals = { ...t.vitals }

  const a = visit.assessment as PostpartumAssessment
  localAssessment.general_recovery = a.general_recovery
  localAssessment.lochia = a.lochia
  localAssessment.wound_healing = a.wound_healing
  localAssessment.incision_notes = a.incision_notes
  localAssessment.breast_exam = a.breast_exam
  localAssessment.abdominal_exam = a.abdominal_exam
  localAssessment.phq2_q1 = a.phq2?.q1 ?? null
  localAssessment.phq2_q2 = a.phq2?.q2 ?? null

  const p = visit.plan as PostpartumPlan
  localPlan.contraception_discussed = p.contraception_discussed
  localPlan.contraception_methods = Array.isArray(p.contraception_method) ? [...p.contraception_method] : p.contraception_method ? [p.contraception_method] : []
  localPlan.infant_feeding = p.infant_feeding
  localPlan.breastfeeding_challenges = p.breastfeeding_challenges
  localPlan.return_to_activity_cleared = p.return_to_activity_cleared
  localPlan.sexual_activity_cleared = p.sexual_activity_cleared
  localPlan.additional_follow_up_needed = p.additional_follow_up_needed
  localPlan.next_visit_date = p.next_visit_date
  localPlan.notes = p.notes
}

watch(() => store.current?.postpartum_visit, () => syncFromStore(), { deep: true })

// ── Save helpers ──────────────────────────────────────────────────────────
function saveTriageSection() {
  store.saveSection({
    triage: {
      concerns: localTriage.concerns,
      vitals: { ...localTriage.vitals },
    },
  })
}

function saveAssessmentSection() {
  store.saveSection({
    assessment: {
      general_recovery: localAssessment.general_recovery,
      lochia: localAssessment.lochia,
      wound_healing: localAssessment.wound_healing,
      incision_notes: localAssessment.incision_notes,
      breast_exam: localAssessment.breast_exam,
      abdominal_exam: localAssessment.abdominal_exam,
      phq2: {
        q1: localAssessment.phq2_q1,
        q2: localAssessment.phq2_q2,
        total: phq2Total.value,
        risk_level: phq2RiskLevel.value,
      },
    },
  })
}

const isPPNoneSelected = computed(() => localPlan.contraception_methods.includes('none'))

function togglePPContraception(method: string): void {
  const idx = localPlan.contraception_methods.indexOf(method)
  if (idx === -1) {
    if (method === 'none') {
      localPlan.contraception_methods = ['none']
    } else {
      if (isPPNoneSelected.value) return
      localPlan.contraception_methods.push(method)
    }
  } else {
    localPlan.contraception_methods.splice(idx, 1)
  }
}

watch(() => localPlan.contraception_methods.length, () => {
  if (localPlan.contraception_methods.includes('none') && localPlan.contraception_methods.length > 1) {
    localPlan.contraception_methods = ['none']
  }
})

function savePlanSection() {
  store.saveSection({
    plan: {
      contraception_discussed: localPlan.contraception_discussed,
      contraception_method: localPlan.contraception_discussed ? localPlan.contraception_methods : [],
      infant_feeding: localPlan.infant_feeding,
      breastfeeding_challenges: showBreastfeedingChallenges.value ? localPlan.breastfeeding_challenges : null,
      return_to_activity_cleared: localPlan.return_to_activity_cleared,
      sexual_activity_cleared: localPlan.sexual_activity_cleared,
      additional_follow_up_needed: localPlan.additional_follow_up_needed,
      next_visit_date: localPlan.next_visit_date,
      notes: localPlan.notes,
    },
  })
}

// ── Smart follow-up scheduling ──────────────────────────────────────────────
const workingDays = ref<DaySchedule[]>([])
const scheduleLoading = ref(false)
const followUpSlots = ref<Slot[]>([])
const followUpSlotsLoading = ref(false)
const followUpSelectedDate = ref<string | null>(null)
const followUpSelectedSlot = ref<string | null>(null)
const isBookingFollowUp = ref(false)
const followUpBooked = ref(false)

const enabledWeekdays = computed(() => {
  const days = workingDays.value
  if (!days.length) return new Set<number>()
  return new Set(days.filter((d) => d.enabled).map((d) => d.day))
})

function isDateUnavailable(date: { year: number; month: number; day: number }): boolean {
  if (enabledWeekdays.value.size === 0) return false
  const calDate = new CalendarDate(date.year, date.month, date.day)
  const dow = getDayOfWeek(calDate, 'en-US')
  return !enabledWeekdays.value.has(dow)
}

const availableFollowUpSlots = computed(() => followUpSlots.value.filter((s) => s.available))

const followUpCalendarValue = computed(() => {
  const d = followUpSelectedDate.value
  if (!d) return undefined
  const dt = new Date(d + 'T00:00')
  return new CalendarDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
})

const followUpDisplay = computed(() => {
  if (!followUpSelectedDate.value) return null
  return new Date(followUpSelectedDate.value).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
})

function formatSlotTime(isoDatetime: string): string {
  return new Date(isoDatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

async function loadDoctorSchedule(): Promise<void> {
  const doctorId = store.current?.doctor_id ?? authStore.user?.id
  if (!doctorId) return
  scheduleLoading.value = true
  try {
    const res = await scheduleApi.getSchedule(doctorId)
    workingDays.value = res.data.days
  } catch {
    // No schedule configured — allow all days
  } finally {
    scheduleLoading.value = false
  }
}

async function onFollowUpDateSelect(date: CalendarDate): Promise<void> {
  const iso = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  followUpSelectedDate.value = iso
  followUpSelectedSlot.value = null
  followUpBooked.value = false

  const doctorId = store.current?.doctor_id ?? authStore.user?.id
  if (!doctorId) return
  followUpSlotsLoading.value = true
  try {
    const res = await scheduleApi.getAvailability(doctorId, iso)
    followUpSlots.value = res.data.slots
  } catch {
    followUpSlots.value = []
  } finally {
    followUpSlotsLoading.value = false
  }
}

async function bookFollowUpSlot(slot: Slot): Promise<void> {
  if (!store.current) return
  followUpSelectedSlot.value = slot.start
  isBookingFollowUp.value = true
  try {
    await appointmentApi.create({
      patient_id: store.current.patient_id,
      doctor_id: store.current.doctor_id ?? authStore.user!.id,
      scheduled_at: slot.start,
      reason: 'Postpartum visit',
      consultation_type: 'follow_up',
    })
    followUpBooked.value = true
    localPlan.next_visit_date = followUpSelectedDate.value ?? ''
    savePlanSection()
    toast.success('Follow-up appointment booked')
  } catch {
    toast.error('Failed to book appointment')
    followUpSelectedSlot.value = null
  } finally {
    isBookingFollowUp.value = false
  }
}

function clearFollowUp(): void {
  localPlan.next_visit_date = ''
  followUpSelectedDate.value = null
  followUpSelectedSlot.value = null
  followUpSlots.value = []
  followUpBooked.value = false
  savePlanSection()
}

// Postpartum milestone-based recommended date
const recommendedDate = computed(() => {
  const days = daysPostpartum.value ?? 0
  const deliveredAt = store.current?.postpartum_visit?.days_postpartum != null
    ? new Date(Date.now() - (store.current.postpartum_visit.days_postpartum * 24 * 60 * 60 * 1000))
    : new Date()
  const isCS = store.current?.delivery_record?.delivery?.delivery_mode === 'cesarean'

  let targetDay: number
  if (days < 7) {
    targetDay = isCS ? 7 : 7
  } else if (isCS && days < 10) {
    targetDay = 10
  } else if (days < 14) {
    targetDay = 14
  } else if (days < 42) {
    targetDay = 42
  } else {
    targetDay = 56
  }

  const target = new Date(deliveredAt.getTime() + targetDay * 24 * 60 * 60 * 1000)
  // Don't recommend dates in the past
  if (target.getTime() < Date.now()) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 7)
    return tomorrow.toISOString().slice(0, 10)
  }
  return target.toISOString().slice(0, 10)
})

const recommendedDateDisplay = computed(() => {
  if (!recommendedDate.value) return ''
  return new Date(recommendedDate.value + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
})

const isCheckingRecommended = ref(false)
const recommendedUnavailable = ref(false)
const earlierAlternative = ref<{ date: string; display: string } | null>(null)
const laterAlternative = ref<{ date: string; display: string } | null>(null)

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateDisplay(iso: string): string {
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

async function checkDateHasSlots(iso: string): Promise<boolean> {
  const doctorId = store.current?.doctor_id ?? authStore.user?.id
  if (!doctorId) return false
  try {
    const res = await scheduleApi.getAvailability(doctorId, iso)
    return res.data.slots.some((s) => s.available)
  } catch {
    return false
  }
}

function isWorkingDay(iso: string): boolean {
  const d = new Date(iso + 'T00:00')
  const calDate = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return !isDateUnavailable({ year: calDate.year, month: calDate.month, day: calDate.day })
}

async function checkRecommendedAvailability(): Promise<void> {
  isCheckingRecommended.value = true
  recommendedUnavailable.value = false
  earlierAlternative.value = null
  laterAlternative.value = null

  const targetIso = recommendedDate.value
  const targetDate = new Date(targetIso + 'T00:00')

  if (isWorkingDay(targetIso) && await checkDateHasSlots(targetIso)) {
    isCheckingRecommended.value = false
    return
  }

  recommendedUnavailable.value = true
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const findEarlier = (async () => {
    for (let i = 1; i <= 14; i++) {
      const candidate = new Date(targetDate.getTime() - i * 86400000)
      if (candidate < tomorrow) break
      const iso = dateToIso(candidate)
      if (isWorkingDay(iso) && await checkDateHasSlots(iso)) {
        earlierAlternative.value = { date: iso, display: formatDateDisplay(iso) }
        return
      }
    }
  })()

  const findLater = (async () => {
    for (let i = 1; i <= 14; i++) {
      const candidate = new Date(targetDate.getTime() + i * 86400000)
      const iso = dateToIso(candidate)
      if (isWorkingDay(iso) && await checkDateHasSlots(iso)) {
        laterAlternative.value = { date: iso, display: formatDateDisplay(iso) }
        return
      }
    }
  })()

  await Promise.all([findEarlier, findLater])
  isCheckingRecommended.value = false
}

function selectRecommendedDate(): void {
  const d = new Date(recommendedDate.value + 'T00:00')
  onFollowUpDateSelect(new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()))
}

function selectAlternativeDate(iso: string): void {
  recommendedUnavailable.value = false
  earlierAlternative.value = null
  laterAlternative.value = null
  const d = new Date(iso + 'T00:00')
  onFollowUpDateSelect(new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()))
}

// ── Tab navigation ─────────────────────────────────────────────────────────
const allTabs = ['triage', 'assessment', 'plan', 'billing'] as const
type PostpartumTab = (typeof allTabs)[number]

const tabLabels: Record<PostpartumTab, string> = {
  triage: 'Triage',
  assessment: 'Assessment',
  plan: 'Plan',
  billing: 'Billing',
}

const tabIcons: Record<PostpartumTab, Component> = {
  triage: Activity,
  assessment: Stethoscope,
  plan: ClipboardList,
  billing: DollarSign,
}

const currentTabIndex = computed(() => allTabs.indexOf(activeTab.value as PostpartumTab))

const prevTabLabel = computed(() => {
  const idx = currentTabIndex.value - 1
  return idx >= 0 ? tabLabels[allTabs[idx]!] : null
})

const nextTabLabel = computed(() => {
  const idx = currentTabIndex.value + 1
  return idx < allTabs.length ? tabLabels[allTabs[idx]!] : null
})

function goToTab(direction: 'prev' | 'next') {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  const tab = allTabs[idx]
  if (tab) activeTab.value = tab
}

// ── Floating mini tabs ────────────────────────────────────────────────────
const stepperRef = ref<HTMLElement | null>(null)
const formScrollRef = ref<HTMLElement | null>(null)
const showMiniTabs = ref(false)
let tabsObserver: IntersectionObserver | null = null

function setupTabsObserver() {
  setTimeout(() => {
    const stepperEl = stepperRef.value
    const scrollEl = formScrollRef.value
    if (!stepperEl || !scrollEl) return
    tabsObserver = new IntersectionObserver(
      ([entry]) => { showMiniTabs.value = !entry!.isIntersecting },
      { root: scrollEl, threshold: 0 },
    )
    tabsObserver.observe(stepperEl)
  }, 300)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  loadError.value = null
  try {
    if (route.name === RouteNames.ENCOUNTER_NEW) {
      const pid = route.params.patientId as string
      const pregnancyId = typeof route.query.pregnancyId === 'string' ? route.query.pregnancyId : undefined
      const encounter = await store.createForPatient(pid, 'default', {
        encounterType: 'postpartum',
        pregnancyId,
      })
      await router.replace({
        name: RouteNames.ENCOUNTER_DETAIL,
        params: { patientId: pid, id: encounter.id },
      })
    } else {
      const id = route.params.id as string
      await store.loadEncounter(id)
    }
    syncFromStore()
    loadDoctorSchedule().then(() => {
      if (!localPlan.next_visit_date) checkRecommendedAvailability()
    })
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      loadError.value = "You don't have permission to access this encounter."
    } else {
      loadError.value = 'Failed to load encounter. Please try again.'
    }
  }
  setupTabsObserver()
})

onUnmounted(() => {
  tabsObserver?.disconnect()
  tabsObserver = null
  store.clearCurrent()
})

// ── Finalize ──────────────────────────────────────────────────────────────
async function handleFinalizeConfirm(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    showFinalizeModal.value = false
  }
}

async function handleFinalizeAndBilling(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    activeTab.value = 'billing'
  }
}
</script>

<template>
  <div v-if="store.isLoading && !store.current" class="flex flex-1 items-center justify-center py-12">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div
    v-else-if="loadError"
    role="alert"
    class="mx-auto max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {{ loadError }}
  </div>

  <Tabs
    v-else-if="store.current"
    v-model="activeTab"
    class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <!-- Sticky header -->
    <div class="sticky top-0 z-10 border-b bg-background">
      <div class="flex flex-col gap-2 px-4 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <!-- Left: back + patient name + badges -->
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="gap-1.5" @click="router.back()">
            <ArrowLeft class="size-3.5" />
            {{ store.current.patient_name }}
          </Button>
          <Badge variant="secondary" class="shrink-0">
            <Baby class="size-3 mr-1" />
            Postpartum Visit
          </Badge>
          <Badge
            v-if="daysPostpartum !== null"
            variant="outline"
            class="shrink-0"
          >
            Day {{ daysPostpartum }}
          </Badge>
          <Badge
            v-if="store.isDraft"
            class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400 shrink-0"
            variant="outline"
          >
            Draft
          </Badge>
          <Badge
            v-else-if="store.isFinalized"
            class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400 shrink-0"
            variant="outline"
          >
            <CheckCircle2 class="size-3 mr-1" />
            Finalized
          </Badge>
        </div>

        <!-- Right: draft actions -->
        <div v-if="store.isDraft" class="flex items-center gap-2">
          <p v-if="store.isSaving" class="text-xs text-muted-foreground">
            Saving...
          </p>
          <p v-else-if="store.saveError" class="text-xs text-destructive">
            {{ store.saveError }}
          </p>
          <Button
            variant="outline"
            size="sm"
            :disabled="store.isSaving"
            @click="store.saveSection({})"
          >
            <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
            <ClipboardList v-else class="size-3.5" />
            Save
          </Button>
          <Button
            v-if="canFinalize"
            size="sm"
            :disabled="store.isSaving"
            @click="showFinalizeModal = true"
          >
            <CheckCircle2 class="size-3.5" />
            Finalize
          </Button>
        </div>
      </div>
    </div>

    <!-- Layout wrapper -->
    <div class="relative flex min-h-0 flex-1 flex-col">

      <!-- Floating mini tabs -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="-translate-y-3 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-3 opacity-0"
      >
        <div
          v-if="showMiniTabs"
          class="pointer-events-none absolute inset-x-0 top-2 z-30 flex"
        >
          <div class="pointer-events-auto mx-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-md backdrop-blur">
            <button
              v-for="tab in allTabs"
              :key="tab"
              type="button"
              class="flex h-7 items-center justify-center gap-1.5 rounded-full px-2 text-[10px] font-medium transition-all duration-200"
              :class="activeTab === tab
                ? 'bg-primary text-primary-foreground min-w-[4.5rem]'
                : 'text-muted-foreground hover:bg-muted min-w-7 max-w-7'"
              @click="activeTab = tab"
            >
              <component :is="tabIcons[tab]" class="size-3.5 shrink-0" />
              <span
                class="overflow-hidden whitespace-nowrap transition-all duration-200"
                :class="activeTab === tab ? 'max-w-[4rem] opacity-100' : 'max-w-0 opacity-0'"
              >{{ tabLabels[tab] }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Scrollable form area -->
      <div ref="formScrollRef" class="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-8">

        <!-- Hidden TabsList for reka-ui accessibility -->
        <TabsList class="sr-only">
          <TabsTrigger v-for="tab in allTabs" :key="tab" :value="tab">{{ tabLabels[tab] }}</TabsTrigger>
        </TabsList>

        <div class="mx-auto max-w-4xl">

          <!-- Circle stepper -->
          <div ref="stepperRef" class="mb-5 py-3">
            <div class="relative px-0 md:px-8">
              <!-- Connector line -->
              <div class="absolute top-5 left-5 right-5 h-0.5 bg-border">
                <div
                  class="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-500 ease-in-out"
                  :style="{ width: allTabs.length > 1 ? `${(currentTabIndex / (allTabs.length - 1)) * 100}%` : '0%' }"
                />
              </div>
              <!-- Step circles -->
              <div class="relative flex justify-between">
                <button
                  v-for="tab in allTabs"
                  :key="tab"
                  type="button"
                  class="flex flex-col items-center gap-1.5"
                  @click="activeTab = tab"
                >
                  <div
                    class="flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300"
                    :class="activeTab === tab
                      ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                      : allTabs.indexOf(tab) < currentTabIndex
                        ? 'border-primary bg-background text-primary hover:scale-105 scale-100'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground hover:scale-105 scale-100'"
                  >
                    <component :is="tabIcons[tab]" class="size-4.5" />
                  </div>
                  <span
                    class="text-xs font-medium transition-colors duration-200"
                    :class="activeTab === tab ? 'text-primary' : 'text-muted-foreground'"
                  >
                    {{ tabLabels[tab] }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Offline banner -->
          <div
            v-if="!isOnline"
            class="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
          >
            <WifiOff class="size-3.5 shrink-0" />
            You are offline. Changes will be saved locally and synced when you reconnect.
            <span v-if="pendingCount" class="ml-auto text-xs font-medium">
              {{ pendingCount }} pending
            </span>
          </div>

          <!-- Read-only banner -->
          <div
            v-if="store.isFinalized"
            class="mb-3 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
          >
            <Lock class="size-3.5 shrink-0" />
            This encounter has been finalized and is read-only.
          </div>

          <!-- ── Triage Tab ──────────────────────────────────────────── -->
          <TabsContent value="triage" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

            <!-- Days Postpartum -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Days Postpartum</h3>
              <div class="flex flex-col gap-2">
                <div class="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm sm:max-w-xs">
                  {{ daysPostpartum !== null ? `Day ${daysPostpartum}` : 'Not calculated' }}
                </div>
                <p class="text-xs text-muted-foreground">
                  Auto-computed from delivery date
                </p>
              </div>
            </div>

            <!-- Concerns -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Concerns</h3>
              <Textarea
                id="pp-concerns"
                :model-value="localTriage.concerns ?? undefined"
                placeholder="Patient's concerns and complaints..."
                :disabled="store.isFinalized"
                rows="3"
                @update:model-value="(v: string | number) => { localTriage.concerns = String(v) || null }"
                @blur="saveTriageSection"
              />
            </div>

            <!-- Vitals -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <!-- Blood Pressure -->
                <div class="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                  <Label class="text-xs text-muted-foreground">Blood Pressure (mmHg)</Label>
                  <div class="flex items-center gap-2">
                    <Input
                      :model-value="localTriage.vitals.bp_systolic ?? undefined"
                      type="number"
                      placeholder="Systolic"
                      :disabled="store.isFinalized"
                      class="h-9"
                      @update:model-value="(v: string | number) => { localTriage.vitals.bp_systolic = v !== '' && v !== null ? Number(v) : null }"
                      @blur="saveTriageSection"
                    />
                    <span class="text-sm text-muted-foreground">/</span>
                    <Input
                      :model-value="localTriage.vitals.bp_diastolic ?? undefined"
                      type="number"
                      placeholder="Diastolic"
                      :disabled="store.isFinalized"
                      class="h-9"
                      @update:model-value="(v: string | number) => { localTriage.vitals.bp_diastolic = v !== '' && v !== null ? Number(v) : null }"
                      @blur="saveTriageSection"
                    />
                  </div>
                </div>

                <!-- Weight -->
                <div class="flex flex-col gap-1.5">
                  <Label for="pp-weight" class="text-xs text-muted-foreground">Weight (kg)</Label>
                  <Input
                    id="pp-weight"
                    :model-value="localTriage.vitals.weight ?? undefined"
                    type="number"
                    placeholder="e.g. 60"
                    :disabled="store.isFinalized"
                    class="h-9"
                    @update:model-value="(v: string | number) => { localTriage.vitals.weight = v !== '' && v !== null ? Number(v) : null }"
                    @blur="saveTriageSection"
                  />
                </div>

                <!-- Heart Rate -->
                <div class="flex flex-col gap-1.5">
                  <Label for="pp-hr" class="text-xs text-muted-foreground">Heart Rate (bpm)</Label>
                  <Input
                    id="pp-hr"
                    :model-value="localTriage.vitals.heart_rate ?? undefined"
                    type="number"
                    placeholder="e.g. 72"
                    :disabled="store.isFinalized"
                    class="h-9"
                    @update:model-value="(v: string | number) => { localTriage.vitals.heart_rate = v !== '' && v !== null ? Number(v) : null }"
                    @blur="saveTriageSection"
                  />
                </div>

                <!-- Respiratory Rate -->
                <div class="flex flex-col gap-1.5">
                  <Label for="pp-rr" class="text-xs text-muted-foreground">Respiratory Rate (breaths/min)</Label>
                  <Input
                    id="pp-rr"
                    :model-value="localTriage.vitals.respiratory_rate ?? undefined"
                    type="number"
                    placeholder="e.g. 16"
                    :disabled="store.isFinalized"
                    class="h-9"
                    @update:model-value="(v: string | number) => { localTriage.vitals.respiratory_rate = v !== '' && v !== null ? Number(v) : null }"
                    @blur="saveTriageSection"
                  />
                </div>

                <!-- Temperature -->
                <div class="flex flex-col gap-1.5">
                  <Label for="pp-temp" class="text-xs text-muted-foreground">Temperature (°C)</Label>
                  <Input
                    id="pp-temp"
                    :model-value="localTriage.vitals.temperature ?? undefined"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 36.5"
                    :disabled="store.isFinalized"
                    class="h-9"
                    @update:model-value="(v: string | number) => { localTriage.vitals.temperature = v !== '' && v !== null ? Number(v) : null }"
                    @blur="saveTriageSection"
                  />
                </div>

              </div>
            </div>

            <!-- Navigation -->
            <div class="flex justify-end">
              <Button variant="outline" @click="goToTab('next')">
                {{ nextTabLabel }}
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </div>

          </TabsContent>

          <!-- ── Assessment Tab ──────────────────────────────────────── -->
          <TabsContent value="assessment" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

            <!-- General Recovery -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">General Recovery</h3>
              <Textarea
                id="pp-general-recovery"
                :model-value="localAssessment.general_recovery ?? undefined"
                placeholder="Overall recovery status and general appearance..."
                :disabled="store.isFinalized"
                rows="3"
                @update:model-value="(v: string | number) => { localAssessment.general_recovery = String(v) || null }"
                @blur="saveAssessmentSection"
              />
            </div>

            <!-- Lochia & Wound Healing -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lochia &amp; Wound Healing</h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <!-- Lochia -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Lochia</Label>
                  <Select
                    :model-value="localAssessment.lochia ?? undefined"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: string) => { localAssessment.lochia = v as PostpartumAssessment['lochia']; saveAssessmentSection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select lochia type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="heavy">Heavy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Wound Healing -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Wound Healing</Label>
                  <Select
                    :model-value="localAssessment.wound_healing ?? undefined"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: string) => { localAssessment.wound_healing = v as PostpartumAssessment['wound_healing']; saveAssessmentSection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select healing status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intact">Intact</SelectItem>
                      <SelectItem value="partial_separation">Partial Separation</SelectItem>
                      <SelectItem value="infected">Infected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <!-- Incision Notes (conditional) -->
              <div v-if="showIncisionNotes" class="flex flex-col gap-1.5">
                <Label for="pp-incision-notes" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle class="size-3.5 text-amber-500" />
                  Incision Notes
                </Label>
                <Textarea
                  id="pp-incision-notes"
                  :model-value="localAssessment.incision_notes ?? undefined"
                  placeholder="Describe wound condition, drainage, odor, or interventions..."
                  :disabled="store.isFinalized"
                  rows="3"
                  class="border-amber-300 focus-visible:ring-amber-400 dark:border-amber-700"
                  @update:model-value="(v: string | number) => { localAssessment.incision_notes = String(v) || null }"
                  @blur="saveAssessmentSection"
                />
              </div>
            </div>

            <!-- Physical Exam -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Physical Exam</h3>
              <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-1.5">
                  <Label for="pp-breast-exam" class="text-xs text-muted-foreground">Breast Exam</Label>
                  <Textarea
                    id="pp-breast-exam"
                    :model-value="localAssessment.breast_exam ?? undefined"
                    placeholder="Engorgement, nipple condition, mastitis signs..."
                    :disabled="store.isFinalized"
                    rows="2"
                    @update:model-value="(v: string | number) => { localAssessment.breast_exam = String(v) || null }"
                    @blur="saveAssessmentSection"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label for="pp-abdominal-exam" class="text-xs text-muted-foreground">Abdominal Exam</Label>
                  <Textarea
                    id="pp-abdominal-exam"
                    :model-value="localAssessment.abdominal_exam ?? undefined"
                    placeholder="Uterine involution, fundal height, tenderness..."
                    :disabled="store.isFinalized"
                    rows="2"
                    @update:model-value="(v: string | number) => { localAssessment.abdominal_exam = String(v) || null }"
                    @blur="saveAssessmentSection"
                  />
                </div>
              </div>
            </div>

            <!-- PHQ-2 Depression Screening -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">PHQ-2 Depression Screening</h3>
              <p class="text-xs text-muted-foreground">
                Over the last 2 weeks, how often have you been bothered by...
              </p>
              <div class="flex flex-col gap-4">
                <!-- Q1 -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-sm">
                    1. Little interest or pleasure in doing things
                  </Label>
                  <Select
                    :model-value="localAssessment.phq2_q1 !== null ? String(localAssessment.phq2_q1) : undefined"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: string) => { localAssessment.phq2_q1 = Number(v); saveAssessmentSection() }"
                  >
                    <SelectTrigger class="h-9 sm:max-w-xs">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — Not at all</SelectItem>
                      <SelectItem value="1">1 — Several days</SelectItem>
                      <SelectItem value="2">2 — More than half the days</SelectItem>
                      <SelectItem value="3">3 — Nearly every day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Q2 -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-sm">
                    2. Feeling down, depressed, or hopeless
                  </Label>
                  <Select
                    :model-value="localAssessment.phq2_q2 !== null ? String(localAssessment.phq2_q2) : undefined"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: string) => { localAssessment.phq2_q2 = Number(v); saveAssessmentSection() }"
                  >
                    <SelectTrigger class="h-9 sm:max-w-xs">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — Not at all</SelectItem>
                      <SelectItem value="1">1 — Several days</SelectItem>
                      <SelectItem value="2">2 — More than half the days</SelectItem>
                      <SelectItem value="3">3 — Nearly every day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Total + Risk -->
                <div v-if="phq2Total !== null" class="flex flex-wrap items-center gap-3 border-t pt-3">
                  <span class="text-sm text-muted-foreground">
                    Total score: <span class="font-semibold text-foreground">{{ phq2Total }}</span> / 6
                  </span>
                  <Badge
                    variant="outline"
                    class="capitalize"
                    :class="phq2RiskClass"
                  >
                    {{ phq2RiskLevel }} risk
                  </Badge>
                </div>

                <!-- PHQ-2 positive alert -->
                <div
                  v-if="phq2Total !== null && phq2Total >= 3"
                  class="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-2.5 text-sm text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-400"
                  role="alert"
                >
                  <AlertTriangle class="mt-0.5 size-4 shrink-0" />
                  <span>PHQ-2 positive — consider full PHQ-9 screening and referral.</span>
                </div>
              </div>
            </div>

            <!-- Navigation -->
            <div class="flex items-center justify-between">
              <Button variant="outline" @click="goToTab('prev')">
                <ChevronLeft class="mr-1 size-4" />
                {{ prevTabLabel }}
              </Button>
              <Button variant="outline" @click="goToTab('next')">
                {{ nextTabLabel }}
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </div>

          </TabsContent>

          <!-- ── Plan Tab ────────────────────────────────────────────── -->
          <TabsContent value="plan" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

            <!-- Prescription -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prescription</h3>
              <PrescriptionSection
                :consultation-id="store.current.id"
                :disabled="store.isFinalized"
                :realtime-update="prescriptionUpdate"
                :document-update="documentUpdate"
              />
            </div>

            <!-- Procedures -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Procedures</h3>
              <ProcedureSection
                :encounter-id="store.current.id"
                :procedures="store.current.procedures ?? []"
                :disabled="store.isFinalized"
                @update="(p) => { if (store.current) store.current.procedures = p }"
              />
            </div>

            <!-- Lab Orders -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lab Orders</h3>
              <LabOrderSection
                :consultation-id="store.current.id"
                :disabled="store.isFinalized || !authStore.hasPermission('lab-orders.create') || !authStore.hasFeature('lab_orders')"
                :realtime-update="labOrderUpdate"
                :document-update="documentUpdate"
                @lab-updated="store.loadEncounter(store.current!.id)"
              />
            </div>

            <!-- Contraception -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contraception</h3>
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="pp-contraception-discussed"
                    :model-value="localPlan.contraception_discussed"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: boolean | 'indeterminate') => { localPlan.contraception_discussed = v === true; if (!v) { localPlan.contraception_methods = []; } savePlanSection() }"
                  />
                  <Label for="pp-contraception-discussed" class="cursor-pointer text-sm font-normal">
                    Contraception discussed with patient
                  </Label>
                </div>
                <div v-if="localPlan.contraception_discussed" class="pl-6">
                  <Label class="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    Selected methods
                  </Label>
                  <!-- Selected badges -->
                  <div v-if="localPlan.contraception_methods.length" class="mb-2 flex flex-wrap gap-1">
                    <Badge
                      v-for="m in localPlan.contraception_methods"
                      :key="m"
                      variant="secondary"
                      class="gap-1 text-xs"
                    >
                      {{ contraceptionLabel(m) }}
                      <button v-if="!store.isFinalized" type="button" class="ml-0.5 rounded-full hover:bg-muted" @click="togglePPContraception(m); savePlanSection()">
                        <X class="size-3" />
                      </button>
                    </Badge>
                  </div>
                  <Combobox v-model="localPlan.contraception_methods" multiple :disabled="store.isFinalized" @update:model-value="savePlanSection">
                    <ComboboxAnchor as-child>
                      <div class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs">
                        <ComboboxInput
                          placeholder="Search methods..."
                          class="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        <ComboboxTrigger class="shrink-0">
                          <ChevronsUpDown class="size-4 text-muted-foreground" />
                        </ComboboxTrigger>
                      </div>
                    </ComboboxAnchor>
                    <ComboboxList class="w-(--reka-combobox-trigger-width) p-1">
                      <ComboboxViewport class="max-h-[220px]">
                        <ComboboxEmpty class="px-2 py-1.5 text-center text-sm text-muted-foreground">No match</ComboboxEmpty>
                        <ComboboxItem
                          v-for="opt in CONTRACEPTION_OPTIONS"
                          :key="opt.value"
                          :value="opt.value"
                          :disabled="isPPNoneSelected && opt.value !== 'none'"
                          class="flex items-center gap-2 px-2 py-1.5"
                        >
                          <span class="flex size-4 shrink-0 items-center justify-center">
                            <CheckIcon v-if="localPlan.contraception_methods.includes(opt.value)" class="size-4" />
                          </span>
                          {{ opt.label }}
                        </ComboboxItem>
                      </ComboboxViewport>
                    </ComboboxList>
                  </Combobox>
                </div>
              </div>
            </div>

            <!-- Infant Feeding -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Infant Feeding</h3>
              <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Feeding method</Label>
                  <Select
                    :model-value="localPlan.infant_feeding ?? undefined"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: string) => { localPlan.infant_feeding = v as PostpartumPlan['infant_feeding']; savePlanSection() }"
                  >
                    <SelectTrigger class="h-9 sm:max-w-xs">
                      <SelectValue placeholder="Select feeding method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breastfeeding">Breastfeeding</SelectItem>
                      <SelectItem value="formula">Formula</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div v-if="showBreastfeedingChallenges" class="flex flex-col gap-1.5">
                  <Label for="pp-bf-challenges" class="text-xs text-muted-foreground">Breastfeeding challenges</Label>
                  <Textarea
                    id="pp-bf-challenges"
                    :model-value="localPlan.breastfeeding_challenges ?? undefined"
                    placeholder="Latch difficulties, pain, supply concerns..."
                    :disabled="store.isFinalized"
                    rows="2"
                    @update:model-value="(v: string | number) => { localPlan.breastfeeding_challenges = String(v) || null }"
                    @blur="savePlanSection"
                  />
                </div>
              </div>
            </div>

            <!-- Clearances -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Clearances</h3>
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="pp-return-activity"
                    :model-value="localPlan.return_to_activity_cleared"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: boolean | 'indeterminate') => { localPlan.return_to_activity_cleared = v === true; savePlanSection() }"
                  />
                  <Label for="pp-return-activity" class="cursor-pointer text-sm font-normal">
                    Cleared for return to activity
                  </Label>
                </div>
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="pp-sexual-activity"
                    :model-value="localPlan.sexual_activity_cleared"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: boolean | 'indeterminate') => { localPlan.sexual_activity_cleared = v === true; savePlanSection() }"
                  />
                  <Label for="pp-sexual-activity" class="cursor-pointer text-sm font-normal">
                    Cleared for sexual activity
                  </Label>
                </div>
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="pp-additional-followup"
                    :model-value="localPlan.additional_follow_up_needed"
                    :disabled="store.isFinalized"
                    @update:model-value="(v: boolean | 'indeterminate') => { localPlan.additional_follow_up_needed = v === true; savePlanSection() }"
                  />
                  <Label for="pp-additional-followup" class="cursor-pointer text-sm font-normal">
                    Additional follow-up needed
                  </Label>
                </div>
              </div>
            </div>

            <!-- Follow-Up -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Follow-Up</h3>

              <!-- Editable: smart scheduling -->
              <template v-if="store.isDraft">
                <div class="flex flex-col gap-3">
                  <div class="flex items-center gap-3">
                    <Label class="text-xs text-muted-foreground">Next Visit Date</Label>
                    <Badge v-if="followUpBooked" variant="outline" class="border-green-300 bg-green-100 text-green-700 text-[10px]">
                      <CheckCircle2 class="size-3 mr-0.5" /> Booked
                    </Badge>
                    <Button
                      v-if="followUpSelectedDate"
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      @click="clearFollowUp"
                    >
                      <X class="size-4" />
                    </Button>
                  </div>

                  <!-- Recommendation: loading -->
                  <div v-if="!followUpSelectedDate && isCheckingRecommended" class="flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle class="size-3.5 animate-spin" />
                    Checking recommended date...
                  </div>

                  <!-- Recommendation: available -->
                  <Button
                    v-if="!followUpSelectedDate && !isCheckingRecommended && !recommendedUnavailable"
                    variant="outline"
                    size="sm"
                    class="w-fit text-xs"
                    @click="selectRecommendedDate"
                  >
                    <CalendarDays class="size-3.5" />
                    Set recommended — {{ recommendedDateDisplay }}
                  </Button>

                  <!-- Recommendation: unavailable — show alternatives -->
                  <div v-if="!followUpSelectedDate && !isCheckingRecommended && recommendedUnavailable" class="flex flex-col gap-3">
                    <div class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950">
                      <AlertTriangle class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div class="flex flex-col gap-2">
                        <p class="text-xs font-medium text-amber-800 dark:text-amber-300">
                          {{ recommendedDateDisplay }} is unavailable
                        </p>
                        <div class="flex flex-wrap items-center gap-2">
                          <Button
                            v-if="earlierAlternative"
                            variant="outline"
                            size="sm"
                            class="h-7 text-xs"
                            @click="selectAlternativeDate(earlierAlternative.date)"
                          >
                            <ChevronLeft class="size-3" />
                            {{ earlierAlternative.display }}
                          </Button>
                          <Button
                            v-if="laterAlternative"
                            variant="outline"
                            size="sm"
                            class="h-7 text-xs"
                            @click="selectAlternativeDate(laterAlternative.date)"
                          >
                            {{ laterAlternative.display }}
                            <ChevronRight class="size-3" />
                          </Button>
                          <span v-if="!earlierAlternative && !laterAlternative" class="text-xs text-amber-700 dark:text-amber-400">
                            No alternatives found within 2 weeks. Use the calendar to pick a date.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Calendar picker -->
                  <MFDatePicker
                    :model-value="followUpSelectedDate"
                    disable-past
                    @update:model-value="(v: string | null) => { if (v) { const parts = v.split('-'); onFollowUpDateSelect(new CalendarDate(Number(parts[0]), Number(parts[1]), Number(parts[2]))) } }"
                  />

                  <!-- Display selected date -->
                  <p v-if="followUpDisplay" class="text-sm font-medium">
                    {{ followUpDisplay }}
                  </p>

                  <!-- Slot picker -->
                  <div v-if="followUpSelectedDate" class="mt-1">
                    <div v-if="followUpSlotsLoading" class="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <LoaderCircle class="size-4 animate-spin" />
                      Loading available slots...
                    </div>

                    <div v-else-if="availableFollowUpSlots.length === 0" class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      No available slots on this date. Please select another day.
                    </div>

                    <div v-else class="flex flex-col gap-2">
                      <p class="text-xs text-muted-foreground">
                        {{ availableFollowUpSlots.length }} available slot{{ availableFollowUpSlots.length > 1 ? 's' : '' }} — select a time:
                      </p>
                      <div class="flex flex-wrap gap-1.5">
                        <Button
                          v-for="slot in availableFollowUpSlots"
                          :key="slot.start"
                          variant="outline"
                          size="sm"
                          class="h-8"
                          :class="{ 'border-primary bg-primary/10 text-primary': followUpSelectedSlot === slot.start }"
                          :disabled="isBookingFollowUp"
                          @click="bookFollowUpSlot(slot)"
                        >
                          <Clock class="mr-1 size-3" />
                          {{ formatSlotTime(slot.start) }}
                        </Button>
                      </div>
                      <div v-if="isBookingFollowUp" class="flex items-center gap-2 text-xs text-muted-foreground">
                        <LoaderCircle class="size-3 animate-spin" />
                        Booking appointment...
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Read-only display -->
              <p v-else-if="localPlan.next_visit_date" class="text-sm">
                {{ new Date(localPlan.next_visit_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) }}
              </p>
              <p v-else class="text-sm text-muted-foreground">No follow-up scheduled</p>

              <!-- Notes (always) -->
              <div class="flex flex-col gap-1.5">
                <Label for="pp-plan-notes" class="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  id="pp-plan-notes"
                  :model-value="localPlan.notes ?? undefined"
                  placeholder="Additional instructions, referrals, or observations..."
                  :disabled="store.isFinalized"
                  rows="3"
                  @update:model-value="(v: string | number) => { localPlan.notes = String(v) || null }"
                  @blur="savePlanSection"
                />
              </div>
            </div>

            <!-- Navigation -->
            <div class="flex items-center justify-between">
              <Button variant="outline" @click="goToTab('prev')">
                <ChevronLeft class="mr-1 size-4" />
                {{ prevTabLabel }}
              </Button>
              <div class="flex items-center gap-2">
                <Button
                  v-if="store.isDraft && canFinalize"
                  :disabled="store.isSaving"
                  @click="handleFinalizeAndBilling"
                >
                  <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
                  <CheckCircle2 v-else class="size-3.5" />
                  Finalize &amp; Billing
                  <ChevronRight class="ml-1 size-4" />
                </Button>
                <Button v-else variant="outline" @click="goToTab('next')">
                  {{ nextTabLabel }}
                  <ChevronRight class="ml-1 size-4" />
                </Button>
              </div>
            </div>

          </TabsContent>

          <!-- ── Billing Tab ─────────────────────────────────────────── -->
          <TabsContent value="billing" class="mt-0 flex flex-col gap-5 px-0 md:px-8">
            <PaymentTab
              :disabled="store.isFinalized"
              :consultation-id="store.current.id"
              :status="store.current.status"
              consultation-type="default"
              :patient-id="store.current.patient_id"
              :diagnoses="[]"
              :document-update="documentUpdate"
              :consumables="store.current.consumables ?? []"
              :procedures="store.current.procedures ?? []"
              :prescription-summary="store.current.prescription_summary"
              :lab-order-summary="store.current.lab_order_summary"
              :payment="store.current.payment"
              :can-finalize="store.isDraft && canFinalize"
              :is-saving="store.isSaving"
              @update:payment="(p) => { if (store.current) store.current.payment = p }"
              @finalize="handleFinalizeAndBilling"
            />
            <div class="mt-5 flex justify-start">
              <Button variant="outline" @click="goToTab('prev')">
                <ChevronLeft class="mr-1 size-4" />
                {{ prevTabLabel }}
              </Button>
            </div>
          </TabsContent>

        </div>
      </div>
    </div>

    <!-- Finalize Confirmation Dialog -->
    <Dialog :open="showFinalizeModal" @update:open="showFinalizeModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <CheckCircle2 class="size-5 text-green-600" />
            Finalize Postpartum Visit
          </DialogTitle>
          <DialogDescription>
            This will lock the encounter and mark it as finalized. You will not be able to edit clinical data after finalizing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" :disabled="store.isSaving" @click="showFinalizeModal = false">
            Cancel
          </Button>
          <Button :disabled="store.isSaving" @click="handleFinalizeConfirm">
            <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ store.isSaving ? 'Finalizing...' : 'Finalize' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </Tabs>
</template>
