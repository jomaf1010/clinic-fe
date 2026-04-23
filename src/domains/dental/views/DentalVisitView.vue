<script setup lang="ts">
/**
 * Dental visit form — parallel to PrenatalFormView. Four tabs:
 *   1. Triage      — chief complaint, pain, anxiety, vitals
 *   2. Assessment  — odontogram (delta merged into profile), PSR screening,
 *                    dental findings, diagnoses
 *   3. Plan        — procedures (pulled into Encounter.procedures for billing),
 *                    education, referrals, next-visit recommendation
 *   4. Billing     — reuses PaymentTab + PrescriptionSection + LabOrderSection
 *
 * Saves via encounterStore.saveSection (same offline-queue pipeline as the
 * other encounter types). The backend routes dental sections to
 * UpdateDentalVisitAction which merges odontogram_delta into DentalProfile,
 * recomputes DMFT, and mirrors plan.procedures to Encounter.procedures.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HttpError } from '@/lib/http'
import {
  Activity, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, ClipboardList,
  DollarSign, FileText, LoaderCircle, Lock, Plus, Stethoscope, Trash2,
  type LucideIcon,
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { useEncounterSync } from '@/domains/encounter/composables/useEncounterSync'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { RouteNames } from '@/router/routeNames'
import OdontogramChart from '../components/OdontogramChart.vue'
import ToothEditDialog from '../components/ToothEditDialog.vue'
import PsrChart from '../components/PsrChart.vue'
import DmftBadge from '../components/DmftBadge.vue'
import PrescriptionSection from '@/domains/consultation/components/PrescriptionSection.vue'
import LabOrderSection from '@/domains/consultation/components/LabOrderSection.vue'
import PaymentTab from '@/domains/consultation/components/tabs/PaymentTab.vue'
import { toast } from 'vue-sonner'
import type {
  Odontogram, ToothState, ToothSurface, ToothSurfaces, PerioPSR,
  DentalProcedureLog, DentalVisitTriage, DentalVisitAssessment, DentalVisitPlan,
  TreatmentLineItem,
} from '../types/dental.types'

// ── Router / stores ─────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
const pdStore = usePatientDetailStore()

const encounterId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const { prescriptionUpdate, labOrderUpdate, documentUpdate } = useEncounterSync(encounterId, clinicId)

// ── Permissions ─────────────────────────────────────────────────────
const canEditTriage = computed(() => authStore.hasPermission('encounters.edit-triage'))
const canEditAssessment = computed(() => authStore.hasPermission('encounters.edit-assessment'))
const canEditPlan = computed(() => authStore.hasPermission('encounters.edit-treatment-plan'))
const canFinalize = computed(() => authStore.hasPermission('encounters.finalize'))

const isFinalized = computed(() => store.isFinalized)
const visit = computed(() => store.current?.dental_visit ?? null)
const profile = computed(() => pdStore.dentalProfile)
const showPrimaryTeeth = computed(() => (pdStore.patientAge ?? 99) < 12)

// ── Tabs (circle stepper) ────────────────────────────────────────────
type TabKey = 'triage' | 'assessment' | 'plan' | 'billing'
const allTabs: TabKey[] = ['triage', 'assessment', 'plan', 'billing']
const tabLabels: Record<TabKey, string> = {
  triage: 'Triage',
  assessment: 'Assessment',
  plan: 'Plan',
  billing: 'Billing',
}
const tabIcons: Record<TabKey, LucideIcon> = {
  triage: Activity,
  assessment: Stethoscope,
  plan: ClipboardList,
  billing: DollarSign,
}

// ── Local form state — flushed to store.saveSection on blur/save ─────
const activeTab = ref<TabKey>('triage')

const visibleTabs = computed<TabKey[]>(() =>
  allTabs.filter((t) => (t === 'assessment' ? canEditAssessment.value : true)),
)
const currentTabIndex = computed(() => visibleTabs.value.indexOf(activeTab.value))
const prevTabLabel = computed(() => {
  const prev = visibleTabs.value[currentTabIndex.value - 1]
  return prev ? tabLabels[prev] : null
})
const nextTabLabel = computed(() => {
  const next = visibleTabs.value[currentTabIndex.value + 1]
  return next ? tabLabels[next] : null
})
function goToTab(direction: 'prev' | 'next') {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  const t = visibleTabs.value[idx]
  if (t) activeTab.value = t
}
const loadError = ref<string | null>(null)
const showFinalizeModal = ref(false)
const isSavingLocal = ref(false)

// Triage
const chiefComplaint = ref('')
const painScore = ref<number | null>(null)
const anxiety = ref<'' | 'none' | 'mild' | 'moderate' | 'severe'>('')
const triageNotes = ref('')
const bpSystolic = ref<number | null>(null)
const bpDiastolic = ref<number | null>(null)
const hr = ref<number | null>(null)
const temp = ref<number | null>(null)
const spo2 = ref<number | null>(null)

// Assessment
const odontogramDelta = ref<Odontogram>({})
const perioPsr = ref<PerioPSR>({})
const dentalFindings = ref('')
const assessmentNotes = ref('')
const diagnosesText = ref('')

// Tooth-edit dialog
const toothDialogOpen = ref(false)
const editingFdi = ref<string | null>(null)

// Plan
const procedures = ref<DentalProcedureLog[]>([])
const nextVisitRec = ref('')
const planNotes = ref('')

// Procedure add form
const newProcName = ref('')
const newProcTeeth = ref('')
const newProcAmount = ref<number | null>(null)
const newProcNotes = ref('')

// ── Hydrate local state from server response ─────────────────────────
function hydrateFromVisit() {
  if (!visit.value) return
  const t = visit.value.triage ?? {}
  chiefComplaint.value = t.chief_complaint ?? ''
  painScore.value = t.pain_score ?? null
  anxiety.value = (t.anxiety ?? '') as typeof anxiety.value
  triageNotes.value = t.notes ?? ''
  const v = t.vitals ?? {}
  bpSystolic.value = v.bp_systolic ?? null
  bpDiastolic.value = v.bp_diastolic ?? null
  hr.value = v.hr ?? null
  temp.value = v.temp ?? null
  spo2.value = v.spo2 ?? null

  const a = visit.value.assessment ?? {}
  // Defensively coerce to object — arrays would corrupt subsequent saves
  // because spreading a list `{...[a,b]}` yields keys `0,1` instead of FDIs.
  const rawDelta = a.odontogram_delta
  odontogramDelta.value = (rawDelta && typeof rawDelta === 'object' && !Array.isArray(rawDelta)
    ? rawDelta
    : {}) as Odontogram
  perioPsr.value = (a.perio_psr ?? {}) as PerioPSR
  dentalFindings.value = a.dental_findings ?? ''
  assessmentNotes.value = a.notes ?? ''
  diagnosesText.value = (a.diagnoses ?? []).join('\n')

  const p = visit.value.plan ?? {}
  procedures.value = (p.procedures ?? []) as DentalProcedureLog[]
  nextVisitRec.value = p.next_visit_recommendation ?? ''
  planNotes.value = p.notes ?? ''
}

watch(visit, hydrateFromVisit, { immediate: true })

// Composite odontogram for the chart = profile (current state) + visit delta
const renderedOdontogram = computed<Odontogram>(() => {
  const base = (profile.value?.odontogram ?? {}) as Odontogram
  const merged: Odontogram = { ...base }
  for (const [fdi, partial] of Object.entries(odontogramDelta.value)) {
    merged[fdi] = { ...(base[fdi] ?? {}), ...partial }
  }
  return merged
})

// ── Save handlers ────────────────────────────────────────────────────
async function saveTriage() {
  if (!canEditTriage.value || isFinalized.value) return
  const payload: { triage: DentalVisitTriage } = {
    triage: {
      chief_complaint: chiefComplaint.value || null,
      pain_score: painScore.value,
      anxiety: anxiety.value || null,
      notes: triageNotes.value || null,
      vitals: {
        bp_systolic: bpSystolic.value,
        bp_diastolic: bpDiastolic.value,
        hr: hr.value,
        temp: temp.value,
        spo2: spo2.value,
      },
    },
  }
  isSavingLocal.value = true
  try {
    await store.saveSection(payload)
  } finally {
    isSavingLocal.value = false
  }
}

async function saveAssessment() {
  if (!canEditAssessment.value || isFinalized.value) return
  const diagnoses = diagnosesText.value
    .split('\n').map((s) => s.trim()).filter(Boolean)

  const payload: { assessment: DentalVisitAssessment } = {
    assessment: {
      odontogram_delta: odontogramDelta.value,
      perio_psr: perioPsr.value,
      dental_findings: dentalFindings.value || null,
      diagnoses,
      notes: assessmentNotes.value || null,
    },
  }
  isSavingLocal.value = true
  try {
    await store.saveSection(payload)
  } finally {
    isSavingLocal.value = false
  }
}

async function savePlan() {
  if (!canEditPlan.value || isFinalized.value) return
  const payload: { plan: DentalVisitPlan } = {
    plan: {
      procedures: procedures.value,
      next_visit_recommendation: nextVisitRec.value || null,
      notes: planNotes.value || null,
    },
  }
  isSavingLocal.value = true
  try {
    await store.saveSection(payload)
  } finally {
    isSavingLocal.value = false
  }
}

// ── Tooth dialog ─────────────────────────────────────────────────────
function openToothDialog(fdi: string) {
  editingFdi.value = fdi
  toothDialogOpen.value = true
}

function onToothSave(fdi: string, state: ToothState) {
  // Merge into delta — partial state, profile is preserved when fields missing.
  odontogramDelta.value = { ...odontogramDelta.value, [fdi]: { ...(odontogramDelta.value[fdi] ?? {}), ...state } }
  // Auto-save assessment after a tooth edit so DMFT recomputes server-side.
  saveAssessment()
}

// Surface toggle from the arch chart — flips a single surface flag on the
// tooth's `surfaces` sub-object. Empty surface sets are pruned so the
// payload stays clean (no `surfaces: {}`).
function onSurfaceToggle(fdi: string, surface: ToothSurface) {
  const existing = odontogramDelta.value[fdi] ?? {}
  const existingSurfaces = existing.surfaces ?? {}
  const nextSurfaces: ToothSurfaces = { ...existingSurfaces, [surface]: !existingSurfaces[surface] }
  // Drop falsy entries so the stored shape is minimal
  for (const k of Object.keys(nextSurfaces) as ToothSurface[]) {
    if (!nextSurfaces[k]) delete nextSurfaces[k]
  }
  const merged: ToothState = { ...existing }
  if (Object.keys(nextSurfaces).length > 0) merged.surfaces = nextSurfaces
  else merged.surfaces = null
  odontogramDelta.value = { ...odontogramDelta.value, [fdi]: merged }
  saveAssessment()
}

// ── Procedure helpers ────────────────────────────────────────────────
function addProcedure() {
  if (!newProcName.value.trim()) return
  const teeth = newProcTeeth.value
    .split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
  procedures.value = [
    ...procedures.value,
    {
      id: crypto.randomUUID(),
      procedure: newProcName.value.trim(),
      teeth: teeth.length > 0 ? teeth : undefined,
      billable_amount: newProcAmount.value,
      notes: newProcNotes.value || undefined,
    },
  ]
  newProcName.value = ''
  newProcTeeth.value = ''
  newProcAmount.value = null
  newProcNotes.value = ''
  savePlan()
}

function removeProcedure(idx: number) {
  procedures.value = procedures.value.filter((_, i) => i !== idx)
  savePlan()
}

// ── Treatment plan link ──────────────────────────────────────────────
const activePlans = computed<TreatmentLineItem[][]>(() =>
  pdStore.dentalTreatmentPlans.filter((p) => p.status === 'active').map((p) => p.line_items),
)
async function linkTreatmentPlan(planId: string | null) {
  if (isFinalized.value) return
  await store.saveSection({ treatment_plan_id: planId })
}

// ── Finalize ─────────────────────────────────────────────────────────
async function onFinalize() {
  await store.finalize()
  showFinalizeModal.value = false
  if (store.current?.status === 'finalized') {
    toast.success('Visit finalized')
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────
onMounted(async () => {
  loadError.value = null
  try {
    if (route.name === RouteNames.ENCOUNTER_NEW) {
      const patientId = route.params.patientId as string
      const created = await store.createForPatient(patientId, 'default', { encounterType: 'dental' })
      await router.replace({ name: RouteNames.ENCOUNTER_DETAIL, params: { patientId, id: created.id } })
    } else {
      const id = route.params.id as string
      if (!store.current || store.current.id !== id) {
        await store.loadEncounter(id)
      }
    }
    const pid = store.current?.patient_id
    if (pid) {
      await pdStore.loadPatient(pid)
      await pdStore.loadDental()
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      loadError.value = "You don't have permission to access this visit."
    } else {
      loadError.value = 'Failed to load dental visit.'
    }
  }
})

function goBack() {
  if (store.current?.patient_id) {
    router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: store.current.patient_id } })
  } else {
    router.back()
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <header class="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-3">
      <Button variant="ghost" size="icon" @click="goBack">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="flex items-center gap-2 text-base font-semibold">
          <Stethoscope class="size-4 text-primary" />
          Dental Visit
          <Badge v-if="isFinalized" variant="secondary" class="ml-1 gap-1">
            <Lock class="size-3" /> Finalized
          </Badge>
        </h1>
        <p v-if="store.current?.display_line" class="truncate text-xs text-muted-foreground">
          {{ store.current.display_line }}
        </p>
      </div>
      <DmftBadge
        v-if="profile"
        :score="profile.dmft_score"
        :decayed="profile.dmft_decayed"
        :missing="profile.dmft_missing"
        :filled="profile.dmft_filled"
        :primary-score="profile.dmft_score_primary"
      />
      <Button v-if="canFinalize && !isFinalized" :disabled="isSavingLocal" @click="showFinalizeModal = true">
        Finalize
      </Button>
    </header>

    <!-- Loading / error -->
    <div v-if="store.isLoading" class="flex flex-1 items-center justify-center">
      <LoaderCircle class="size-8 animate-spin text-muted-foreground" />
    </div>
    <div v-else-if="loadError" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle class="size-10 text-destructive" />
      <p class="text-sm text-muted-foreground">{{ loadError }}</p>
      <Button variant="outline" @click="goBack">Go back</Button>
    </div>

    <!-- Form -->
    <div v-else class="flex-1 overflow-y-auto px-4 py-3">
      <Tabs v-model="activeTab" class="flex flex-col gap-3">
        <!-- Hidden TabsList for reka-ui a11y -->
        <TabsList class="sr-only">
          <TabsTrigger v-for="tab in visibleTabs" :key="tab" :value="tab">{{ tabLabels[tab] }}</TabsTrigger>
        </TabsList>

        <!-- Circle stepper -->
        <div class="mb-2 py-3">
          <div class="relative mx-0 md:mx-8">
            <!-- Connector line -->
            <div class="absolute top-5 right-5 left-5 h-0.5 bg-border">
              <div
                class="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-500"
                :style="{ width: `${visibleTabs.length > 1 ? (currentTabIndex / (visibleTabs.length - 1)) * 100 : 0}%` }"
              />
            </div>
            <!-- Step circles -->
            <div class="relative flex justify-between">
              <button
                v-for="(tab, i) in visibleTabs"
                :key="tab"
                type="button"
                class="group flex flex-col items-center gap-1.5"
                @click="activeTab = tab"
              >
                <div
                  class="flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300"
                  :class="
                    activeTab === tab
                      ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                      : currentTabIndex > i
                        ? 'border-primary bg-background text-primary hover:scale-105 scale-100'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground hover:scale-105 scale-100'
                  "
                >
                  <component :is="tabIcons[tab]" class="size-4" />
                </div>
                <span
                  class="text-xs font-semibold uppercase tracking-wide transition-colors duration-200"
                  :class="activeTab === tab ? 'text-primary' : 'text-muted-foreground'"
                >
                  {{ tabLabels[tab] }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- ───── Triage ───── -->
        <TabsContent value="triage" class="space-y-3">
          <div class="rounded-2xl border bg-card p-4 space-y-3">
            <div>
              <Label for="cc">Chief complaint</Label>
              <Textarea id="cc" v-model="chiefComplaint" :disabled="isFinalized || !canEditTriage" rows="2" placeholder="e.g. Pain on upper right molar, 2 days" @blur="saveTriage" />
            </div>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label for="pain">Pain (0-10)</Label>
                <Input id="pain" v-model.number="painScore" type="number" min="0" max="10" :disabled="isFinalized || !canEditTriage" @blur="saveTriage" />
              </div>
              <div>
                <Label>Anxiety</Label>
                <select v-model="anxiety" :disabled="isFinalized || !canEditTriage" class="h-9 w-full rounded-md border bg-background px-2 text-sm" @change="saveTriage">
                  <option value="">—</option>
                  <option value="none">None</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>

            <div>
              <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vitals (pre-procedure)</p>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <Label class="text-xs">BP Systolic</Label>
                  <Input v-model.number="bpSystolic" type="number" min="50" max="250" :disabled="isFinalized || !canEditTriage" @blur="saveTriage" />
                </div>
                <div>
                  <Label class="text-xs">BP Diastolic</Label>
                  <Input v-model.number="bpDiastolic" type="number" min="30" max="150" :disabled="isFinalized || !canEditTriage" @blur="saveTriage" />
                </div>
                <div>
                  <Label class="text-xs">HR</Label>
                  <Input v-model.number="hr" type="number" min="20" max="300" :disabled="isFinalized || !canEditTriage" @blur="saveTriage" />
                </div>
                <div>
                  <Label class="text-xs">Temp °C</Label>
                  <Input v-model.number="temp" type="number" step="0.1" min="30" max="45" :disabled="isFinalized || !canEditTriage" @blur="saveTriage" />
                </div>
                <div>
                  <Label class="text-xs">SpO₂ %</Label>
                  <Input v-model.number="spo2" type="number" min="50" max="100" :disabled="isFinalized || !canEditTriage" @blur="saveTriage" />
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea v-model="triageNotes" :disabled="isFinalized || !canEditTriage" rows="2" @blur="saveTriage" />
            </div>
          </div>

          <div class="flex justify-end">
            <Button v-if="nextTabLabel" variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }} <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ───── Assessment ───── -->
        <TabsContent value="assessment" class="space-y-3">
          <OdontogramChart
            :model-value="renderedOdontogram"
            :show-primary="showPrimaryTeeth"
            :selected="editingFdi"
            :readonly="isFinalized || !canEditAssessment"
            @surface-toggle="onSurfaceToggle"
            @edit-details="openToothDialog"
          />

          <PsrChart v-model="perioPsr" @update:model-value="saveAssessment" />

          <div class="rounded-2xl border bg-card p-4 space-y-3">
            <div>
              <Label>Dental findings</Label>
              <Textarea v-model="dentalFindings" :disabled="isFinalized || !canEditAssessment" rows="3" placeholder="Soft tissue, occlusion, oral cancer screen, TMJ..." @blur="saveAssessment" />
            </div>
            <div>
              <Label>Diagnoses (one per line)</Label>
              <Textarea v-model="diagnosesText" :disabled="isFinalized || !canEditAssessment" rows="3" placeholder="e.g. Irreversible pulpitis, tooth #16&#10;Chronic generalized periodontitis" @blur="saveAssessment" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea v-model="assessmentNotes" :disabled="isFinalized || !canEditAssessment" rows="2" @blur="saveAssessment" />
            </div>
          </div>

          <div class="flex justify-between">
            <Button v-if="prevTabLabel" variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" /> {{ prevTabLabel }}
            </Button>
            <span v-else />
            <Button v-if="nextTabLabel" variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }} <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ───── Plan ───── -->
        <TabsContent value="plan" class="space-y-3">
          <!-- Treatment plan link -->
          <div v-if="pdStore.dentalTreatmentPlans.length > 0" class="rounded-2xl border bg-card p-3">
            <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Linked Treatment Plan</p>
            <select
              :value="visit?.treatment_plan_id ?? ''"
              :disabled="isFinalized"
              class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              @change="(e) => linkTreatmentPlan(((e.target as HTMLSelectElement).value || null))"
            >
              <option value="">— Standalone visit —</option>
              <option v-for="p in pdStore.dentalTreatmentPlans" :key="p.id" :value="p.id">
                {{ p.chief_complaint || 'Plan' }} ({{ p.status }})
              </option>
            </select>
          </div>

          <!-- Procedures table -->
          <div class="rounded-2xl border bg-card p-4 space-y-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Procedures performed this visit</p>
            <p v-if="procedures.length === 0" class="text-xs text-muted-foreground">No procedures yet.</p>
            <ul v-else class="divide-y">
              <li v-for="(proc, i) in procedures" :key="proc.id ?? i" class="flex items-start gap-2 py-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{{ proc.procedure }}</p>
                  <p v-if="proc.teeth?.length" class="text-xs text-muted-foreground">Teeth: {{ proc.teeth.join(', ') }}</p>
                  <p v-if="proc.notes" class="text-xs text-muted-foreground">{{ proc.notes }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-semibold tabular-nums">₱{{ (proc.billable_amount ?? 0).toFixed(2) }}</p>
                </div>
                <Button v-if="!isFinalized" variant="ghost" size="icon" :aria-label="`Remove ${proc.procedure}`" @click="removeProcedure(i)">
                  <Trash2 class="size-4" />
                </Button>
              </li>
            </ul>

            <!-- Add procedure row -->
            <div v-if="!isFinalized && canEditPlan" class="grid grid-cols-1 gap-2 rounded-lg border-dashed border bg-muted/30 p-3 sm:grid-cols-12">
              <div class="sm:col-span-4">
                <Label class="text-xs">Procedure</Label>
                <Input v-model="newProcName" placeholder="e.g. Filling Class II" />
              </div>
              <div class="sm:col-span-3">
                <Label class="text-xs">Teeth (FDI)</Label>
                <Input v-model="newProcTeeth" placeholder="16, 26" />
              </div>
              <div class="sm:col-span-2">
                <Label class="text-xs">Amount ₱</Label>
                <Input v-model.number="newProcAmount" type="number" step="0.01" min="0" />
              </div>
              <div class="sm:col-span-2">
                <Label class="text-xs">Notes</Label>
                <Input v-model="newProcNotes" />
              </div>
              <div class="flex items-end sm:col-span-1">
                <Button class="w-full" :disabled="!newProcName.trim()" @click="addProcedure"><Plus class="size-4" /></Button>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border bg-card p-4 space-y-3">
            <div>
              <Label>Next-visit recommendation</Label>
              <Input v-model="nextVisitRec" :disabled="isFinalized || !canEditPlan" placeholder="e.g. Return in 1 week for RCT continuation" @blur="savePlan" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea v-model="planNotes" :disabled="isFinalized || !canEditPlan" rows="2" @blur="savePlan" />
            </div>
          </div>

          <!-- Optional add-ons reusing existing sections -->
          <PrescriptionSection
            v-if="encounterId"
            :encounter-id="encounterId"
            :disabled="isFinalized || !canEditPlan"
            :realtime-update="prescriptionUpdate"
            :document-update="documentUpdate"
          />
          <LabOrderSection
            v-if="encounterId"
            :encounter-id="encounterId"
            :disabled="isFinalized || !canEditPlan"
            :realtime-update="labOrderUpdate"
          />

          <div class="flex justify-between">
            <Button v-if="prevTabLabel" variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" /> {{ prevTabLabel }}
            </Button>
            <span v-else />
            <Button v-if="nextTabLabel" variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }} <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ───── Billing ───── -->
        <TabsContent value="billing" class="space-y-3">
          <PaymentTab v-if="store.current" />
          <div class="flex justify-between">
            <Button v-if="prevTabLabel" variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" /> {{ prevTabLabel }}
            </Button>
            <span v-else />
            <Button v-if="canFinalize && !isFinalized" @click="showFinalizeModal = true">Finalize visit</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>

    <ToothEditDialog
      v-model:open="toothDialogOpen"
      :fdi="editingFdi"
      :initial="editingFdi ? renderedOdontogram[editingFdi] ?? null : null"
      @save="onToothSave"
    />

    <Dialog v-model:open="showFinalizeModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalize this visit?</DialogTitle>
          <DialogDescription>Once finalized, the visit becomes read-only and the invoice is locked. You can still record payments.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showFinalizeModal = false">Cancel</Button>
          <Button @click="onFinalize">Finalize</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
