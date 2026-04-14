<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import GrowthChart from './GrowthChart.vue'
import PatientSectionWidget from '../PatientSectionWidget.vue'
import type { PatientSex } from '@/domains/patient/lib/whoGrowthStandards'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Baby,
  Brain,
  Syringe,
  TrendingUp,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  LoaderCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Weight,
  Ruler,
  FlaskConical,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import {
  pediatricsApi,
  type BirthHistoryFields,
  type FeedingHistoryFields,
  type ImmunizationVaccineGroup,
  type ImmunizationTieredResponse,
  type AdhocVaccineRecord,
  type GrowthMeasurement,
  type MilestoneScheduleResponse,
  type MilestoneCheckpoint,
} from '../.././../api/pediatricsApi'

const props = defineProps<{
  patientSex?: string
}>()

const route = useRoute()
const authStore = useAuthStore()
const patientId = computed(() => route.params.id as string)
const canEdit = computed(() => authStore.hasFeature('specialty_features'))
const sex = computed<PatientSex>(() => (props.patientSex === 'female' ? 'female' : 'male'))

// ── Section modal visibility ──────────────────────────────────────────────────
const showBirthModal = ref(false)
const showImmuneModal = ref(false)
const showGrowthModal = ref(false)
const showMilestoneModal = ref(false)

// ─────────────────────────────────────────────────────────────────────────────
// BIRTH HISTORY (Task 4)
// ─────────────────────────────────────────────────────────────────────────────

const birthLoading = ref(true)
const birthSaving = ref(false)
const birthEditing = ref(false)
const birthHistory = ref<Partial<BirthHistoryFields>>({})
const feedingHistory = ref<Partial<FeedingHistoryFields>>({})

const birthForm = reactive<Partial<BirthHistoryFields>>({})
const feedingForm = reactive<Partial<FeedingHistoryFields>>({})

async function loadBirthHistory() {
  birthLoading.value = true
  try {
    const res = await pediatricsApi.getBirthHistory(patientId.value)
    birthHistory.value = res.data.birth_history ?? {}
    feedingHistory.value = res.data.feeding_history ?? {}
  } catch {
    // silent — will show "not recorded" state
  } finally {
    birthLoading.value = false
  }
}

function startBirthEdit() {
  Object.assign(birthForm, {
    gestational_age_weeks: birthHistory.value.gestational_age_weeks ?? null,
    birth_weight_grams: birthHistory.value.birth_weight_grams ?? null,
    birth_length_cm: birthHistory.value.birth_length_cm ?? null,
    delivery_type: birthHistory.value.delivery_type ?? null,
    apgar_1min: birthHistory.value.apgar_1min ?? null,
    apgar_5min: birthHistory.value.apgar_5min ?? null,
    nicu_stay: birthHistory.value.nicu_stay ?? null,
    nicu_duration_days: birthHistory.value.nicu_duration_days ?? null,
    newborn_screening: birthHistory.value.newborn_screening ?? null,
    newborn_screening_result: birthHistory.value.newborn_screening_result ?? null,
    newborn_complications: birthHistory.value.newborn_complications ?? null,
  })
  Object.assign(feedingForm, {
    feeding_type: feedingHistory.value.feeding_type ?? null,
    breastfeeding_duration_months: feedingHistory.value.breastfeeding_duration_months ?? null,
    formula_brand: feedingHistory.value.formula_brand ?? null,
    complementary_food_started_months: feedingHistory.value.complementary_food_started_months ?? null,
    food_allergies: feedingHistory.value.food_allergies ?? null,
    notes: feedingHistory.value.notes ?? null,
  })
  birthEditing.value = true
}

function cancelBirthEdit() {
  birthEditing.value = false
}

async function saveBirthHistory() {
  birthSaving.value = true
  try {
    const res = await pediatricsApi.updateBirthHistory(patientId.value, {
      birth_history: { ...birthForm },
      feeding_history: { ...feedingForm },
    })
    birthHistory.value = res.data.birth_history ?? {}
    feedingHistory.value = res.data.feeding_history ?? {}
    birthEditing.value = false
    toast.success('Birth history saved')
  } catch {
    toast.error('Failed to save birth history')
  } finally {
    birthSaving.value = false
  }
}

function deliveryTypeLabel(val: string | null | undefined): string {
  switch (val) {
    case 'vaginal': return 'Normal Spontaneous Delivery'
    case 'cesarean': return 'Cesarean Section'
    case 'forceps': return 'Forceps-Assisted'
    case 'vacuum': return 'Vacuum-Assisted'
    default: return '—'
  }
}

function feedingTypeLabel(val: string | null | undefined): string {
  switch (val) {
    case 'breastfed': return 'Exclusive Breastfeeding'
    case 'formula': return 'Formula'
    case 'mixed': return 'Mixed'
    default: return '—'
  }
}

const hasBirthData = computed(() =>
  birthHistory.value.gestational_age_weeks != null ||
  birthHistory.value.birth_weight_grams != null ||
  birthHistory.value.delivery_type != null,
)

const birthWidgetDetail = computed(() => {
  if (!hasBirthData.value) return 'Not recorded'
  const parts: string[] = []
  if (birthHistory.value.gestational_age_weeks != null) parts.push(`GA: ${birthHistory.value.gestational_age_weeks} wks`)
  if (birthHistory.value.birth_weight_grams != null) parts.push(`${birthHistory.value.birth_weight_grams}g`)
  return parts.join(' · ')
})

// ─────────────────────────────────────────────────────────────────────────────
// IMMUNIZATIONS (Task 6)
// ─────────────────────────────────────────────────────────────────────────────

const immuneLoading = ref(true)
const immuneData = ref<ImmunizationTieredResponse | null>(null)
const openGroups = ref<Set<string>>(new Set())
const activeImmunizationTab = ref<'epi' | 'recommended' | 'other'>('epi')
const openRecurring = ref<Set<string>>(new Set())

const epiOverdueCount = computed(() => {
  if (!immuneData.value) return 0
  return immuneData.value.epi.reduce(
    (n, g) => n + g.schedule.filter((d) => d.status === 'overdue').length, 0,
  )
})

const recommendedOverdueCount = computed(() => {
  if (!immuneData.value) return 0
  return immuneData.value.recommended.reduce(
    (n, g) => n + g.schedule.filter((d) => d.status === 'overdue').length, 0,
  )
})

const recurringOverdueCount = computed(() => {
  if (!immuneData.value) return 0
  return immuneData.value.recurring.filter((r) => r.is_overdue).length
})

const overdueCount = computed(() => epiOverdueCount.value + recommendedOverdueCount.value + recurringOverdueCount.value)

async function loadImmunizations() {
  immuneLoading.value = true
  try {
    const res = await pediatricsApi.getImmunizations(patientId.value)
    immuneData.value = res.data
    // Auto-open groups with overdue doses
    const toOpen = new Set<string>()
    for (const g of res.data.epi) {
      if (g.schedule.some((d) => d.status === 'overdue')) toOpen.add(g.key)
    }
    openGroups.value = toOpen
  } catch {
    // silent
  } finally {
    immuneLoading.value = false
  }
}

function toggleGroup(key: string) {
  if (openGroups.value.has(key)) openGroups.value.delete(key)
  else openGroups.value.add(key)
}

function toggleRecurring(key: string) {
  if (openRecurring.value.has(key)) openRecurring.value.delete(key)
  else openRecurring.value.add(key)
}

// Record dose dialog (epi / recommended / recurring)
const recordDialog = ref(false)
const recordTarget = ref<{ vaccineKey: string; vaccineName: string; doseNumber: number; tier: 'epi' | 'recommended' | 'recurring' } | null>(null)
const recordForm = reactive({ date_given: '', batch_number: '', site: '' })
const recordSaving = ref(false)

