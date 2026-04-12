<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Baby,
  Syringe,
  TrendingUp,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  LoaderCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Weight,
  Ruler,
  FlaskConical,
} from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import {
  pediatricsApi,
  type BirthHistoryFields,
  type FeedingHistoryFields,
  type ImmunizationVaccineGroup,
  type GrowthMeasurement,
} from '../.././../api/pediatricsApi'

const route = useRoute()
const authStore = useAuthStore()
const patientId = computed(() => route.params.id as string)
const canEdit = computed(() => authStore.hasFeature('specialty_features'))

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

// ─────────────────────────────────────────────────────────────────────────────
// IMMUNIZATIONS (Task 6)
// ─────────────────────────────────────────────────────────────────────────────

const immuneLoading = ref(true)
const immuneGroups = ref<ImmunizationVaccineGroup[]>([])
const openGroups = ref<Set<string>>(new Set())

const overdueCount = computed(() =>
  immuneGroups.value.reduce(
    (n, g) => n + g.schedule.filter((d) => d.status === 'overdue').length,
    0,
  ),
)

async function loadImmunizations() {
  immuneLoading.value = true
  try {
    const res = await pediatricsApi.getImmunizations(patientId.value)
    immuneGroups.value = res.data
    // Auto-open groups with overdue/due doses
    const toOpen = new Set<string>()
    for (const g of res.data) {
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

// Record dose dialog
const recordDialog = ref(false)
const recordTarget = ref<{ vaccineKey: string; vaccineName: string; doseNumber: number } | null>(null)
const recordForm = reactive({ date_given: '', batch_number: '', site: '' })
const recordSaving = ref(false)

function openRecordDose(vaccineKey: string, vaccineName: string, doseNumber: number) {
  recordTarget.value = { vaccineKey, vaccineName, doseNumber }
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
      vaccine_key: recordTarget.value.vaccineKey,
      dose_number: recordTarget.value.doseNumber,
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

async function deleteDose(_vaccineKey: string, doseUuid: string) {
  try {
    await pediatricsApi.deleteDose(patientId.value, doseUuid)
    toast.success('Dose removed')
    await loadImmunizations()
  } catch {
    toast.error('Failed to remove dose')
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'given': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
    case 'overdue': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
    default: return 'bg-muted text-muted-foreground'
  }
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
// Init
// ─────────────────────────────────────────────────────────────────────────────

onMounted(() => {
  loadBirthHistory()
  loadImmunizations()
  loadGrowthHistory()
})
</script>

<template>
  <div class="flex flex-col gap-4">

    <!-- ── Birth History + Feeding History ──────────────────────────────── -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center justify-between text-sm font-medium">
          <span class="flex items-center gap-2">
            <Baby class="size-4 text-muted-foreground" />
            Birth &amp; Feeding History
          </span>
          <Button
            v-if="!birthEditing && canEdit && !birthLoading"
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs"
            @click="startBirthEdit"
          >
            <Pencil class="size-3.5" />
            Edit
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <!-- Loading -->
        <div v-if="birthLoading" class="flex flex-col gap-2">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-4 w-1/2" />
        </div>

        <!-- View mode -->
        <template v-else-if="!birthEditing">
          <div v-if="!hasBirthData" class="text-sm text-muted-foreground">No birth history recorded.</div>
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

          <div class="mt-4 flex gap-2">
            <Button size="sm" :disabled="birthSaving" @click="saveBirthHistory">
              <LoaderCircle v-if="birthSaving" class="size-4 animate-spin" />
              Save
            </Button>
            <Button variant="ghost" size="sm" @click="cancelBirthEdit">
              <X class="size-4" />
              Cancel
            </Button>
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- ── Immunization Tracker ──────────────────────────────────────────── -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <Syringe class="size-4 text-muted-foreground" />
          Immunizations (DOH EPI)
          <span
            v-if="overdueCount > 0"
            class="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white"
          >
            {{ overdueCount }}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <!-- Loading -->
        <div v-if="immuneLoading" class="flex flex-col gap-2 px-6 py-4">
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-5/6" />
        </div>

        <div v-else class="divide-y">
          <Collapsible
            v-for="group in immuneGroups"
            :key="group.key"
            :open="openGroups.has(group.key)"
            @update:open="toggleGroup(group.key)"
          >
            <CollapsibleTrigger class="flex w-full items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
              <div class="flex items-center gap-2">
                <component
                  :is="openGroups.has(group.key) ? ChevronDown : ChevronRight"
                  class="size-4 text-muted-foreground"
                />
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
              <div class="px-6 pb-3">
                <p class="mb-2 text-xs text-muted-foreground">{{ group.description }}</p>
                <div class="flex flex-col gap-2">
                  <div
                    v-for="dose in group.schedule"
                    :key="`${group.key}-${dose.dose}`"
                    class="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium">Dose {{ dose.dose }}</span>
                        <span class="text-xs text-muted-foreground">({{ dose.label }})</span>
                        <Badge
                          class="text-xs"
                          :class="statusBadgeClass(dose.status)"
                          variant="outline"
                        >
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
                        <span v-else>
                          Due: {{ formatDate(dose.recommended_date) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex shrink-0 gap-1">
                      <Button
                        v-if="dose.status !== 'given' && canEdit"
                        size="sm"
                        variant="outline"
                        class="h-7 px-2 text-xs"
                        @click="openRecordDose(group.key, group.name, dose.dose)"
                      >
                        <Plus class="size-3.5" />
                        Record
                      </Button>
                      <Button
                        v-if="dose.status === 'given' && dose.recorded_uuid && canEdit"
                        size="sm"
                        variant="ghost"
                        class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        @click="deleteDose(group.key, dose.recorded_uuid)"
                      >
                        <Trash2 class="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>

    <!-- Record Dose Dialog -->
    <Dialog v-model:open="recordDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Dose</DialogTitle>
        </DialogHeader>
        <div v-if="recordTarget" class="flex flex-col gap-4 py-2">
          <p class="text-sm text-muted-foreground">
            {{ recordTarget.vaccineName }} — Dose {{ recordTarget.doseNumber }}
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

    <!-- ── Growth History + Dosing Calculator ───────────────────────────── -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <TrendingUp class="size-4 text-muted-foreground" />
          Growth &amp; Percentiles
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                  <span v-if="latestMeasurement.weight_percentile != null" class="ml-1.5 text-xs text-muted-foreground">
                    {{ percentileLabel(latestMeasurement.weight_percentile) }}
                  </span>
                </span>
              </div>
              <div v-if="latestMeasurement.height_cm != null" class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <Ruler class="size-4 text-muted-foreground" />
                <span>
                  <span class="font-medium">{{ latestMeasurement.height_cm }} cm</span>
                  <span v-if="latestMeasurement.height_percentile != null" class="ml-1.5 text-xs text-muted-foreground">
                    {{ percentileLabel(latestMeasurement.height_percentile) }}
                  </span>
                </span>
              </div>
              <div v-if="latestMeasurement.head_circumference_cm != null" class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span class="text-xs text-muted-foreground">HC</span>
                <span>
                  <span class="font-medium">{{ latestMeasurement.head_circumference_cm }} cm</span>
                  <span v-if="latestMeasurement.hc_percentile != null" class="ml-1.5 text-xs text-muted-foreground">
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
          <div v-else class="mb-4 text-sm text-muted-foreground">No growth measurements recorded yet.</div>

          <!-- Measurement history table -->
          <div v-if="growthMeasurements.length > 1" class="mb-4 overflow-x-auto">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">History</p>
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b text-left text-muted-foreground">
                  <th class="pb-1 pr-4 font-medium">Date</th>
                  <th class="pb-1 pr-4 font-medium">Age</th>
                  <th class="pb-1 pr-4 font-medium">Weight</th>
                  <th class="pb-1 pr-4 font-medium">Height</th>
                  <th class="pb-1 font-medium">HC</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(m, i) in [...growthMeasurements].reverse()"
                  :key="i"
                  class="border-b last:border-0"
                >
                  <td class="py-1.5 pr-4 text-muted-foreground">{{ formatDate(m.date) }}</td>
                  <td class="py-1.5 pr-4 text-muted-foreground">
                    {{ m.age_months != null ? `${m.age_months} mo` : '—' }}
                  </td>
                  <td class="py-1.5 pr-4">
                    <span v-if="m.weight_kg != null">
                      {{ m.weight_kg }} kg
                      <span v-if="m.weight_percentile != null" class="text-muted-foreground">({{ Math.round(m.weight_percentile) }}%ile)</span>
                    </span>
                    <span v-else class="text-muted-foreground">—</span>
                  </td>
                  <td class="py-1.5 pr-4">
                    <span v-if="m.height_cm != null">
                      {{ m.height_cm }} cm
                      <span v-if="m.height_percentile != null" class="text-muted-foreground">({{ Math.round(m.height_percentile) }}%ile)</span>
                    </span>
                    <span v-else class="text-muted-foreground">—</span>
                  </td>
                  <td class="py-1.5">
                    <span v-if="m.head_circumference_cm != null">
                      {{ m.head_circumference_cm }} cm
                    </span>
                    <span v-else class="text-muted-foreground">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

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
      </CardContent>
    </Card>

  </div>
</template>
