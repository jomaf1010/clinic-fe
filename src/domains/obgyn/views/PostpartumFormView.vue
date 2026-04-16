<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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
  ClipboardList,
  DollarSign,
  Lock,
  LoaderCircle,
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
import { useOfflineSync } from '@/composables/useOfflineSync'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { useEncounterSync } from '@/domains/encounter/composables/useEncounterSync'
import { usePatientSync } from '@/domains/patient/composables/usePatientSync'
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
import PaymentTab from '@/domains/consultation/components/tabs/PaymentTab.vue'
import PrescriptionSection from '@/domains/consultation/components/PrescriptionSection.vue'
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
const { prescriptionUpdate, documentUpdate } = useEncounterSync(encounterId, clinicId)
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
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      loadError.value = "You don't have permission to access this encounter."
    } else {
      loadError.value = 'Failed to load encounter. Please try again.'
    }
  }
})

onUnmounted(() => {
  store.clearCurrent()
})

// ── Tab navigation ─────────────────────────────────────────────────────────
const allTabs = ['triage', 'assessment', 'plan', 'billing'] as const
type PostpartumTab = (typeof allTabs)[number]

const tabLabels: Record<PostpartumTab, string> = {
  triage: 'Triage',
  assessment: 'Assessment',
  plan: 'Plan',
  billing: 'Billing',
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
    size="lg"
    class="-mx-4 flex flex-1 flex-col"
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

    <!-- Tabs row -->
    <TabsList class="w-full justify-start overflow-x-auto overflow-y-hidden px-4">
      <TabsTrigger value="triage">
        <Activity class="size-4" />
        Triage
      </TabsTrigger>
      <TabsTrigger value="assessment">
        <Stethoscope class="size-4" />
        Assessment
      </TabsTrigger>
      <TabsTrigger value="plan">
        <ClipboardList class="size-4" />
        Plan
      </TabsTrigger>
      <TabsTrigger value="billing">
        <DollarSign class="size-4" />
        Billing
      </TabsTrigger>
    </TabsList>

    <!-- Offline banner -->
    <div
      v-if="!isOnline"
      class="flex items-center gap-2 border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400"
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
      class="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground"
    >
      <Lock class="size-3.5 shrink-0" />
      This encounter has been finalized and is read-only.
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-8 md:pb-8">
      <div class="mx-auto max-w-4xl">

        <!-- ── Triage ─────────────────────────────────────────────────── -->
        <TabsContent value="triage" class="mt-0">
          <div class="flex flex-col gap-6">

            <!-- Days postpartum (read-only) -->
            <div class="flex flex-col gap-2">
              <Label class="flex items-center gap-1.5">
                <Activity class="size-3.5 text-muted-foreground" />
                Days Postpartum
              </Label>
              <div class="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm sm:max-w-xs">
                {{ daysPostpartum !== null ? `Day ${daysPostpartum}` : 'Not calculated' }}
              </div>
              <p class="text-xs text-muted-foreground">
                Auto-computed from delivery date
              </p>
            </div>

            <!-- Concerns -->
            <div class="flex flex-col gap-2">
              <Label for="pp-concerns" class="flex items-center gap-1.5">
                <AlertTriangle class="size-3.5 text-muted-foreground" />
                Concerns
              </Label>
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
            <div>
              <h2 class="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Vitals
              </h2>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <!-- Blood Pressure -->
                <div class="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
                  <Label class="flex items-center gap-1.5">
                    <Activity class="size-3.5 text-muted-foreground" />
                    Blood Pressure (mmHg)
                  </Label>
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
                <div class="flex flex-col gap-2">
                  <Label for="pp-weight" class="flex items-center gap-1.5">
                    <Activity class="size-3.5 text-muted-foreground" />
                    Weight (kg)
                  </Label>
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
                <div class="flex flex-col gap-2">
                  <Label for="pp-hr" class="flex items-center gap-1.5">
                    <Activity class="size-3.5 text-muted-foreground" />
                    Heart Rate (bpm)
                  </Label>
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
                <div class="flex flex-col gap-2">
                  <Label for="pp-rr" class="flex items-center gap-1.5">
                    <Activity class="size-3.5 text-muted-foreground" />
                    Respiratory Rate (breaths/min)
                  </Label>
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
                <div class="flex flex-col gap-2">
                  <Label for="pp-temp" class="flex items-center gap-1.5">
                    <Activity class="size-3.5 text-muted-foreground" />
                    Temperature (°C)
                  </Label>
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
          </div>

          <div class="mt-8 flex justify-end border-t pt-4">
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ── Assessment ─────────────────────────────────────────────── -->
        <TabsContent value="assessment" class="mt-0">
          <div class="flex flex-col gap-6">

            <!-- General Recovery -->
            <div class="flex flex-col gap-2">
              <Label for="pp-general-recovery" class="flex items-center gap-1.5">
                <Stethoscope class="size-3.5 text-muted-foreground" />
                General Recovery
              </Label>
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

            <!-- Lochia + Wound Healing row -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <!-- Lochia -->
              <div class="flex flex-col gap-2">
                <Label class="flex items-center gap-1.5">
                  <Stethoscope class="size-3.5 text-muted-foreground" />
                  Lochia
                </Label>
                <Select
                  :model-value="localAssessment.lochia ?? undefined"
                  :disabled="store.isFinalized"
                  @update:model-value="(v: string) => { localAssessment.lochia = v as PostpartumAssessment['lochia']; saveAssessmentSection() }"
                >
                  <SelectTrigger class="h-9">
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
              <div class="flex flex-col gap-2">
                <Label class="flex items-center gap-1.5">
                  <Stethoscope class="size-3.5 text-muted-foreground" />
                  Wound Healing
                </Label>
                <Select
                  :model-value="localAssessment.wound_healing ?? undefined"
                  :disabled="store.isFinalized"
                  @update:model-value="(v: string) => { localAssessment.wound_healing = v as PostpartumAssessment['wound_healing']; saveAssessmentSection() }"
                >
                  <SelectTrigger class="h-9">
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

            <!-- Incision Notes (prominent when wound healing is not intact) -->
            <div v-if="showIncisionNotes" class="flex flex-col gap-2">
              <Label for="pp-incision-notes" class="flex items-center gap-1.5">
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

            <!-- Breast Exam -->
            <div class="flex flex-col gap-2">
              <Label for="pp-breast-exam" class="flex items-center gap-1.5">
                <Stethoscope class="size-3.5 text-muted-foreground" />
                Breast Exam
              </Label>
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

            <!-- Abdominal Exam -->
            <div class="flex flex-col gap-2">
              <Label for="pp-abdominal-exam" class="flex items-center gap-1.5">
                <Stethoscope class="size-3.5 text-muted-foreground" />
                Abdominal Exam
              </Label>
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

            <!-- PHQ-2 Depression Screening -->
            <div class="rounded-lg border bg-card p-4">
              <h3 class="mb-1 text-sm font-semibold">PHQ-2 Depression Screening</h3>
              <p class="mb-4 text-xs text-muted-foreground">
                Over the last 2 weeks, how often have you been bothered by...
              </p>

              <div class="flex flex-col gap-4">
                <!-- Q1 -->
                <div class="flex flex-col gap-2">
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
                <div class="flex flex-col gap-2">
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
          </div>

          <div class="mt-8 flex justify-between border-t pt-4">
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

        <!-- ── Plan ──────────────────────────────────────────────────── -->
        <TabsContent value="plan" class="mt-0">
          <div class="flex flex-col gap-6">

            <!-- Prescriptions -->
            <PrescriptionSection
              :consultation-id="store.current.id"
              :disabled="store.isFinalized"
              :realtime-update="prescriptionUpdate"
              :document-update="documentUpdate"
            />

            <!-- Procedures -->
            <ProcedureSection
              :encounter-id="store.current.id"
              :procedures="store.current.procedures ?? []"
              :disabled="store.isFinalized"
              @update="(p) => { if (store.current) store.current.procedures = p }"
            />

            <!-- Contraception -->
            <div class="rounded-lg border bg-card p-4">
              <h3 class="mb-3 text-sm font-semibold">Contraception</h3>
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
            <div class="rounded-lg border bg-card p-4">
              <h3 class="mb-3 text-sm font-semibold">Infant Feeding</h3>
              <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-2">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Feeding method
                  </Label>
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

                <div v-if="showBreastfeedingChallenges" class="flex flex-col gap-2">
                  <Label for="pp-bf-challenges" class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Breastfeeding challenges
                  </Label>
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
            <div class="rounded-lg border bg-card p-4">
              <h3 class="mb-3 text-sm font-semibold">Clearances</h3>
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

            <!-- Next Visit Date -->
            <div class="flex flex-col gap-2">
              <Label for="pp-next-visit" class="flex items-center gap-1.5">
                <Activity class="size-3.5 text-muted-foreground" />
                Next Visit Date
              </Label>
              <Input
                id="pp-next-visit"
                :model-value="localPlan.next_visit_date ?? undefined"
                type="date"
                :disabled="store.isFinalized"
                class="h-9 sm:max-w-xs"
                @update:model-value="(v: string | number) => { localPlan.next_visit_date = String(v) || null }"
                @blur="savePlanSection"
              />
            </div>

            <!-- Notes -->
            <div class="flex flex-col gap-2">
              <Label for="pp-plan-notes" class="flex items-center gap-1.5">
                <ClipboardList class="size-3.5 text-muted-foreground" />
                Notes
              </Label>
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

          <div class="mt-8 flex items-center justify-between border-t pt-4">
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
                Finalize & Billing
                <ChevronRight class="ml-1 size-4" />
              </Button>
              <Button v-else variant="outline" @click="goToTab('next')">
                {{ nextTabLabel }}
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <!-- ── Billing ────────────────────────────────────────────────── -->
        <TabsContent value="billing" class="mt-0">
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
          <div class="mt-8 flex justify-start border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
          </div>
        </TabsContent>

      </div>
    </div>

    <!-- Finalize Confirmation Dialog -->
    <Dialog :open="showFinalizeModal" @update:open="showFinalizeModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <CheckCircle2 class="size-5 text-green-500" />
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