function openRecordDose(vaccineKey: string, vaccineName: string, doseNumber: number, tier: 'epi' | 'recommended' | 'recurring' = 'epi') {
  recordTarget.value = { vaccineKey, vaccineName, doseNumber, tier }
  recordForm.date_given = new Date().toISOString().slice(0, 10)
  recordForm.batch_number = ''
  recordForm.site = ''
  recordDialog.value = true
}

async function saveRecordDose() {
  if (!recordTarget.value || !recordForm.date_given) return
  recordSaving.value = true
  try {
    await pediatricsApi.recordDose(patientId.value, {
      tier: recordTarget.value.tier,
      vaccine_key: recordTarget.value.vaccineKey,
      dose_number: recordTarget.value.tier === 'recurring' ? undefined : recordTarget.value.doseNumber,
      date_given: recordForm.date_given,
      batch_number: recordForm.batch_number || null,
      site: recordForm.site || null,
    })
    recordDialog.value = false
    toast.success('Dose recorded')
    await loadImmunizations()
  } catch {
    toast.error('Failed to record dose')
  } finally {
    recordSaving.value = false
  }
}

async function deleteDose(doseUuid: string) {
  try {
    await pediatricsApi.deleteDose(patientId.value, doseUuid)
    toast.success('Dose removed')
    await loadImmunizations()
  } catch {
    toast.error('Failed to remove dose')
  }
}

// Ad-hoc vaccine dialog
const showAdhocDialog = ref(false)
const adhocForm = reactive({ vaccine_name: '', date_given: '', dose_number: 1, batch_number: '', site: '', notes: '' })
const adhocSaving = ref(false)

function openAdhocDialog() {
  adhocForm.vaccine_name = ''
  adhocForm.date_given = new Date().toISOString().slice(0, 10)
  adhocForm.dose_number = 1
  adhocForm.batch_number = ''
  adhocForm.site = ''
  adhocForm.notes = ''
  showAdhocDialog.value = true
}

async function saveAdhocDose() {
  if (!adhocForm.vaccine_name.trim() || !adhocForm.date_given) return
  adhocSaving.value = true
  try {
    await pediatricsApi.recordDose(patientId.value, {
      tier: 'adhoc',
      vaccine_key: adhocForm.vaccine_name.toLowerCase().replace(/\s+/g, '_'),
      vaccine_name: adhocForm.vaccine_name.trim(),
      dose_number: adhocForm.dose_number,
      date_given: adhocForm.date_given,
      batch_number: adhocForm.batch_number || null,
      site: adhocForm.site || null,
      notes: adhocForm.notes || null,
    })
    showAdhocDialog.value = false
    toast.success('Vaccine recorded')
    await loadImmunizations()
  } catch {
    toast.error('Failed to record vaccine')
  } finally {
    adhocSaving.value = false
  }
}

// Group ad-hoc records by vaccine_name
const adhocGrouped = computed((): Record<string, AdhocVaccineRecord[]> => {
  if (!immuneData.value) return {}
  return immuneData.value.adhoc.reduce((acc, r) => {
    ;(acc[r.vaccine_name] ??= []).push(r)
    return acc
  }, {} as Record<string, AdhocVaccineRecord[]>)
})

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'given': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
    case 'overdue': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
    default: return 'bg-muted text-muted-foreground'
  }
}

// Helper: compute group list for a vaccine group tier (epi or recommended)
function immuneGroupsFor(tier: 'epi' | 'recommended'): ImmunizationVaccineGroup[] {
  return immuneData.value?.[tier] ?? []
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// GROWTH HISTORY + DOSING CALCULATOR (Task 7)
// ─────────────────────────────────────────────────────────────────────────────

const growthLoading = ref(true)
const growthMeasurements = ref<GrowthMeasurement[]>([])

const latestMeasurement = computed(() =>
  growthMeasurements.value[growthMeasurements.value.length - 1] ?? null,
)

async function loadGrowthHistory() {
  growthLoading.value = true
  try {
    const res = await pediatricsApi.getGrowthHistory(patientId.value)
    growthMeasurements.value = res.data
  } catch {
    // silent
  } finally {
    growthLoading.value = false
  }
}

function percentileLabel(p: number | null | undefined): string {
  if (p == null) return ''
  return `${Math.round(p)}th percentile`
}

function percentileColor(p: number | null | undefined): string {
  if (p == null) return 'text-muted-foreground'
  if (p < 5 || p > 95) return 'text-orange-500'
  if (p < 15 || p > 85) return 'text-yellow-500'
  return 'text-green-500'
}

const growthWidgetDetail = computed(() => {
  if (!latestMeasurement.value) return 'No measurements'
  const parts: string[] = []
  if (latestMeasurement.value.weight_kg != null) parts.push(`${latestMeasurement.value.weight_kg} kg`)
  if (latestMeasurement.value.height_cm != null) parts.push(`${latestMeasurement.value.height_cm} cm`)
  return parts.join(' · ')
})

const growthWidgetSubDetail = computed(() => {
  if (!latestMeasurement.value?.weight_percentile) return undefined
  return `${Math.round(latestMeasurement.value.weight_percentile)}th percentile (weight)`
})

// Dosing calculator
const dosingWeight = ref<number | null>(null)

interface PedDrug {
  name: string
  mgPerKg: number
  unit: string
  note: string
  maxDose: number
}

const PED_DRUGS: PedDrug[] = [
  { name: 'Paracetamol', mgPerKg: 15, unit: 'mg/dose', note: 'q4–6h PRN', maxDose: 1000 },
  { name: 'Ibuprofen', mgPerKg: 10, unit: 'mg/dose', note: 'q6–8h PRN', maxDose: 400 },
  { name: 'Amoxicillin', mgPerKg: 40, unit: 'mg/day', note: 'divided q8h', maxDose: 3000 },
  { name: 'Azithromycin', mgPerKg: 10, unit: 'mg/day', note: '× 3–5 days', maxDose: 500 },
  { name: 'Cetirizine', mgPerKg: 0.25, unit: 'mg/dose', note: 'once daily', maxDose: 10 },
  { name: 'Salbutamol neb', mgPerKg: 0.15, unit: 'mg/dose', note: 'q4–6h PRN', maxDose: 5 },
]

function calcDose(drug: PedDrug): string {
  if (!dosingWeight.value || dosingWeight.value <= 0) return '—'
  const raw = drug.mgPerKg * dosingWeight.value
  const capped = Math.min(raw, drug.maxDose)
  return `${Math.round(capped)} ${drug.unit}`
}

// ── Form value helpers (Input/Textarea expect string|number, not null) ────────
function numVal(v: number | null | undefined): string | number { return v ?? '' }
function strVal(v: string | null | undefined): string { return v ?? '' }
function parseNum(v: string | number): number | null {
  const n = Number(v)
  return v === '' || isNaN(n) ? null : n
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVELOPMENTAL MILESTONES
// ─────────────────────────────────────────────────────────────────────────────

const DOMAINS = ['gross_motor', 'fine_motor', 'language', 'social'] as const
type MilestoneDomain = (typeof DOMAINS)[number]

const DOMAIN_LABELS: Record<MilestoneDomain, string> = {
  gross_motor: 'Gross Motor',
  fine_motor: 'Fine Motor',
  language: 'Language',
  social: 'Social',
}

const milestoneLoading = ref(true)
const milestoneData = ref<MilestoneScheduleResponse | null>(null)
const openMilestoneCheckpoints = ref<Set<string>>(new Set())
const showMilestoneDialog = ref(false)
const milestoneAssessTarget = ref<MilestoneCheckpoint | null>(null)
const milestoneSaving = ref(false)
const milestoneForm = reactive({
  assessed_at: '',
  items: {} as Record<string, string>,
  notes: '',
})

const visibleMilestoneCheckpoints = computed(() => {
  if (!milestoneData.value) return []
  const age = milestoneData.value.current_age_months
  return milestoneData.value.schedule.filter((cp) => cp.age_months <= age + 3)
})

const milestoneDueCount = computed(
  () => visibleMilestoneCheckpoints.value.filter((cp) => cp.status === 'due').length,
)

const milestoneConcernCount = computed(
  () => visibleMilestoneCheckpoints.value.filter((cp) => cp.status === 'concern').length,
)

const milestoneBadgeCount = computed(() => milestoneDueCount.value + milestoneConcernCount.value)

const milestoneWidgetDetail = computed(() => {
  if (!milestoneData.value) return 'Not assessed'
  const due = visibleMilestoneCheckpoints.value.filter((cp) => cp.status === 'due' || cp.status === 'concern')
  if (due.length > 0) return due[0]!.label
  const passed = visibleMilestoneCheckpoints.value.filter((cp) => cp.status === 'passed')
  if (passed.length > 0) return passed[passed.length - 1]!.label
  return 'Not assessed'
})

const milestoneDialogItemsByDomain = computed(() => {
  if (!milestoneAssessTarget.value) return {} as Record<string, MilestoneCheckpoint['items']>
  const result: Record<string, MilestoneCheckpoint['items']> = {}
  for (const domain of DOMAINS) {
    result[domain] = milestoneAssessTarget.value.items.filter((item) => item.domain === domain)
  }
  return result
})

const milestoneDialogReferralWarnings = computed(() => {
  if (!milestoneAssessTarget.value) return [] as string[]
  const warnings: string[] = []
  for (const domain of DOMAINS) {
    const domainItems = milestoneAssessTarget.value.items.filter((i) => i.domain === domain)
    const concernCount = domainItems.filter((i) => milestoneForm.items[i.key] === 'concern').length
    if (concernCount >= 2) {
      warnings.push(
        `Consider referral to developmental pediatrics for ${DOMAIN_LABELS[domain].toLowerCase()} concerns`,
      )
    }
  }
  return warnings
})

const milestoneDialogRedFlagWarnings = computed(() => {
  if (!milestoneAssessTarget.value) return [] as string[]
  return milestoneAssessTarget.value.red_flags
    .filter((flag) => milestoneForm.items[flag.key] === 'concern')
    .map((flag) => flag.prompt)
})

async function loadMilestones() {
  milestoneLoading.value = true
  try {
    const res = await pediatricsApi.getMilestones(patientId.value)
    milestoneData.value = res.data
    const toOpen = new Set<string>()
    for (const cp of res.data.schedule) {
      if (cp.status === 'due' || cp.status === 'concern') toOpen.add(cp.checkpoint)
    }
    openMilestoneCheckpoints.value = toOpen
  } catch {
    // silent
  } finally {
    milestoneLoading.value = false
  }
}

function toggleMilestoneCheckpoint(key: string) {
  if (openMilestoneCheckpoints.value.has(key)) openMilestoneCheckpoints.value.delete(key)
  else openMilestoneCheckpoints.value.add(key)
}

function openMilestoneAssess(checkpoint: MilestoneCheckpoint) {
  milestoneAssessTarget.value = checkpoint
  milestoneForm.assessed_at = new Date().toISOString().slice(0, 10)
  milestoneForm.notes = checkpoint.notes ?? ''
  milestoneForm.items = {}
  for (const item of checkpoint.items) {
    milestoneForm.items[item.key] = item.result
  }
  showMilestoneDialog.value = true
}

async function saveMilestoneAssessment() {
  if (!milestoneAssessTarget.value || !milestoneForm.assessed_at) return
  milestoneSaving.value = true
  try {
    const items = milestoneAssessTarget.value.items.map((item) => ({
      key: item.key,
      domain: item.domain,
      result: milestoneForm.items[item.key] ?? 'not_assessed',
    }))
    await pediatricsApi.storeMilestone(patientId.value, {
      age_checkpoint: milestoneAssessTarget.value.checkpoint,
      assessed_at: milestoneForm.assessed_at,
      items,
      notes: milestoneForm.notes || null,
    })
    showMilestoneDialog.value = false
    toast.success('Assessment saved')
    await loadMilestones()
  } catch {
    toast.error('Failed to save assessment')
  } finally {
    milestoneSaving.value = false
  }
}

async function deleteMilestoneAssessment(assessmentUuid: string) {
  try {
    await pediatricsApi.deleteMilestone(patientId.value, assessmentUuid)
    toast.success('Assessment removed')
    await loadMilestones()
  } catch {
    toast.error('Failed to remove assessment')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

onMounted(() => {
  loadBirthHistory()
  loadImmunizations()
  loadGrowthHistory()
  loadMilestones()
})
</script>

<template>
  <div class="contents">
    <PatientSectionWidget
        :icon="Baby"
        icon-color="bg-pink-500/10 text-pink-500"
        title="Birth History"
        :detail="birthWidgetDetail"
        :loading="birthLoading"
        @click="showBirthModal = true"
      />
      <PatientSectionWidget
        :icon="Syringe"
        icon-color="bg-blue-500/10 text-blue-500"
        title="Immunizations"
        :detail="overdueCount > 0 ? `${overdueCount} overdue` : 'Up to date'"
        :badge-text="overdueCount > 0 ? String(overdueCount) : undefined"
        badge-variant="destructive"
        :loading="immuneLoading"
        @click="showImmuneModal = true"
      />
      <PatientSectionWidget
        :icon="TrendingUp"
        icon-color="bg-green-500/10 text-green-500"
        title="Growth Charts"
        :detail="growthWidgetDetail"
        :sub-detail="growthWidgetSubDetail"
        :loading="growthLoading"
        @click="showGrowthModal = true"
      />
      <PatientSectionWidget
        :icon="Brain"
        icon-color="bg-purple-500/10 text-purple-500"
        title="Milestones"
        :detail="milestoneWidgetDetail"
        :badge-text="milestoneBadgeCount > 0 ? String(milestoneBadgeCount) : undefined"
        :badge-variant="milestoneConcernCount > 0 ? 'destructive' : 'default'"
        :loading="milestoneLoading"
        @click="showMilestoneModal = true"
      />

    <!-- ── Birth History Modal ───────────────────────────────────────────── -->
    <Dialog v-model:open="showBirthModal">
      <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Baby class="size-5" />
            Birth &amp; Feeding History
          </DialogTitle>
        </DialogHeader>

        <div class="flex-1">
        <!-- Loading -->
        <div v-if="birthLoading" class="flex flex-col gap-2">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-4 w-1/2" />
        </div>

        <!-- View mode -->
        <template v-else-if="!birthEditing">
          <div v-if="!hasBirthData" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <Baby class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No birth history recorded</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Record gestational age, birth weight, delivery type, APGAR scores, and feeding history.</p>
          </div>
          <template v-else>
            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <div v-if="birthHistory.gestational_age_weeks != null">
                <p class="text-xs text-muted-foreground">Gestational Age</p>
                <p class="font-medium">{{ birthHistory.gestational_age_weeks }} wks</p>
              </div>
              <div v-if="birthHistory.birth_weight_grams != null">
                <p class="text-xs text-muted-foreground">Birth Weight</p>
                <p class="font-medium">{{ birthHistory.birth_weight_grams }} g</p>
              </div>
              <div v-if="birthHistory.birth_length_cm != null">
                <p class="text-xs text-muted-foreground">Birth Length</p>
                <p class="font-medium">{{ birthHistory.birth_length_cm }} cm</p>
              </div>
              <div v-if="birthHistory.delivery_type">
                <p class="text-xs text-muted-foreground">Delivery Type</p>
                <p class="font-medium">{{ deliveryTypeLabel(birthHistory.delivery_type) }}</p>
              </div>
              <div v-if="birthHistory.apgar_1min != null || birthHistory.apgar_5min != null">
                <p class="text-xs text-muted-foreground">APGAR Score</p>
                <p class="font-medium">
                  <span v-if="birthHistory.apgar_1min != null">1-min: {{ birthHistory.apgar_1min }}</span>
                  <span v-if="birthHistory.apgar_1min != null && birthHistory.apgar_5min != null"> / </span>
                  <span v-if="birthHistory.apgar_5min != null">5-min: {{ birthHistory.apgar_5min }}</span>
                </p>
              </div>
              <div v-if="birthHistory.nicu_stay != null">
                <p class="text-xs text-muted-foreground">NICU Admission</p>
                <p class="font-medium">
                  {{ birthHistory.nicu_stay ? 'Yes' : 'No' }}
                  <span v-if="birthHistory.nicu_stay && birthHistory.nicu_duration_days">
                    ({{ birthHistory.nicu_duration_days }} days)
                  </span>
                </p>
              </div>
              <div v-if="birthHistory.newborn_screening != null">
                <p class="text-xs text-muted-foreground">Newborn Screening</p>
                <p class="font-medium">
                  {{ birthHistory.newborn_screening ? 'Done' : 'Not done' }}
                  <span v-if="birthHistory.newborn_screening && birthHistory.newborn_screening_result">
                    — {{ birthHistory.newborn_screening_result }}
                  </span>
                </p>
              </div>
            </div>
            <div v-if="birthHistory.newborn_complications" class="mt-3 text-sm">
              <p class="text-xs text-muted-foreground">Complications</p>
              <p class="whitespace-pre-wrap">{{ birthHistory.newborn_complications }}</p>
            </div>
          </template>

          <!-- Feeding history view -->
          <template v-if="feedingHistory.feeding_type || feedingHistory.notes">
            <Separator class="my-3" />
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Feeding History</p>
            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <div v-if="feedingHistory.feeding_type">
                <p class="text-xs text-muted-foreground">Feeding Type</p>
                <p class="font-medium">{{ feedingTypeLabel(feedingHistory.feeding_type) }}</p>
              </div>
              <div v-if="feedingHistory.breastfeeding_duration_months != null">
                <p class="text-xs text-muted-foreground">BF Duration</p>
                <p class="font-medium">{{ feedingHistory.breastfeeding_duration_months }} months</p>
              </div>
              <div v-if="feedingHistory.formula_brand">
                <p class="text-xs text-muted-foreground">Formula Brand</p>
                <p class="font-medium">{{ feedingHistory.formula_brand }}</p>
              </div>
              <div v-if="feedingHistory.complementary_food_started_months != null">
                <p class="text-xs text-muted-foreground">Solids Introduced</p>
                <p class="font-medium">{{ feedingHistory.complementary_food_started_months }} months</p>
              </div>
              <div v-if="feedingHistory.food_allergies">
                <p class="text-xs text-muted-foreground">Food Allergies</p>
                <p class="font-medium">{{ feedingHistory.food_allergies }}</p>
              </div>
            </div>
            <div v-if="feedingHistory.notes" class="mt-3 text-sm">
              <p class="text-xs text-muted-foreground">Notes</p>
              <p class="whitespace-pre-wrap">{{ feedingHistory.notes }}</p>
            </div>
          </template>
        </template>

        <!-- Edit mode -->
        <template v-else>
          <p class="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Birth History</p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label>Gestational Age (weeks)</Label>
              <Input
                :model-value="numVal(birthForm.gestational_age_weeks)"
                type="number"
                min="20"
                max="45"
                placeholder="e.g. 38"
                @update:model-value="(v) => birthForm.gestational_age_weeks = parseNum(v)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Birth Weight (grams)</Label>
              <Input
                :model-value="numVal(birthForm.birth_weight_grams)"
                type="number"
                min="200"
                max="7000"
                placeholder="e.g. 3200"
                @update:model-value="(v) => birthForm.birth_weight_grams = parseNum(v)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Birth Length (cm)</Label>
              <Input
                :model-value="numVal(birthForm.birth_length_cm)"
                type="number"
                min="20"
                max="70"
                placeholder="e.g. 50"
                @update:model-value="(v) => birthForm.birth_length_cm = parseNum(v)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Delivery Type</Label>
              <Select :model-value="birthForm.delivery_type ?? undefined" @update:model-value="(v) => birthForm.delivery_type = (v || null) as BirthHistoryFields['delivery_type']">
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vaginal">Normal Spontaneous Delivery</SelectItem>
                  <SelectItem value="cesarean">Cesarean Section</SelectItem>
                  <SelectItem value="forceps">Forceps-Assisted</SelectItem>
                  <SelectItem value="vacuum">Vacuum-Assisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>APGAR 1-min (0–10)</Label>
              <Input
                :model-value="numVal(birthForm.apgar_1min)"
                type="number" min="0" max="10"
                @update:model-value="(v) => birthForm.apgar_1min = parseNum(v)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>APGAR 5-min (0–10)</Label>
              <Input
                :model-value="numVal(birthForm.apgar_5min)"
                type="number" min="0" max="10"
                @update:model-value="(v) => birthForm.apgar_5min = parseNum(v)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>NICU Admission</Label>
              <Select :model-value="birthForm.nicu_stay == null ? undefined : String(birthForm.nicu_stay)" @update:model-value="(v) => birthForm.nicu_stay = v ? v === 'true' : null">
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="birthForm.nicu_stay" class="flex flex-col gap-1.5">
              <Label>NICU Duration (days)</Label>
              <Input
                :model-value="numVal(birthForm.nicu_duration_days)"
                type="number" min="0"
                @update:model-value="(v) => birthForm.nicu_duration_days = parseNum(v)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Newborn Screening Done</Label>
              <Select :model-value="birthForm.newborn_screening == null ? undefined : String(birthForm.newborn_screening)" @update:model-value="(v) => birthForm.newborn_screening = v ? v === 'true' : null">
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Done</SelectItem>
                  <SelectItem value="false">Not done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="birthForm.newborn_screening" class="flex flex-col gap-1.5">
              <Label>Screening Result</Label>
              <Select :model-value="birthForm.newborn_screening_result ?? undefined" @update:model-value="(v) => birthForm.newborn_screening_result = (v || null) as BirthHistoryFields['newborn_screening_result']">
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="abnormal">Abnormal</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="mt-4 flex flex-col gap-1.5">
            <Label>Newborn Complications</Label>
            <Textarea
              :model-value="strVal(birthForm.newborn_complications)"
              rows="2"
              placeholder="Describe any complications..."
              @update:model-value="(v) => birthForm.newborn_complications = String(v) || null"
            />
          </div>

          <Separator class="my-4" />
          <p class="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Feeding History</p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label>Feeding Type</Label>
              <Select :model-value="feedingForm.feeding_type ?? undefined" @update:model-value="(v) => feedingForm.feeding_type = (v || null) as FeedingHistoryFields['feeding_type']">
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breastfed">Exclusive Breastfeeding</SelectItem>
                  <SelectItem value="formula">Formula</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="feedingForm.feeding_type !== 'formula'" class="flex flex-col gap-1.5">
              <Label>Breastfeeding Duration (months)</Label>
              <Input
                :model-value="numVal(feedingForm.breastfeeding_duration_months)"
                type="number" min="0"
                @update:model-value="(v) => feedingForm.breastfeeding_duration_months = parseNum(v)"
              />
            </div>
            <div v-if="feedingForm.feeding_type !== 'breastfed'" class="flex flex-col gap-1.5">
              <Label>Formula Brand</Label>
              <Input
                :model-value="strVal(feedingForm.formula_brand)"
                placeholder="e.g. Nan, Similac"
                @update:model-value="(v) => feedingForm.formula_brand = String(v) || null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Solids Introduced (months)</Label>
              <Input
                :model-value="numVal(feedingForm.complementary_food_started_months)"
                type="number" min="0"
                @update:model-value="(v) => feedingForm.complementary_food_started_months = parseNum(v)"
              />
            </div>
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Food Allergies</Label>
              <Input
                :model-value="strVal(feedingForm.food_allergies)"
                placeholder="e.g. eggs, peanuts"
                @update:model-value="(v) => feedingForm.food_allergies = String(v) || null"
              />
            </div>
          </div>
          <div class="mt-4 flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              :model-value="strVal(feedingForm.notes)"
              rows="2"
              placeholder="Additional feeding notes..."
              @update:model-value="(v) => feedingForm.notes = String(v) || null"
            />
          </div>

        </template>
        </div>

        <DialogFooter class="justify-end">
          <template v-if="birthEditing">
            <Button variant="ghost" @click="cancelBirthEdit">
              Cancel
            </Button>
            <Button :disabled="birthSaving" @click="saveBirthHistory">
              <LoaderCircle v-if="birthSaving" class="size-4 mr-1 animate-spin" />
              Save
            </Button>
          </template>
          <Button v-else-if="canEdit && !birthLoading" variant="secondary" @click="startBirthEdit">
            <Pencil class="size-4 mr-1" />
            Edit Birth History
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Immunizations Modal ───────────────────────────────────────────── -->
    <Dialog v-model:open="showImmuneModal">
      <DialogContent class="sm:max-w-5xl min-h-[40vh] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Syringe class="size-5" />
            Immunizations
            <span
              v-if="overdueCount > 0"
              class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white"
            >
              {{ overdueCount }}
            </span>
          </DialogTitle>
        </DialogHeader>

        <!-- Loading -->
        <div v-if="immuneLoading" class="flex flex-col gap-2">
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-5/6" />
        </div>

        <template v-else>
          <Tabs v-model="activeImmunizationTab" class="w-full">
            <TabsList class="mb-0 w-full">
              <TabsTrigger value="epi" class="flex-1 gap-1.5">
                DOH EPI
                <span v-if="epiOverdueCount > 0" class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{{ epiOverdueCount }}</span>
              </TabsTrigger>
              <TabsTrigger value="recommended" class="flex-1 gap-1.5">
                Recommended
                <span v-if="recommendedOverdueCount > 0" class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{{ recommendedOverdueCount }}</span>
              </TabsTrigger>
              <TabsTrigger value="other" class="flex-1 gap-1.5">
                Other
                <span v-if="recurringOverdueCount > 0" class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{{ recurringOverdueCount }}</span>
              </TabsTrigger>
            </TabsList>

            <!-- ── DOH EPI tab ────────────────────────────────────────────── -->
            <TabsContent value="epi" class="mt-0">
              <div class="divide-y">
                <Collapsible
                  v-for="group in immuneGroupsFor('epi')"
                  :key="group.key"
                  :open="openGroups.has(group.key)"
                  @update:open="toggleGroup(group.key)"
                >
                  <CollapsibleTrigger class="flex w-full items-center justify-between px-2 py-3 transition-colors hover:bg-muted/50">
                    <div class="flex items-center gap-2">
                      <component :is="openGroups.has(group.key) ? ChevronDown : ChevronRight" class="size-4 text-muted-foreground" />
                      <span class="text-sm font-medium">{{ group.name }}</span>
                      <span class="text-xs text-muted-foreground">({{ group.doses }} dose{{ group.doses > 1 ? 's' : '' }})</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span
                        v-if="group.schedule.some(d => d.status === 'overdue')"
                        class="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                      >
                        <AlertTriangle class="size-3" />
                        {{ group.schedule.filter(d => d.status === 'overdue').length }} overdue
                      </span>
                      <span
                        v-else-if="group.schedule.every(d => d.status === 'given')"
                        class="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                      >
                        <CheckCircle2 class="size-3" />
                        Complete
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div class="px-2 pb-3">
                      <p class="mb-2 text-xs text-muted-foreground">{{ group.description }}</p>
                      <div class="flex flex-col gap-2">
                        <div
                          v-for="dose in group.schedule"
                          :key="`epi-${group.key}-${dose.dose}`"
                          class="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                        >
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                              <span class="text-sm font-medium">Dose {{ dose.dose }}</span>
                              <span class="text-xs text-muted-foreground">({{ dose.label }})</span>
                              <Badge class="text-xs" :class="statusBadgeClass(dose.status)" variant="outline">
                                <CheckCircle2 v-if="dose.status === 'given'" class="mr-1 size-3" />
                                <AlertTriangle v-else-if="dose.status === 'overdue'" class="mr-1 size-3" />
                                <Clock v-else class="mr-1 size-3" />
                                {{ dose.status === 'given' ? 'Given' : dose.status === 'overdue' ? 'Overdue' : 'Due' }}
                              </Badge>
                            </div>
                            <div class="mt-0.5 text-xs text-muted-foreground">
                              <span v-if="dose.status === 'given' && dose.date_given">
                                Given: {{ formatDate(dose.date_given) }}
                                <span v-if="dose.batch_number"> · Batch: {{ dose.batch_number }}</span>
                                <span v-if="dose.site"> · Site: {{ dose.site }}</span>
                              </span>
                              <span v-else>Due: {{ formatDate(dose.recommended_date) }}</span>
                            </div>
                          </div>
                          <div class="flex shrink-0 gap-1">
                            <Button
                              v-if="dose.status !== 'given' && canEdit"
                              size="sm" variant="outline" class="h-7 px-2 text-xs"
                              @click="openRecordDose(group.key, group.name, dose.dose, 'epi')"
                            >
                              <Plus class="size-3.5" />
                              Record
                            </Button>
                            <Button
                              v-if="dose.status === 'given' && dose.recorded_uuid && canEdit"
                              size="sm" variant="ghost" class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              @click="deleteDose(dose.recorded_uuid!)"
                            >
                              <Trash2 class="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <div v-if="immuneGroupsFor('epi').length === 0" class="py-4 text-sm text-muted-foreground">
                  No EPI vaccines found.
                </div>
              </div>
            </TabsContent>

            <!-- ── Recommended tab ────────────────────────────────────────── -->
            <TabsContent value="recommended" class="mt-0">
              <div class="divide-y">
                <Collapsible
                  v-for="group in immuneGroupsFor('recommended')"
                  :key="group.key"
                  :open="openGroups.has(group.key)"
                  @update:open="toggleGroup(group.key)"
                >
                  <CollapsibleTrigger class="flex w-full items-center justify-between px-2 py-3 transition-colors hover:bg-muted/50">
                    <div class="flex items-center gap-2">
                      <component :is="openGroups.has(group.key) ? ChevronDown : ChevronRight" class="size-4 text-muted-foreground" />
                      <span class="text-sm font-medium">{{ group.name }}</span>
                      <span class="text-xs text-muted-foreground">({{ group.doses }} dose{{ group.doses > 1 ? 's' : '' }})</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span
                        v-if="group.schedule.some(d => d.status === 'overdue')"
                        class="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                      >
                        <AlertTriangle class="size-3" />
                        {{ group.schedule.filter(d => d.status === 'overdue').length }} overdue
                      </span>
                      <span
                        v-else-if="group.schedule.every(d => d.status === 'given')"
                        class="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                      >
                        <CheckCircle2 class="size-3" />
                        Complete
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div class="px-2 pb-3">
                      <p class="mb-2 text-xs text-muted-foreground">{{ group.description }}</p>
                      <div class="flex flex-col gap-2">
                        <div
                          v-for="dose in group.schedule"
                          :key="`rec-${group.key}-${dose.dose}`"
                          class="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                        >
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                              <span class="text-sm font-medium">Dose {{ dose.dose }}</span>
                              <span class="text-xs text-muted-foreground">({{ dose.label }})</span>
                              <Badge class="text-xs" :class="statusBadgeClass(dose.status)" variant="outline">
                                <CheckCircle2 v-if="dose.status === 'given'" class="mr-1 size-3" />
                                <AlertTriangle v-else-if="dose.status === 'overdue'" class="mr-1 size-3" />
                                <Clock v-else class="mr-1 size-3" />
                                {{ dose.status === 'given' ? 'Given' : dose.status === 'overdue' ? 'Overdue' : 'Due' }}
                              </Badge>
                            </div>
                            <div class="mt-0.5 text-xs text-muted-foreground">
                              <span v-if="dose.status === 'given' && dose.date_given">
                                Given: {{ formatDate(dose.date_given) }}
                                <span v-if="dose.batch_number"> · Batch: {{ dose.batch_number }}</span>
                                <span v-if="dose.site"> · Site: {{ dose.site }}</span>
                              </span>
                              <span v-else>Due: {{ formatDate(dose.recommended_date) }}</span>
                            </div>
                          </div>
                          <div class="flex shrink-0 gap-1">
                            <Button
                              v-if="dose.status !== 'given' && canEdit"
                              size="sm" variant="outline" class="h-7 px-2 text-xs"
                              @click="openRecordDose(group.key, group.name, dose.dose, 'recommended')"
                            >
                              <Plus class="size-3.5" />
                              Record
                            </Button>
                            <Button
                              v-if="dose.status === 'given' && dose.recorded_uuid && canEdit"
                              size="sm" variant="ghost" class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              @click="deleteDose(dose.recorded_uuid!)"
                            >
                              <Trash2 class="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <div v-if="immuneGroupsFor('recommended').length === 0" class="py-4 text-sm text-muted-foreground">
                  No recommended vaccines found.
                </div>
              </div>
            </TabsContent>

            <!-- ── Other Vaccines tab ─────────────────────────────────────── -->
            <TabsContent value="other" class="mt-0">
              <div class="flex flex-col gap-6 pt-4">

                <!-- Recurring Vaccines -->
                <div>
                  <p class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurring Vaccines</p>
                  <div v-if="immuneData?.recurring.length" class="flex flex-col gap-2">
                    <div
                      v-for="vaccine in immuneData.recurring"
                      :key="vaccine.key"
                      class="rounded-md border"
                    >
                      <!-- Row header -->
                      <div class="flex items-center gap-3 px-4 py-3">
                        <Syringe class="size-4 shrink-0 text-muted-foreground" />
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-medium">{{ vaccine.name }}</span>
                            <span class="text-xs text-muted-foreground">{{ vaccine.doses_given.length }} dose{{ vaccine.doses_given.length !== 1 ? 's' : '' }} given</span>
                          </div>
                          <div class="mt-0.5 flex items-center gap-2 text-xs">
                            <span v-if="vaccine.next_due" :class="vaccine.is_overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'">
                              <AlertTriangle v-if="vaccine.is_overdue" class="mr-0.5 inline size-3" />
                              Next due: {{ formatDate(vaccine.next_due) }}
                            </span>
                            <span v-else class="text-muted-foreground">No dose recorded yet</span>
                          </div>
                        </div>
                        <div class="flex shrink-0 gap-1">
                          <Button
                            v-if="canEdit"
                            size="sm" variant="outline" class="h-7 px-2 text-xs"
                            @click="openRecordDose(vaccine.key, vaccine.name, vaccine.doses_given.length + 1, 'recurring')"
                          >
                            <Plus class="size-3.5" />
                            Record
                          </Button>
                          <Button
                            size="sm" variant="ghost" class="h-7 w-7 p-0 text-muted-foreground"
                            @click="toggleRecurring(vaccine.key)"
                          >
                            <component :is="openRecurring.has(vaccine.key) ? ChevronDown : ChevronRight" class="size-4" />
                          </Button>
                        </div>
                      </div>

                      <!-- Expanded dose history + first-time note -->
                      <template v-if="openRecurring.has(vaccine.key)">
                        <Separator />
                        <div class="px-4 pb-3 pt-2">
                          <div
                            v-if="vaccine.first_time_note"
                            class="mb-2 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                          >
                            <AlertTriangle class="mt-0.5 size-3 shrink-0" />
                            {{ vaccine.first_time_note }}
                          </div>
                          <div v-if="vaccine.doses_given.length === 0" class="text-xs text-muted-foreground">No doses recorded yet.</div>
                          <div v-else class="flex flex-col gap-1.5">
                            <div
                              v-for="(dose, i) in vaccine.doses_given"
                              :key="dose.uuid"
                              class="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-xs"
                            >
                              <div class="min-w-0 flex-1">
                                <span class="font-medium">Dose {{ i + 1 }}</span>
                                <span class="ml-2 text-muted-foreground">{{ formatDate(dose.date_given) }}</span>
                                <span v-if="dose.batch_number" class="ml-2 text-muted-foreground">· Batch: {{ dose.batch_number }}</span>
                                <span v-if="dose.site" class="ml-2 text-muted-foreground">· {{ dose.site }}</span>
                              </div>
                              <Button
                                v-if="canEdit"
                                size="sm" variant="ghost" class="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                @click="deleteDose(dose.uuid)"
                              >
                                <Trash2 class="size-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                  <div v-else class="text-sm text-muted-foreground">No recurring vaccines configured.</div>
                </div>

                <Separator />

                <!-- Ad-hoc / Custom Vaccines -->
                <div>
                  <div class="mb-3 flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ad-hoc / Custom Vaccines</p>
                    <Button v-if="canEdit" size="sm" variant="outline" class="h-7 px-2 text-xs" @click="openAdhocDialog">
                      <Plus class="size-3.5" />
                      Add Vaccine
                    </Button>
                  </div>
                  <div v-if="immuneData?.adhoc.length" class="flex flex-col gap-3">
                    <div v-for="(records, name) in adhocGrouped" :key="name">
                      <p class="mb-1.5 text-xs font-medium">{{ name }}</p>
                      <div class="flex flex-col gap-1.5">
                        <div
                          v-for="record in records"
                          :key="record.uuid"
                          class="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-xs"
                        >
                          <div class="min-w-0 flex-1">
                            <span class="font-medium">Dose {{ record.dose_number }}</span>
                            <span class="ml-2 text-muted-foreground">{{ formatDate(record.date_given) }}</span>
                            <span v-if="record.batch_number" class="ml-2 text-muted-foreground">· Batch: {{ record.batch_number }}</span>
                            <span v-if="record.site" class="ml-2 text-muted-foreground">· {{ record.site }}</span>
                            <span v-if="record.notes" class="ml-2 italic text-muted-foreground">· {{ record.notes }}</span>
                          </div>
                          <Button
                            v-if="canEdit"
                            size="sm" variant="ghost" class="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            @click="deleteDose(record.uuid)"
                          >
                            <Trash2 class="size-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-sm text-muted-foreground">No ad-hoc vaccines recorded.</div>
                </div>

              </div>
            </TabsContent>
          </Tabs>
        </template>
      </DialogContent>
    </Dialog>

    <!-- Record Dose Dialog (EPI / Recommended / Recurring) -->
    <Dialog v-model:open="recordDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Dose</DialogTitle>
        </DialogHeader>
        <div v-if="recordTarget" class="flex flex-col gap-4 py-2">
          <p class="text-sm text-muted-foreground">
            {{ recordTarget.vaccineName }}
            <template v-if="recordTarget.tier !== 'recurring'"> — Dose {{ recordTarget.doseNumber }}</template>
          </p>
          <div class="flex flex-col gap-1.5">
            <Label>Date Given <span class="text-destructive">*</span></Label>
            <Input v-model="recordForm.date_given" type="date" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Batch Number</Label>
            <Input v-model="recordForm.batch_number" placeholder="Optional" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Injection Site</Label>
            <Input v-model="recordForm.site" placeholder="e.g. Left thigh, Right deltoid" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="recordDialog = false">Cancel</Button>
          <Button :disabled="recordSaving || !recordForm.date_given" @click="saveRecordDose">
            <LoaderCircle v-if="recordSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Ad-hoc Vaccine Dialog -->
    <Dialog v-model:open="showAdhocDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Vaccine</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label>Vaccine Name <span class="text-destructive">*</span></Label>
            <Input v-model="adhocForm.vaccine_name" placeholder="e.g. Japanese Encephalitis" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Date Given <span class="text-destructive">*</span></Label>
            <Input v-model="adhocForm.date_given" type="date" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Dose Number</Label>
            <Input v-model.number="adhocForm.dose_number" type="number" min="1" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Batch Number</Label>
            <Input v-model="adhocForm.batch_number" placeholder="Optional" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Injection Site</Label>
            <Input v-model="adhocForm.site" placeholder="e.g. Left deltoid" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea v-model="adhocForm.notes" rows="2" placeholder="e.g. Travel vaccine, given abroad..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAdhocDialog = false">Cancel</Button>
          <Button :disabled="adhocSaving || !adhocForm.vaccine_name.trim() || !adhocForm.date_given" @click="saveAdhocDose">
            <LoaderCircle v-if="adhocSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Growth Charts Modal ───────────────────────────────────────────── -->
    <Dialog v-model:open="showGrowthModal">
      <DialogContent class="sm:max-w-5xl min-h-[40vh] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <TrendingUp class="size-5" />
            Growth &amp; Percentiles
          </DialogTitle>
        </DialogHeader>

        <!-- Loading -->
        <div v-if="growthLoading" class="flex flex-col gap-2">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-4 w-1/2" />
        </div>

        <template v-else>
          <!-- Latest measurements -->
          <div v-if="latestMeasurement" class="mb-4">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Latest ({{ formatDate(latestMeasurement.date) }})
            </p>
            <div class="flex flex-wrap gap-3">
              <div v-if="latestMeasurement.weight_kg != null" class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <Weight class="size-4 text-muted-foreground" />
                <span>
                  <span class="font-medium">{{ latestMeasurement.weight_kg }} kg</span>
                  <span v-if="latestMeasurement.weight_percentile != null" class="ml-1.5 text-xs" :class="percentileColor(latestMeasurement.weight_percentile)">
                    {{ percentileLabel(latestMeasurement.weight_percentile) }}
                  </span>
                </span>
              </div>
              <div v-if="latestMeasurement.height_cm != null" class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <Ruler class="size-4 text-muted-foreground" />
                <span>
                  <span class="font-medium">{{ latestMeasurement.height_cm }} cm</span>
                  <span v-if="latestMeasurement.height_percentile != null" class="ml-1.5 text-xs" :class="percentileColor(latestMeasurement.height_percentile)">
                    {{ percentileLabel(latestMeasurement.height_percentile) }}
                  </span>
                </span>
              </div>
              <div v-if="latestMeasurement.head_circumference_cm != null" class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span class="text-xs text-muted-foreground">HC</span>
                <span>
                  <span class="font-medium">{{ latestMeasurement.head_circumference_cm }} cm</span>
                  <span v-if="latestMeasurement.hc_percentile != null" class="ml-1.5 text-xs" :class="percentileColor(latestMeasurement.hc_percentile)">
                    {{ percentileLabel(latestMeasurement.hc_percentile) }}
                  </span>
                </span>
              </div>
              <div v-if="latestMeasurement.bmi != null" class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span class="text-xs text-muted-foreground">BMI</span>
                <span class="font-medium">{{ latestMeasurement.bmi }}</span>
              </div>
            </div>
          </div>
          <div v-else class="mb-4 flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <TrendingUp class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No growth measurements recorded</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Growth data is captured from consultation vitals. Weight, height, and head circumference are plotted against WHO percentile curves.</p>
          </div>

          <!-- Growth chart -->
          <GrowthChart
            v-if="growthMeasurements.length > 0"
            :measurements="growthMeasurements"
            :sex="sex"
            class="mb-4"
          />

          <!-- Weight-based dosing calculator -->
          <Separator class="my-4" />
          <div>
            <p class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FlaskConical class="mr-1 inline size-3.5" />
              Weight-Based Dosing Calculator
            </p>
            <div class="mb-3 flex items-center gap-2">
              <Label class="shrink-0 text-sm">Weight (kg)</Label>
              <Input
                :model-value="numVal(dosingWeight)"
                type="number"
                step="0.1"
                min="0"
                max="150"
                class="w-28"
                :placeholder="latestMeasurement?.weight_kg ? String(latestMeasurement.weight_kg) : 'kg'"
                @update:model-value="(v) => dosingWeight = parseNum(v)"
              />
              <Button
                v-if="latestMeasurement?.weight_kg && !dosingWeight"
                variant="outline"
                size="sm"
                class="h-8 text-xs"
                @click="dosingWeight = latestMeasurement!.weight_kg!"
              >
                Use latest
              </Button>
            </div>
            <div class="overflow-x-auto rounded-md border">
              <table class="w-full text-xs">
                <thead class="bg-muted/50">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-muted-foreground">Drug</th>
                    <th class="px-3 py-2 text-left font-medium text-muted-foreground">Dose</th>
                    <th class="px-3 py-2 text-left font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="drug in PED_DRUGS" :key="drug.name">
                    <td class="px-3 py-2 font-medium">{{ drug.name }}</td>
                    <td class="px-3 py-2 font-medium" :class="dosingWeight ? 'text-primary' : 'text-muted-foreground'">
                      {{ calcDose(drug) }}
                    </td>
                    <td class="px-3 py-2 text-muted-foreground">{{ drug.note }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              Capped at adult maximum. For clinical decision support only — verify with current references.
            </p>
          </div>
        </template>
      </DialogContent>
    </Dialog>

    <!-- ── Milestones Modal ──────────────────────────────────────────────── -->
    <Dialog v-model:open="showMilestoneModal">
      <DialogContent class="sm:max-w-5xl min-h-[40vh] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Brain class="size-5" />
            Developmental Milestones
            <Badge v-if="milestoneData" variant="outline" class="text-xs font-normal">
              {{ milestoneData.current_age_months }} mo
            </Badge>
            <span
              v-if="milestoneDueCount > 0"
              class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1.5 text-xs font-bold text-white"
            >
              {{ milestoneDueCount }}
            </span>
          </DialogTitle>
        </DialogHeader>

        <!-- Loading -->
        <div v-if="milestoneLoading" class="flex flex-col gap-2">
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-5/6" />
        </div>

        <template v-else-if="milestoneData">
          <div class="divide-y">
            <Collapsible
              v-for="cp in visibleMilestoneCheckpoints"
              :key="cp.checkpoint"
              :open="openMilestoneCheckpoints.has(cp.checkpoint)"
              @update:open="toggleMilestoneCheckpoint(cp.checkpoint)"
            >
              <CollapsibleTrigger class="flex w-full items-center justify-between px-2 py-3 transition-colors hover:bg-muted/50">
                <div class="flex items-center gap-2">
                  <component :is="openMilestoneCheckpoints.has(cp.checkpoint) ? ChevronDown : ChevronRight" class="size-4 text-muted-foreground" />
                  <span class="text-sm font-medium">{{ cp.label }}</span>
                  <span v-if="cp.assessed_at" class="text-xs text-muted-foreground">{{ formatDate(cp.assessed_at) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="cp.status === 'passed'"
                    class="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                  >
                    <CheckCircle2 class="size-3" />
                    Passed
                  </span>
                  <span
                    v-else-if="cp.status === 'concern'"
                    class="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400"
                  >
                    <AlertTriangle class="size-3" />
                    Concern ({{ cp.concern_count }})
                  </span>
                  <span
                    v-else-if="cp.status === 'due'"
                    class="inline-flex items-center gap-1 rounded-md border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400"
                  >
                    <Clock class="size-3" />
                    Due
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    Pending
                  </span>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div class="px-2 pb-4 pt-2">
                  <!-- Red flag alerts (based on saved assessment) -->
                  <div
                    v-for="flag in cp.red_flags.filter((f) => cp.items.some((i) => i.key === f.key && i.result === 'concern'))"
                    :key="flag.key"
                    class="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                  >
                    <AlertTriangle class="mt-0.5 size-3 shrink-0" />
                    {{ flag.prompt }}
                  </div>

                  <!-- Domain groups -->
                  <div v-for="domain in DOMAINS" :key="domain">
                    <template v-if="cp.items.some((i) => i.domain === domain)">
                      <p class="mb-1.5 mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {{ DOMAIN_LABELS[domain] }}
                      </p>
                      <div class="flex flex-col gap-1.5">
                        <div
                          v-for="item in cp.items.filter((i) => i.domain === domain)"
                          :key="item.key"
                          class="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                        >
                          <span class="min-w-0 flex-1 text-sm">{{ item.label }}</span>
                          <span v-if="item.result === 'pass'" class="inline-flex shrink-0 items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 class="size-3.5" /> Pass
                          </span>
                          <span v-else-if="item.result === 'concern'" class="inline-flex shrink-0 items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                            <AlertTriangle class="size-3.5" /> Concern
                          </span>
                          <span v-else class="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            <Minus class="size-3.5" /> —
                          </span>
                        </div>
                      </div>
                    </template>
                  </div>

                  <!-- Notes -->
                  <div v-if="cp.notes" class="mt-3 text-xs text-muted-foreground">
                    <span class="font-medium">Notes:</span> {{ cp.notes }}
                  </div>

                  <!-- Actions -->
                  <div class="mt-3 flex gap-2">
                    <div class="ml-auto flex items-center gap-2">
                      <Button
                        v-if="cp.assessment_uuid && canEdit"
                        size="sm" variant="ghost" class="text-muted-foreground hover:text-destructive"
                        @click="deleteMilestoneAssessment(cp.assessment_uuid)"
                      >
                        <Trash2 class="size-4 mr-1" />
                        Remove
                      </Button>
                      <Button
                        v-if="canEdit && cp.status !== 'pending'"
                        size="sm" variant="secondary"
                        @click="openMilestoneAssess(cp)"
                      >
                        {{ cp.assessment_uuid ? 'Re-assess' : 'Assess' }}
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div v-if="visibleMilestoneCheckpoints.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
              <Brain class="size-10 text-muted-foreground/30" />
              <p class="text-sm font-medium text-muted-foreground">No milestones due yet</p>
              <p class="max-w-sm text-xs text-muted-foreground/70">Developmental milestones are assessed at age-appropriate checkpoints across gross motor, fine motor, language, and social domains.</p>
            </div>
          </div>
        </template>

        <div v-else class="text-sm text-muted-foreground">
          Unable to load milestone data.
        </div>
      </DialogContent>
    </Dialog>

    <!-- Developmental Assessment Dialog -->
    <Dialog v-model:open="showMilestoneDialog">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Developmental Assessment
            <span v-if="milestoneAssessTarget" class="font-normal text-muted-foreground"> — {{ milestoneAssessTarget.label }}</span>
          </DialogTitle>
        </DialogHeader>
        <div v-if="milestoneAssessTarget" class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2 pr-1">
          <!-- Date -->
          <div class="flex flex-col gap-1.5">
            <Label>Assessment Date <span class="text-destructive">*</span></Label>
            <Input v-model="milestoneForm.assessed_at" type="date" />
          </div>

          <!-- Referral warnings (reactive to form state) -->
          <div
            v-for="(warning, i) in milestoneDialogReferralWarnings"
            :key="i"
            class="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400"
          >
            <AlertTriangle class="mt-0.5 size-3 shrink-0" />
            {{ warning }}
          </div>

          <!-- Red flag warnings (reactive to form state) -->
          <div
            v-for="(warning, i) in milestoneDialogRedFlagWarnings"
            :key="`rf-${i}`"
            class="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          >
            <AlertTriangle class="mt-0.5 size-3 shrink-0" />
            {{ warning }}
          </div>

          <!-- Items by domain -->
          <div v-for="domain in DOMAINS" :key="domain">
            <template v-if="milestoneDialogItemsByDomain[domain]?.length">
              <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ DOMAIN_LABELS[domain] }}</p>
              <div class="flex flex-col gap-2">
                <div
                  v-for="item in milestoneDialogItemsByDomain[domain]"
                  :key="item.key"
                  class="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
                >
                  <span class="min-w-0 flex-1 text-sm">{{ item.label }}</span>
                  <div class="flex shrink-0 overflow-hidden rounded-md border text-xs">
                    <button
                      type="button"
                      class="px-2.5 py-1.5 transition-colors"
                      :class="milestoneForm.items[item.key] === 'pass'
                        ? 'bg-green-100 font-medium text-green-700 dark:bg-green-950 dark:text-green-400'
                        : 'text-muted-foreground hover:bg-muted/50'"
                      @click="milestoneForm.items[item.key] = 'pass'"
                    >Pass</button>
                    <button
                      type="button"
                      class="border-x px-2.5 py-1.5 transition-colors"
                      :class="milestoneForm.items[item.key] === 'concern'
                        ? 'bg-orange-100 font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400'
                        : 'text-muted-foreground hover:bg-muted/50'"
                      @click="milestoneForm.items[item.key] = 'concern'"
                    >Concern</button>
                    <button
                      type="button"
                      class="px-2.5 py-1.5 transition-colors"
                      :class="milestoneForm.items[item.key] === 'not_assessed'
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50'"
                      @click="milestoneForm.items[item.key] = 'not_assessed'"
                    >N/A</button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Notes -->
          <div class="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea v-model="milestoneForm.notes" rows="2" placeholder="Clinical notes, follow-up plan..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showMilestoneDialog = false">Cancel</Button>
          <Button :disabled="milestoneSaving || !milestoneForm.assessed_at" @click="saveMilestoneAssessment">
            <LoaderCircle v-if="milestoneSaving" class="mr-2 size-4 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
