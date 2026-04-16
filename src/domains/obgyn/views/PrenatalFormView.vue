<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HttpError } from '@/lib/http'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ChevronsUpDown,
  DollarSign,
  FlaskConical,
  LoaderCircle,
  Lock,
  Search,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOfflineSync } from '@/composables/useOfflineSync'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { useEncounterSync } from '@/domains/encounter/composables/useEncounterSync'
import { consultationApi } from '@/domains/consultation/api/consultationApi'
import type { DiagnosisSearchResult } from '@/domains/consultation/api/consultationApi'
import type {
  PrenatalTriage,
  PrenatalAssessment,
  PrenatalPlan,
  UpdateEncounterPayload,
} from '@/domains/encounter/types/encounter.types'
import type { AssessmentDiagnosis } from '@/domains/consultation/types/consultation.types'
import PrescriptionSection from '@/domains/consultation/components/PrescriptionSection.vue'
import LabOrderSection from '@/domains/consultation/components/LabOrderSection.vue'
import ProcedureSection from '@/domains/service/components/ProcedureSection.vue'
import ConsumableSection from '@/domains/consultation/components/ConsumableSection.vue'
import PaymentTab from '@/domains/consultation/components/tabs/PaymentTab.vue'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import DangerSignsChecklist from '../components/DangerSignsChecklist.vue'
import PrenatalCareChecklist from '../components/PrenatalCareChecklist.vue'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { toast } from 'vue-sonner'
import { CalendarDate, today, getLocalTimeZone, getDayOfWeek } from '@internationalized/date'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import type { DaySchedule, Slot } from '@/domains/schedule/types/schedule.types'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])
import type { DueReminders, Pregnancy as PregnancyType } from '../types/obgyn.types'
import { useClinicalSummary } from '../composables/useClinicalSummary'

// ── Router / stores ─────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
const pdStore = usePatientDetailStore()
const { isOnline, pendingCount } = useOfflineSync()

const encounterId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const { prescriptionUpdate, labOrderUpdate, documentUpdate } = useEncounterSync(encounterId, clinicId)

// ── Permissions ─────────────────────────────────────────────────────
const canEditTriage = computed(() => authStore.hasPermission('encounters.edit-triage'))
const canEditAssessment = computed(() => authStore.hasPermission('encounters.edit-assessment'))
const canEditPlan = computed(() => authStore.hasPermission('encounters.edit-treatment-plan'))
const canFinalize = computed(() => authStore.hasPermission('encounters.finalize'))

// ── UI state ─────────────────────────────────────────────────────────
const activeTab = ref('triage')
const loadError = ref<string | null>(null)
const showFinalizeModal = ref(false)

// ── Floating mini tabs ──────────────────────────────────────────────
const tabsListRef = ref<HTMLElement | null>(null)
const formScrollRef = ref<HTMLElement | null>(null)
const showMiniTabs = ref(false)
let tabsObserver: IntersectionObserver | null = null

function setupTabsObserver() {
  nextTick(() => {
    const tabsEl = tabsListRef.value
    const scrollEl = formScrollRef.value
    if (!tabsEl || !scrollEl) return

    tabsObserver = new IntersectionObserver(
      ([entry]) => { showMiniTabs.value = !entry!.isIntersecting },
      { root: scrollEl, threshold: 0 },
    )
    tabsObserver.observe(tabsEl)
  })
}

// ── Pregnancy summary (sidebar) ─────────────────────────────────────
const pregnancyEdd = computed(() => pdStore.currentPregnancy?.edd ?? null)
const pregnancyRiskLevel = computed(() => pdStore.currentPregnancy?.risk_level ?? null)
const pregnancyLmp = computed(() => pdStore.currentPregnancy?.lmp ?? null)
const patientData = computed(() => pdStore.patient)
const gynProfile = computed(() => pdStore.gynProfile)

// Previous visit comparison + trend data — derived from store dashboard
const bpTrend = computed(() => pdStore.pregnancyDashboard?.bp_trend ?? [])
const fhrTrend = computed(() => pdStore.pregnancyDashboard?.fhr_trend ?? [])
const previousVisitData = computed(() => {
  const visits = pdStore.pregnancyDashboard?.visit_summary
  if (!visits || visits.length < 2) return null
  const prev = visits[visits.length - 2]
  if (!prev) return null
  return {
    date: new Date(prev.visit_date ?? prev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ga: prev.gestational_age_weeks != null ? `${prev.gestational_age_weeks}w${prev.gestational_age_days ?? 0}d` : '—',
    bp: prev.bp_systolic && prev.bp_diastolic ? `${prev.bp_systolic}/${prev.bp_diastolic}` : null,
    weight: prev.weight != null ? `${prev.weight} kg` : null,
    fhr: prev.fetal_heart_rate != null ? `${prev.fetal_heart_rate} bpm` : null,
    fh: prev.fundal_height != null ? `${prev.fundal_height} cm` : null,
  }
})

function formatEdd(): string {
  if (!pregnancyEdd.value) return '—'
  return new Date(pregnancyEdd.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const gpal = computed(() => {
  const gp = gynProfile.value
  if (!gp) return null
  const g = gp.gravidity ?? '?'
  const t = gp.parity_term ?? '?'
  const pt = gp.parity_preterm ?? '?'
  const a = gp.abortions ?? '?'
  const l = gp.living_children ?? '?'
  return `G${g}P(${t}-${pt}-${a}-${l})`
})

const activePregnancyRef = computed<PregnancyType | null>(() => {
  if (!pregnancyEdd.value) return null
  return {
    edd: pregnancyEdd.value,
    risk_level: pregnancyRiskLevel.value as 'low' | 'high' | null,
    current_ga: gaWeeks.value !== null ? { weeks: gaWeeks.value, days: gaDays.value ?? 0, trimester: trimester.value ?? '' } : null,
  } as PregnancyType
})

const { clinicalSummary } = useClinicalSummary(gynProfile, activePregnancyRef, gpal)

const patientAge = computed(() => pdStore.patientAge)

// ── Plan tab reminders ──────────────────────────────────────────────
const dueReminders = ref<DueReminders | null>(null)

async function loadReminders() {
  const enc = store.current
  if (!enc?.pregnancy_id) return
  try {
    dueReminders.value = await pdStore.getReminders(enc.pregnancy_id)
  } catch {
    // non-critical
  }
}

// ── GA helpers ───────────────────────────────────────────────────────
const gaWeeks = computed(() => store.current?.prenatal_visit?.gestational_age_weeks ?? null)
const gaDays = computed(() => store.current?.prenatal_visit?.gestational_age_days ?? null)
const trimester = computed(() => store.current?.prenatal_visit?.trimester ?? null)
const visitNumber = computed(() => store.current?.prenatal_visit?.visit_number ?? null)

const gaLabel = computed(() => {
  const w = gaWeeks.value
  const d = gaDays.value
  if (w === null) return null
  return d ? `${w}w${d}d` : `${w}w`
})

const trimesterLabel = computed(() => {
  switch (trimester.value) {
    case '1': return 'Trimester 1'
    case '2': return 'Trimester 2'
    case '3': return 'Trimester 3'
    default: return trimester.value ?? null
  }
})

const trimesterBadgeClass = computed(() => {
  switch (trimester.value) {
    case '1': return 'border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-400'
    case '2': return 'border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-400'
    case '3': return 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400'
    default: return ''
  }
})


// ── Local triage state ───────────────────────────────────────────────
interface LocalTriage {
  concerns: string
  fetal_movement: 'present' | 'decreased' | 'not_yet_felt' | ''
  danger_signs: string[]
  danger_signs_reviewed: boolean
  mood_screening: string
  vitals: {
    bp_systolic: string
    bp_diastolic: string
    heart_rate: string
    respiratory_rate: string
    temperature: string
    weight: string
    spo2: string
    urine_protein: string
    urine_sugar: string
  }
}

function emptyTriage(): LocalTriage {
  return {
    concerns: '',
    fetal_movement: '',
    danger_signs: [],
    danger_signs_reviewed: false,
    mood_screening: '',
    vitals: {
      bp_systolic: '',
      bp_diastolic: '',
      heart_rate: '',
      respiratory_rate: '',
      temperature: '',
      weight: '',
      spo2: '',
      urine_protein: '',
      urine_sugar: '',
    },
  }
}

const localTriage = reactive<LocalTriage>(emptyTriage())

function syncTriageFromStore(): void {
  const t = store.current?.prenatal_visit?.triage
  if (!t) return
  localTriage.concerns = t.concerns ?? ''
  localTriage.fetal_movement = (t.fetal_movement as LocalTriage['fetal_movement']) ?? ''
  localTriage.danger_signs = [...(t.danger_signs ?? [])]
  localTriage.danger_signs_reviewed = t.danger_signs_reviewed ?? false
  localTriage.mood_screening = (t as Record<string, unknown>).mood_screening as string ?? ''
  const v = t.vitals
  localTriage.vitals.bp_systolic = v?.bp_systolic != null ? String(v.bp_systolic) : ''
  localTriage.vitals.bp_diastolic = v?.bp_diastolic != null ? String(v.bp_diastolic) : ''
  localTriage.vitals.heart_rate = v?.heart_rate != null ? String(v.heart_rate) : ''
  localTriage.vitals.respiratory_rate = v?.respiratory_rate != null ? String(v.respiratory_rate) : ''
  localTriage.vitals.temperature = v?.temperature != null ? String(v.temperature) : ''
  localTriage.vitals.weight = v?.weight != null ? String(v.weight) : ''
  localTriage.vitals.spo2 = (v as Record<string, unknown>)?.spo2 != null ? String((v as Record<string, unknown>).spo2) : ''
  localTriage.vitals.urine_protein = ((v as Record<string, unknown>)?.urine_protein as string) ?? ''
  localTriage.vitals.urine_sugar = ((v as Record<string, unknown>)?.urine_sugar as string) ?? ''
}

const bpAlert = computed<false | 'elevated' | 'severe'>(() => {
  const sys = Number(localTriage.vitals.bp_systolic)
  const dia = Number(localTriage.vitals.bp_diastolic)
  if (!sys && !dia) return false
  if (sys >= 160 || dia >= 110) return 'severe'
  if (sys >= 140 || dia >= 90) return 'elevated'
  return false
})

const showFetalMovement = computed(() => (gaWeeks.value ?? 0) >= 16)

function buildTriagePayload(): PrenatalTriage {
  return {
    concerns: localTriage.concerns || null,
    fetal_movement: (localTriage.fetal_movement as PrenatalTriage['fetal_movement']) || null,
    kick_counts_performed: null,
    danger_signs: [...localTriage.danger_signs],
    danger_signs_reviewed: localTriage.danger_signs_reviewed,
    mood_screening: (localTriage.mood_screening as PrenatalTriage['mood_screening']) || null,
    vitals: {
      bp_systolic: localTriage.vitals.bp_systolic ? Number(localTriage.vitals.bp_systolic) : null,
      bp_diastolic: localTriage.vitals.bp_diastolic ? Number(localTriage.vitals.bp_diastolic) : null,
      heart_rate: localTriage.vitals.heart_rate ? Number(localTriage.vitals.heart_rate) : null,
      respiratory_rate: localTriage.vitals.respiratory_rate ? Number(localTriage.vitals.respiratory_rate) : null,
      temperature: localTriage.vitals.temperature ? Number(localTriage.vitals.temperature) : null,
      weight: localTriage.vitals.weight ? Number(localTriage.vitals.weight) : null,
      spo2: localTriage.vitals.spo2 ? Number(localTriage.vitals.spo2) : null,
      urine_protein: localTriage.vitals.urine_protein || null,
      urine_sugar: localTriage.vitals.urine_sugar || null,
    },
  }
}

let triageSaving = false
function saveTriage(): void {
  triageSaving = true
  handleSave({ triage: buildTriagePayload() }).finally(() => { triageSaving = false })
}

// ── Local assessment state ───────────────────────────────────────────
interface LocalAssessment {
  ob_exam: {
    fundal_height: string
    fetal_heart_rate: string
    fhr_method: string
    fetal_presentation: string
    edema: string
    edema_location: string[]
  }
  cervical: {
    cervical_dilation: string
    cervical_effacement: string
    cervical_consistency: string
    cervical_position: string
    fetal_station: string
    bishop_score: string
  }
  ultrasound: {
    type: string
    findings: string
    date: string
    ga_weeks: string
    ga_days: string
    edd: string
  }
  pregnancy_progress: string
  risk_level_update: string
  diagnoses: AssessmentDiagnosis[]
  notes: string
}

function emptyAssessment(): LocalAssessment {
  return {
    ob_exam: {
      fundal_height: '',
      fetal_heart_rate: '',
      fhr_method: '',
      fetal_presentation: '',
      edema: '',
      edema_location: [],
    },
    cervical: {
      cervical_dilation: '',
      cervical_effacement: '',
      cervical_consistency: '',
      cervical_position: '',
      fetal_station: '',
      bishop_score: '',
    },
    ultrasound: {
      type: '',
      findings: '',
      date: '',
      ga_weeks: '',
      ga_days: '',
      edd: '',
    },
    pregnancy_progress: '',
    risk_level_update: '',
    diagnoses: [],
    notes: '',
  }
}

const localAssessment = reactive<LocalAssessment>(emptyAssessment())
const cervicalOpen = ref(false)
const ultrasoundOpen = ref(false)

// Auto-open cervical section at >=38w (done every visit, shouldn't need a click)
watch(gaWeeks, (w) => {
  if (w !== null && w >= 38 && !cervicalOpen.value) cervicalOpen.value = true
}, { immediate: true })

// Documentation by exception: pre-populate normal defaults for new visits
function applyNormalDefaults(): void {
  const a = localAssessment
  const w = gaWeeks.value ?? 0
  // Triage defaults
  if (w >= 16 && !localTriage.fetal_movement) localTriage.fetal_movement = w >= 20 ? 'present' : 'not_yet_felt'
  // Assessment defaults
  if (!a.ob_exam.edema) a.ob_exam.edema = 'none'
  if (!a.pregnancy_progress) a.pregnancy_progress = 'normal'
  // Carry forward risk level from pregnancy
  if (!a.risk_level_update && pregnancyRiskLevel.value) a.risk_level_update = pregnancyRiskLevel.value
  // Cervical defaults at >=38w
  if (w >= 38) {
    if (!a.cervical.cervical_consistency) a.cervical.cervical_consistency = 'firm'
    if (!a.cervical.cervical_position) a.cervical.cervical_position = 'posterior'
  }
  // Fetal presentation default at >=28w
  if (w >= 28 && !a.ob_exam.fetal_presentation) a.ob_exam.fetal_presentation = 'cephalic'
}

function syncAssessmentFromStore(): void {
  const a = store.current?.prenatal_visit?.assessment
  if (!a) return
  const o = a.ob_exam
  localAssessment.ob_exam.fundal_height = o.fundal_height !== null && o.fundal_height !== undefined ? String(o.fundal_height) : ''
  localAssessment.ob_exam.fetal_heart_rate = o.fetal_heart_rate !== null && o.fetal_heart_rate !== undefined ? String(o.fetal_heart_rate) : ''
  localAssessment.ob_exam.fhr_method = o.fhr_method ?? ''
  localAssessment.ob_exam.fetal_presentation = o.fetal_presentation ?? ''
  localAssessment.ob_exam.edema = o.edema ?? ''
  localAssessment.ob_exam.edema_location = [...(o.edema_location ?? [])]
  const c = a.cervical
  localAssessment.cervical.cervical_dilation = c.cervical_dilation !== null && c.cervical_dilation !== undefined ? String(c.cervical_dilation) : ''
  localAssessment.cervical.cervical_effacement = c.cervical_effacement !== null && c.cervical_effacement !== undefined ? String(c.cervical_effacement) : ''
  localAssessment.cervical.cervical_consistency = c.cervical_consistency ?? ''
  localAssessment.cervical.cervical_position = c.cervical_position ?? ''
  localAssessment.cervical.fetal_station = c.fetal_station !== null && c.fetal_station !== undefined ? String(c.fetal_station) : ''
  localAssessment.cervical.bishop_score = c.bishop_score !== null && c.bishop_score !== undefined ? String(c.bishop_score) : ''
  const u = a.ultrasound
  localAssessment.ultrasound.type = u.type ?? ''
  localAssessment.ultrasound.findings = u.findings ?? ''
  localAssessment.ultrasound.date = u.date ?? ''
  localAssessment.ultrasound.ga_weeks = u.ga_weeks !== null && u.ga_weeks !== undefined ? String(u.ga_weeks) : ''
  localAssessment.ultrasound.ga_days = u.ga_days !== null && u.ga_days !== undefined ? String(u.ga_days) : ''
  localAssessment.ultrasound.edd = u.edd ?? ''
  // Auto-open ultrasound if data exists
  if (u.type || u.findings || u.date) ultrasoundOpen.value = true
  localAssessment.pregnancy_progress = a.pregnancy_progress ?? ''
  localAssessment.risk_level_update = a.risk_level_update ?? ''
  localAssessment.diagnoses = [...(a.diagnoses ?? [])]
  localAssessment.notes = a.notes ?? ''
}

const showFetalPresentation = computed(() => (gaWeeks.value ?? 0) >= 28)
const showCervical = computed(() => (gaWeeks.value ?? 0) >= 38)

// FH consistency auto-compute: FH cm should be within ±3 of GA weeks
const fhConsistency = computed<'consistent' | 'large_for_dates' | 'small_for_dates' | null>(() => {
  const fh = Number(localAssessment.ob_exam.fundal_height)
  const ga = gaWeeks.value
  if (!fh || ga === null) return null
  if (fh > ga + 3) return 'large_for_dates'
  if (fh < ga - 3) return 'small_for_dates'
  return 'consistent'
})

const fhBadge = computed(() => {
  switch (fhConsistency.value) {
    case 'consistent': return { text: 'Consistent with GA', class: 'text-green-600 dark:text-green-400' }
    case 'large_for_dates': return { text: 'Large for dates', class: 'text-amber-600 dark:text-amber-400' }
    case 'small_for_dates': return { text: 'Small for dates', class: 'text-amber-600 dark:text-amber-400' }
    default: return null
  }
})

const fhrAlert = computed(() => {
  const v = Number(localAssessment.ob_exam.fetal_heart_rate)
  if (!v) return false
  return v < 110 || v > 160
})

// Bishop Score auto-calculation from cervical components
const bishopScoreComputed = computed(() => {
  const d = Number(localAssessment.cervical.cervical_dilation)
  const e = Number(localAssessment.cervical.cervical_effacement)
  const c = localAssessment.cervical.cervical_consistency
  const p = localAssessment.cervical.cervical_position
  const s = Number(localAssessment.cervical.fetal_station)
  // Need at least dilation and effacement to compute
  if (!d && d !== 0 && !e && e !== 0) return null
  let score = 0
  // Dilation: 0=closed, 1=1-2cm, 2=3-4cm, 3=5-6cm
  if (d >= 5) score += 3; else if (d >= 3) score += 2; else if (d >= 1) score += 1
  // Effacement: 0=0-30%, 1=40-50%, 2=60-70%, 3=80+%
  if (e >= 80) score += 3; else if (e >= 60) score += 2; else if (e >= 40) score += 1
  // Consistency: firm=0, medium=1, soft=2
  if (c === 'soft') score += 2; else if (c === 'medium') score += 1
  // Position: posterior=0, mid=1, anterior=2
  if (p === 'anterior') score += 2; else if (p === 'mid') score += 1
  // Station: -3=0, -2=1, -1/0=2, +1/+2=3
  if (s >= 1) score += 3; else if (s >= -1) score += 2; else if (s >= -2) score += 1
  return score
})

const fhrMethodMissing = computed(() => {
  return !!localAssessment.ob_exam.fetal_heart_rate && !localAssessment.ob_exam.fhr_method
})

const riskBadgeClass = computed(() => {
  switch (localAssessment.risk_level_update) {
    case 'low': return 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
    case 'moderate': return 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400'
    case 'high': return 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400'
    default: return ''
  }
})


function buildAssessmentPayload(): PrenatalAssessment {
  return {
    ob_exam: {
      fundal_height: localAssessment.ob_exam.fundal_height ? Number(localAssessment.ob_exam.fundal_height) : null,
      fh_consistent_with_ga: fhConsistency.value,
      fetal_heart_rate: localAssessment.ob_exam.fetal_heart_rate ? Number(localAssessment.ob_exam.fetal_heart_rate) : null,
      fhr_method: (localAssessment.ob_exam.fhr_method as PrenatalAssessment['ob_exam']['fhr_method']) || null,
      fetal_presentation: localAssessment.ob_exam.fetal_presentation || null,
      fetal_lie: null,
      engagement: null,
      leopolds_performed: null,
      edema: localAssessment.ob_exam.edema || null,
      edema_location: [...localAssessment.ob_exam.edema_location],
      abdominal_exam: null,
      speculum_exam: null,
      breast_exam: null,
    },
    cervical: {
      cervical_dilation: localAssessment.cervical.cervical_dilation ? Number(localAssessment.cervical.cervical_dilation) : null,
      cervical_effacement: localAssessment.cervical.cervical_effacement ? Number(localAssessment.cervical.cervical_effacement) : null,
      cervical_consistency: localAssessment.cervical.cervical_consistency || null,
      cervical_position: localAssessment.cervical.cervical_position || null,
      fetal_station: localAssessment.cervical.fetal_station ? Number(localAssessment.cervical.fetal_station) : null,
      bishop_score: bishopScoreComputed.value,
    },
    ultrasound: {
      type: localAssessment.ultrasound.type || null,
      findings: localAssessment.ultrasound.findings || null,
      date: localAssessment.ultrasound.date || null,
      ga_weeks: localAssessment.ultrasound.ga_weeks ? Number(localAssessment.ultrasound.ga_weeks) : null,
      ga_days: localAssessment.ultrasound.ga_days ? Number(localAssessment.ultrasound.ga_days) : null,
      edd: localAssessment.ultrasound.edd || null,
    },
    pregnancy_progress: (localAssessment.pregnancy_progress as PrenatalAssessment['pregnancy_progress']) || null,
    risk_level_update: (localAssessment.risk_level_update as PrenatalAssessment['risk_level_update']) || null,
    new_risk_factors: [],
    complications: [],
    diagnoses: [...localAssessment.diagnoses],
    notes: localAssessment.notes || null,
  }
}

function saveAssessment(): void {
  handleSave({ assessment: buildAssessmentPayload() })
}

// ── Diagnosis search ─────────────────────────────────────────────────
const diagnosisQuery = ref('')
const diagnosisResults = ref<DiagnosisSearchResult[]>([])
const isDiagnosisSearching = ref(false)
const showDiagnosisDropdown = ref(false)
const diagnosisHighlight = ref(-1)
let diagnosisDebounce: ReturnType<typeof setTimeout> | null = null

function onDiagnosisInput(val: string | number): void {
  diagnosisQuery.value = String(val)
  if (diagnosisDebounce) clearTimeout(diagnosisDebounce)
  const q = diagnosisQuery.value.trim()
  if (q.length < 2) {
    diagnosisResults.value = []
    showDiagnosisDropdown.value = false
    return
  }
  diagnosisDebounce = setTimeout(async () => {
    isDiagnosisSearching.value = true
    try {
      const res = await consultationApi.searchDiagnoses(q)
      diagnosisResults.value = res.data.filter(
        (r) => !localAssessment.diagnoses.some((d) => d.description === r.description && d.source === r.source),
      )
      diagnosisHighlight.value = diagnosisResults.value.length > 0 ? 0 : -1
      showDiagnosisDropdown.value = diagnosisResults.value.length > 0
    } finally {
      isDiagnosisSearching.value = false
    }
  }, 300)
}

function selectDiagnosis(result: DiagnosisSearchResult): void {
  localAssessment.diagnoses.push({
    description: result.description,
    code: result.code,
    diagnosis_id: result.id,
    source: result.source,
  })
  diagnosisQuery.value = ''
  diagnosisResults.value = []
  showDiagnosisDropdown.value = false
  saveAssessment()
}

function addManualDiagnosis(): void {
  const desc = diagnosisQuery.value.trim()
  if (!desc) return
  if (localAssessment.diagnoses.some((d) => d.description.toLowerCase() === desc.toLowerCase())) return
  localAssessment.diagnoses.push({
    description: desc,
    code: null,
    diagnosis_id: null,
    source: 'manual',
  })
  diagnosisQuery.value = ''
  diagnosisResults.value = []
  showDiagnosisDropdown.value = false
  saveAssessment()
}

function removeDiagnosis(index: number): void {
  localAssessment.diagnoses.splice(index, 1)
  saveAssessment()
}

function onDiagnosisKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (showDiagnosisDropdown.value && diagnosisResults.value.length > 0) {
      diagnosisHighlight.value = (diagnosisHighlight.value + 1) % diagnosisResults.value.length
      document.querySelector('[data-dx-highlighted="true"]')?.scrollIntoView({ block: 'nearest' })
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (showDiagnosisDropdown.value && diagnosisResults.value.length > 0) {
      diagnosisHighlight.value = diagnosisHighlight.value <= 0
        ? diagnosisResults.value.length - 1
        : diagnosisHighlight.value - 1
      document.querySelector('[data-dx-highlighted="true"]')?.scrollIntoView({ block: 'nearest' })
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (showDiagnosisDropdown.value && diagnosisHighlight.value >= 0) {
      selectDiagnosis(diagnosisResults.value[diagnosisHighlight.value]!)
    } else if (diagnosisQuery.value.trim()) {
      addManualDiagnosis()
    }
  } else if (e.key === 'Escape') {
    showDiagnosisDropdown.value = false
    diagnosisHighlight.value = -1
  }
}

function onDiagnosisBlur(): void {
  setTimeout(() => { showDiagnosisDropdown.value = false }, 200)
}

// ── Local plan state ─────────────────────────────────────────────────
interface LocalPlan {
  next_visit_date: string
  counseling_provided: string[]
  birth_plan_discussed: boolean

  notes: string
}

function emptyPlan(): LocalPlan {
  return {
    next_visit_date: '',
    counseling_provided: [],
    birth_plan_discussed: false,
    notes: '',
  }
}

const localPlan = reactive<LocalPlan>(emptyPlan())

function syncPlanFromStore(): void {
  const p = store.current?.prenatal_visit?.plan
  if (!p) return
  localPlan.next_visit_date = p.next_visit_date ?? ''
  localPlan.counseling_provided = [...(p.counseling_provided ?? [])]
  localPlan.birth_plan_discussed = p.birth_plan_discussed ?? false
  localPlan.notes = p.notes ?? ''
}

const isTrimester3 = computed(() => trimester.value === '3')

const suggestedVisitInterval = computed(() => {
  const w = gaWeeks.value ?? 0
  if (w >= 36) return 'Weekly visits recommended (36+ weeks)'
  if (w >= 28) return 'Every 2 weeks recommended (28–36 weeks)'
  return 'Monthly visits recommended (< 28 weeks)'
})

// Weight gain badge
const weightGainStatus = computed(() => store.current?.prenatal_visit?.weight_gain_status ?? null)
const cumulativeWeightGain = computed(() => store.current?.prenatal_visit?.cumulative_weight_gain ?? null)

const weightGainBadge = computed(() => {
  const status = weightGainStatus.value
  const gain = cumulativeWeightGain.value
  if (gain === null) return null
  const sign = gain >= 0 ? '+' : ''
  const label = `${sign}${gain.toFixed(1)} kg total`
  switch (status) {
    case 'normal': return { text: `On track (${label})`, class: 'text-green-600 dark:text-green-400' }
    case 'above': return { text: `Above expected (${label})`, class: 'text-amber-600 dark:text-amber-400' }
    case 'below': return { text: `Below expected (${label})`, class: 'text-amber-600 dark:text-amber-400' }
    default: return { text: label, class: 'text-muted-foreground' }
  }
})


// Sparkline chart options for BP and FHR trends
const bpSparkline = computed(() => {
  const data = bpTrend.value
  if (data.length < 2) return null
  return {
    grid: { top: 4, right: 4, bottom: 4, left: 4 },
    xAxis: { show: false, type: 'category', data: data.map((d) => `${d.gestational_age_weeks}w`) },
    yAxis: { show: false, type: 'value', min: 50, max: 180 },
    series: [
      { data: data.map((d) => d.systolic), type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#ef4444' }, areaStyle: { color: 'rgba(239,68,68,0.08)' } },
      { data: data.map((d) => d.diastolic), type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#3b82f6' }, areaStyle: { color: 'rgba(59,130,246,0.08)' } },
    ],
    tooltip: { trigger: 'axis', textStyle: { fontSize: 10 }, formatter: (p: Array<{ name: string; value: number }>) => `${p[0]?.name}: ${p[0]?.value}/${p[1]?.value}` },
  }
})

const fhrSparkline = computed(() => {
  const data = fhrTrend.value
  if (data.length < 2) return null
  return {
    grid: { top: 4, right: 4, bottom: 4, left: 4 },
    xAxis: { show: false, type: 'category', data: data.map((d) => `${d.gestational_age_weeks}w`) },
    yAxis: { show: false, type: 'value', min: 90, max: 180 },
    series: [
      { data: data.map((d) => d.fetal_heart_rate), type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#8b5cf6' }, areaStyle: { color: 'rgba(139,92,246,0.08)' } },
    ],
    tooltip: { trigger: 'axis', textStyle: { fontSize: 10 }, formatter: (p: Array<{ name: string; value: number }>) => `${p[0]?.name}: ${p[0]?.value} bpm` },
  }
})

// ── Follow-up scheduling (schedule-aware) ────────────────────────────
const workingDays = ref<DaySchedule[]>([])
const scheduleLoading = ref(false)
const followUpSlots = ref<Slot[]>([])
const followUpSlotsLoading = ref(false)
const followUpSelectedDate = ref<string | null>(null)
const followUpSelectedSlot = ref<string | null>(null)
const isBookingFollowUp = ref(false)
const followUpBooked = ref(false)

const minFollowUpDate = today(getLocalTimeZone()).add({ days: 1 })

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
  const dt = new Date(d)
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

  // Fetch available slots (don't save yet — save only when slot is booked)
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
      reason: 'Prenatal visit',
      consultation_type: 'follow_up',
    })
    followUpBooked.value = true
    localPlan.next_visit_date = followUpSelectedDate.value ?? ''
    savePlan()
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
  savePlan()
}

// ── Smart follow-up recommendation ──────────────────────────────────
const recommendedDate = computed(() => {
  const w = gaWeeks.value ?? 0
  const visitDate = store.current?.visit_date ? new Date(store.current.visit_date) : new Date()
  let daysToAdd = 28
  if (w >= 36) daysToAdd = 7
  else if (w >= 28) daysToAdd = 14
  const target = new Date(visitDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
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

  // Check if recommended date is a working day with available slots
  if (isWorkingDay(targetIso) && await checkDateHasSlots(targetIso)) {
    isCheckingRecommended.value = false
    return // recommended date is available — button will show it directly
  }

  // Recommended date unavailable — find alternatives
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

// ── Ultrasound GA ↔ EDD auto-computation ────────────────────────────
// GA → EDD: EDD = ultrasound_date + (280 - GA_in_days)
let eddAutoUpdating = false
function computeEddFromGA(): void {
  const usDate = localAssessment.ultrasound.date
  const w = Number(localAssessment.ultrasound.ga_weeks)
  const d = Number(localAssessment.ultrasound.ga_days) || 0
  if (!usDate || (!w && w !== 0)) return
  const gaDays = w * 7 + d
  if (gaDays <= 0 || gaDays > 308) return // sanity: 0-44 weeks
  const usDateMs = new Date(usDate).getTime()
  if (isNaN(usDateMs)) return
  const eddMs = usDateMs + (280 - gaDays) * 86400000
  eddAutoUpdating = true
  localAssessment.ultrasound.edd = new Date(eddMs).toISOString().slice(0, 10)
  eddAutoUpdating = false
}

// EDD → GA: GA_in_days = 280 - (EDD - ultrasound_date)
function computeGAFromEdd(): void {
  if (eddAutoUpdating) return
  const usDate = localAssessment.ultrasound.date
  const edd = localAssessment.ultrasound.edd
  if (!usDate || !edd) return
  const usDateMs = new Date(usDate).getTime()
  const eddMs = new Date(edd).getTime()
  if (isNaN(usDateMs) || isNaN(eddMs)) return
  const gaDays = 280 - Math.round((eddMs - usDateMs) / 86400000)
  if (gaDays < 0 || gaDays > 308) return
  localAssessment.ultrasound.ga_weeks = String(Math.floor(gaDays / 7))
  localAssessment.ultrasound.ga_days = String(gaDays % 7)
}

// Computed EDD from GA for range-limiting manual EDD entry (±14 days)
const computedUtzEdd = computed(() => {
  const usDate = localAssessment.ultrasound.date
  const w = Number(localAssessment.ultrasound.ga_weeks)
  if (!usDate || (!w && w !== 0)) return null
  const d = Number(localAssessment.ultrasound.ga_days) || 0
  const gaDays = w * 7 + d
  if (gaDays <= 0) return null
  const usDateMs = new Date(usDate).getTime()
  if (isNaN(usDateMs)) return null
  return new Date(usDateMs + (280 - gaDays) * 86400000).toISOString().slice(0, 10)
})

// ── EDD adoption from ultrasound ────────────────────────────────────
const showEddAdoptModal = ref(false)
const eddDeclined = ref(false)
const isUpdatingEdd = ref(false)

const eddDiffers = computed(() => {
  const usEdd = localAssessment.ultrasound.edd
  if (!usEdd || !pregnancyEdd.value) return false
  return usEdd !== pregnancyEdd.value
})

const eddComparison = computed(() => {
  const usEdd = localAssessment.ultrasound.edd
  if (!usEdd || !pregnancyEdd.value) return null
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  // Compute GA from each EDD
  const today = new Date()
  const calcGA = (edd: string) => {
    const eddDate = new Date(edd)
    const gaDays = Math.floor((280 - (eddDate.getTime() - today.getTime()) / 86400000))
    const w = Math.floor(gaDays / 7)
    const d = gaDays % 7
    return { weeks: Math.max(0, w), days: Math.max(0, d), label: `${Math.max(0, w)}w${Math.max(0, d)}d` }
  }
  const currentGA = calcGA(pregnancyEdd.value)
  const newGA = calcGA(usEdd)
  const diffDays = Math.abs(Math.round((new Date(usEdd).getTime() - new Date(pregnancyEdd.value).getTime()) / 86400000))
  return {
    currentEdd: fmt(pregnancyEdd.value),
    newEdd: fmt(usEdd),
    currentGA: currentGA.label,
    newGA: newGA.label,
    diffDays,
    rawNewEdd: usEdd,
  }
})

async function adoptUltrasoundEdd(): Promise<void> {
  const enc = store.current
  if (!enc?.pregnancy_id || !eddComparison.value) return
  isUpdatingEdd.value = true
  try {
    await pdStore.updatePregnancy(enc.pregnancy_id, {
      edd: eddComparison.value.rawNewEdd,
      edd_source: 'ultrasound',
    })
    // pregnancyEdd auto-updates from pdStore.currentPregnancy.edd
    // Reload encounter to get recalculated GA
    await store.loadEncounter(enc.id)
    syncTriageFromStore()
    syncAssessmentFromStore()
    syncPlanFromStore()
    showEddAdoptModal.value = false
    eddDeclined.value = false
    toast.success('Pregnancy EDD updated from ultrasound')
  } catch {
    toast.error('Failed to update EDD')
  } finally {
    isUpdatingEdd.value = false
  }
}

function declineEddAdoption(): void {
  showEddAdoptModal.value = false
  eddDeclined.value = true
}

const COUNSELING_OPTIONS = [
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'medications_supplements', label: 'Medications / Supplements' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'activity_restrictions', label: 'Activity / Work Restrictions' },
  { key: 'danger_signs', label: 'Danger Signs' },
  { key: 'breastfeeding', label: 'Breastfeeding' },
  { key: 'family_planning', label: 'Family Planning' },
] as const

function toggleCounseling(key: string): void {
  const idx = localPlan.counseling_provided.indexOf(key)
  if (idx === -1) {
    localPlan.counseling_provided.push(key)
  } else {
    localPlan.counseling_provided.splice(idx, 1)
  }
}

function buildPlanPayload(): PrenatalPlan {
  return {
    next_visit_date: localPlan.next_visit_date || null,
    counseling_provided: [...localPlan.counseling_provided],
    birth_plan_discussed: localPlan.birth_plan_discussed,
    education_provided: [],
    referrals: [],
    notes: localPlan.notes || null,
  }
}

let planSaving = false
function savePlan(): void {
  planSaving = true
  handleSave({ plan: buildPlanPayload() }).finally(() => { planSaving = false })
}

// ── Lifecycle ────────────────────────────────────────────────────────
onMounted(async () => {
  loadError.value = null
  try {
    const id = typeof route.params.id === 'string' ? route.params.id : route.params.id[0] ?? ''
    // Skip if EncounterFormRouter already loaded this encounter
    if (!store.current || store.current.id !== id) {
      await store.loadEncounter(id)
    }
    syncTriageFromStore()
    syncAssessmentFromStore()
    syncPlanFromStore()
    loadReminders()
    const enc = store.current
    if (enc?.patient_id) {
      // Ensure patient is loaded in store (may navigate directly to encounter URL)
      if (!pdStore.patient) {
        await pdStore.loadPatient(enc.patient_id)
        await pdStore.loadCore()
      }
      // Ensure patient-level OB-GYN data is loaded (gynProfile + pregnancies list)
      if (!pdStore.gynProfile) await pdStore.loadObgyn()
      // Load pregnancy detail (currentPregnancy, dashboard, visits, labsDue)
      if (enc.pregnancy_id) await pdStore.loadPregnancyDetail(enc.pregnancy_id)
    }
    // Pre-populate normal defaults for new visits (documentation by exception)
    const isNewVisit = !store.current?.prenatal_visit?.triage?.concerns
      && !store.current?.prenatal_visit?.triage?.vitals?.bp_systolic
      && !store.current?.prenatal_visit?.assessment?.notes
    if (isNewVisit) applyNormalDefaults()
    setupTabsObserver()
    // If follow-up date already set, restore selection state
    if (localPlan.next_visit_date) {
      followUpSelectedDate.value = localPlan.next_visit_date
      followUpBooked.value = true
    }
    // Load schedule then pre-check recommended date availability
    loadDoctorSchedule().then(() => {
      if (!localPlan.next_visit_date) checkRecommendedAvailability()
    })
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      loadError.value = 'You don\'t have permission to access this encounter.'
    } else {
      loadError.value = 'Failed to load encounter. Please try again.'
    }
  }
})

onUnmounted(() => {
  tabsObserver?.disconnect()
  tabsObserver = null
  store.clearCurrent()
})

// Re-sync local state if the store updates from realtime events
watch(
  () => store.current?.prenatal_visit?.triage,
  () => { if (!triageSaving) syncTriageFromStore() },
  { deep: true },
)
watch(
  () => store.current?.prenatal_visit?.assessment,
  () => { syncAssessmentFromStore() },
  { deep: true },
)
watch(
  () => store.current?.prenatal_visit?.plan,
  () => { if (!planSaving) syncPlanFromStore() },
  { deep: true },
)

// ── Save / finalize ──────────────────────────────────────────────────
async function handleSave(payload: UpdateEncounterPayload): Promise<void> {
  await store.saveSection(payload)
}

// Finalize completeness check
const finalizeMissingItems = computed(() => {
  const missing: string[] = []
  const t = localTriage
  if (!t.vitals.bp_systolic && !t.vitals.bp_diastolic) missing.push('No blood pressure recorded')
  if (!t.vitals.weight) missing.push('No weight recorded')
  if (localAssessment.diagnoses.length === 0) missing.push('No diagnosis added')
  if (!localAssessment.ob_exam.fetal_heart_rate) missing.push('No fetal heart rate recorded')
  if (t.danger_signs.length > 0 && !t.danger_signs_reviewed) missing.push('Danger signs not reviewed with patient')
  return missing
})

async function handleFinalizeConfirm(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    showFinalizeModal.value = false
  }
}

// ── Tab navigation ───────────────────────────────────────────────────
const allTabs = ['triage', 'assessment', 'plan', 'billing'] as const
type TabKey = (typeof allTabs)[number]

const tabLabels: Record<TabKey, string> = {
  triage: 'Triage',
  assessment: 'Assessment',
  plan: 'Plan',
  billing: 'Billing',
}

const tabIcons: Record<TabKey, typeof Activity> = {
  triage: Activity,
  assessment: Stethoscope,
  plan: ClipboardList,
  billing: DollarSign,
}

const visibleTabs = computed<TabKey[]>(() =>
  allTabs.filter((tab) => {
    if (tab === 'assessment') return canEditAssessment.value
    return true
  }),
)

const currentTabIndex = computed(() => visibleTabs.value.indexOf(activeTab.value as TabKey))

const prevTabLabel = computed(() => {
  const idx = currentTabIndex.value - 1
  return idx >= 0 ? tabLabels[visibleTabs.value[idx]!] : null
})

const nextTabLabel = computed(() => {
  const idx = currentTabIndex.value + 1
  return idx < visibleTabs.value.length ? tabLabels[visibleTabs.value[idx]!] : null
})

function goToTab(direction: 'prev' | 'next'): void {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  const tab = visibleTabs.value[idx]
  if (tab) activeTab.value = tab
}
</script>

<template>
  <!-- Loading -->
  <div v-if="store.isLoading && !store.current" class="flex flex-1 items-center justify-center py-12">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
  </div>

  <!-- Error -->
  <div
    v-else-if="loadError"
    role="alert"
    class="mx-auto max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {{ loadError }}
  </div>

  <!-- Main layout -->
  <Tabs
    v-else-if="store.current"
    v-model="activeTab"
    class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <!-- Sticky header -->
    <div class="sticky top-0 z-10 border-b bg-background">
      <div class="flex flex-col gap-2 px-4 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <!-- Left: back + patient info + badges -->
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" class="gap-1.5" @click="router.back()">
            <ArrowLeft class="size-3.5" />
            {{ store.current.patient_name }}
          </Button>

          <!-- GA badge -->
          <Badge
            v-if="gaLabel"
            variant="secondary"
            class="gap-1 font-mono"
          >
            <Baby class="size-3" />
            {{ gaLabel }}
          </Badge>

          <!-- Trimester badge -->
          <Badge
            v-if="trimesterLabel"
            variant="outline"
            :class="trimesterBadgeClass"
          >
            {{ trimesterLabel }}
          </Badge>

          <!-- Visit number badge -->
          <Badge
            v-if="visitNumber"
            variant="outline"
          >
            Visit #{{ visitNumber }}
          </Badge>

          <!-- Status badges -->
          <Badge
            v-if="store.isDraft"
            class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
            variant="outline"
          >
            Draft
          </Badge>
          <Badge
            v-else-if="store.isFinalized"
            class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
            variant="outline"
          >
            <CheckCircle2 class="size-3" />
            Finalized
          </Badge>
        </div>

        <!-- Right: actions -->
        <div v-if="store.isDraft" class="flex items-center gap-2">
          <p v-if="store.isSaving" class="text-xs text-muted-foreground">
            Saving...
          </p>
          <p v-if="store.saveError" class="text-xs text-destructive">
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
            @click="showFinalizeModal = true"
          >
            <CheckCircle2 class="size-3.5" />
            Finalize
          </Button>
        </div>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <!-- Floating mini tabs (outside scroll, positioned over the form column) -->
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
          class="pointer-events-none absolute inset-x-0 top-2 z-30 flex lg:pr-[25%]"
        >
          <div class="pointer-events-auto mx-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-md backdrop-blur">
            <button
              v-for="tab in visibleTabs"
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
      <!-- Left: Tabs + Form (2/3) — scrolls independently -->
      <div ref="formScrollRef" class="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-8 lg:w-3/4">
        <!-- Hidden TabsList for reka-ui accessibility -->
        <TabsList class="sr-only">
          <TabsTrigger v-for="tab in visibleTabs" :key="tab" :value="tab">{{ tabLabels[tab] }}</TabsTrigger>
        </TabsList>

        <!-- Mobile context chips (visible below lg) -->
        <div class="flex flex-wrap items-center gap-1.5 py-2 lg:hidden">
          <Badge v-if="gaLabel" variant="secondary" class="gap-1 font-mono text-[10px]">
            <Baby class="size-2.5" />
            {{ gaLabel }}
          </Badge>
          <Badge v-if="gpal" variant="outline" class="font-mono text-[10px]">
            {{ gpal }}
          </Badge>
          <Badge v-if="pregnancyEdd" variant="outline" class="text-[10px]">
            EDD {{ formatEdd() }}
          </Badge>
          <Badge
            v-if="pregnancyRiskLevel"
            variant="outline"
            class="text-[10px]"
            :class="pregnancyRiskLevel === 'high' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400' : 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'"
          >
            {{ pregnancyRiskLevel === 'high' ? 'High Risk' : 'Low Risk' }}
          </Badge>
          <Badge v-if="patientData?.blood_type" variant="outline" class="text-[10px]">
            {{ patientData.blood_type }}
          </Badge>
        </div>

        <!-- Step tabs -->
        <div ref="tabsListRef" class="mb-5 py-3">
          <div class="relative mx-0 md:mx-8">
            <!-- Connector line (single continuous line behind circles) -->
            <div class="absolute top-5 left-5 right-5 h-0.5 bg-border">
              <div
                class="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-500 ease-in-out"
                :style="{ width: visibleTabs.length > 1 ? `${(currentTabIndex / (visibleTabs.length - 1)) * 100}%` : '0%' }"
              />
            </div>
            <!-- Step circles -->
            <div class="relative flex justify-between">
              <button
                v-for="tab in visibleTabs"
                :key="tab"
                type="button"
                class="flex flex-col items-center gap-1.5"
                @click="activeTab = tab"
              >
                <div
                  class="flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300"
                  :class="activeTab === tab
                    ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                    : visibleTabs.indexOf(tab) < currentTabIndex
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

        <!-- Floating mini tabs -->
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

        <!-- ── TRIAGE TAB ─────────────────────────────────────────── -->
        <TabsContent value="triage" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

          <!-- GA context banner -->
          <div v-if="gaLabel">
          <div
            class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-md border bg-muted/40 px-4 py-3 text-sm"
          >
            <Baby class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="font-medium">{{ gaWeeks }} weeks{{ gaDays ? ` ${gaDays} days` : '' }}</span>
            <span v-if="trimesterLabel" class="text-muted-foreground">—</span>
            <span v-if="trimesterLabel" class="text-muted-foreground">{{ trimesterLabel }}</span>
            <span v-if="visitNumber" class="text-muted-foreground">—</span>
            <span v-if="visitNumber" class="text-muted-foreground">Visit #{{ visitNumber }}</span>
            <span v-if="pregnancyLmp" class="text-muted-foreground">—</span>
            <span v-if="pregnancyLmp" class="text-muted-foreground">LMP {{ new Date(pregnancyLmp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
          </div>
          </div>

          <!-- 1. Vitals (nurse fills first) -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h3>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <!-- Blood pressure (paired inputs in one cell) -->
              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">BP (mmHg)</Label>
                <div class="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="Sys"
                    min="60"
                    max="250"
                    :model-value="localTriage.vitals.bp_systolic"
                    :disabled="store.isFinalized || !canEditTriage"
                    @update:model-value="(v) => localTriage.vitals.bp_systolic = String(v)"
                    @blur="saveTriage"
                  />
                  <span class="text-muted-foreground">/</span>
                  <Input
                    type="number"
                    placeholder="Dia"
                    min="40"
                    max="160"
                    :model-value="localTriage.vitals.bp_diastolic"
                    :disabled="store.isFinalized || !canEditTriage"
                    @update:model-value="(v) => localTriage.vitals.bp_diastolic = String(v)"
                    @blur="saveTriage"
                  />
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <Label for="vital-weight" class="text-xs text-muted-foreground">Weight (kg)</Label>
                <Input
                  id="vital-weight"
                  type="number"
                  step="0.1"
                  min="30"
                  max="200"
                  placeholder="e.g. 58.5"
                  :model-value="localTriage.vitals.weight"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => localTriage.vitals.weight = String(v)"
                  @blur="saveTriage"
                />
                <p v-if="weightGainBadge" class="text-[10px] font-medium" :class="weightGainBadge.class">
                  {{ weightGainBadge.text }}
                </p>
              </div>
              <div class="flex flex-col gap-2">
                <Label for="vital-hr" class="text-xs text-muted-foreground">Heart Rate (bpm)</Label>
                <Input
                  id="vital-hr"
                  type="number"
                  placeholder="e.g. 82"
                  :model-value="localTriage.vitals.heart_rate"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => localTriage.vitals.heart_rate = String(v)"
                  @blur="saveTriage"
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="vital-rr" class="text-xs text-muted-foreground">Resp. Rate (/min)</Label>
                <Input
                  id="vital-rr"
                  type="number"
                  placeholder="e.g. 18"
                  :model-value="localTriage.vitals.respiratory_rate"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => localTriage.vitals.respiratory_rate = String(v)"
                  @blur="saveTriage"
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="vital-temp" class="text-xs text-muted-foreground">Temperature (°C)</Label>
                <Input
                  id="vital-temp"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 36.8"
                  :model-value="localTriage.vitals.temperature"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => localTriage.vitals.temperature = String(v)"
                  @blur="saveTriage"
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="vital-spo2" class="text-xs text-muted-foreground">SpO2 (%)</Label>
                <Input
                  id="vital-spo2"
                  type="number"
                  min="85"
                  max="100"
                  placeholder="e.g. 98"
                  :model-value="localTriage.vitals.spo2"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => localTriage.vitals.spo2 = String(v)"
                  @blur="saveTriage"
                />
              </div>
            </div>

            <!-- BP alert (below the grid) -->
            <p v-if="bpAlert === 'severe'" class="flex items-center gap-1.5 rounded-md border border-destructive bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle class="size-3.5" />
              Severe-range BP (>=160/110) — immediate evaluation required
            </p>
            <p v-else-if="bpAlert === 'elevated'" class="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertTriangle class="size-3.5" />
              BP >= 140/90 — consider hypertensive disorder screening
            </p>
          </div>

          <!-- 2. Urine Dipstick (point-of-care, not a vital sign) -->
          <div class="flex flex-col gap-3">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Urine Dipstick</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">Protein</Label>
                <Select
                  :model-value="localTriage.vitals.urine_protein || undefined"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => { localTriage.vitals.urine_protein = String(v ?? ''); saveTriage() }"
                >
                  <SelectTrigger class="w-full" :class="localTriage.vitals.urine_protein && localTriage.vitals.urine_protein !== 'none' && localTriage.vitals.urine_protein !== 'trace' ? 'border-destructive text-destructive' : ''">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="trace">Trace</SelectItem>
                    <SelectItem value="1+">1+</SelectItem>
                    <SelectItem value="2+">2+</SelectItem>
                    <SelectItem value="3+">3+</SelectItem>
                    <SelectItem value="4+">4+</SelectItem>
                  </SelectContent>
                </Select>
                <p
                  v-if="localTriage.vitals.urine_protein && !['none', 'trace'].includes(localTriage.vitals.urine_protein)"
                  class="flex items-center gap-1.5 text-xs font-medium text-destructive"
                >
                  <AlertTriangle class="size-3.5" />
                  Proteinuria detected — evaluate for preeclampsia
                </p>
              </div>
              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">Sugar</Label>
                <Select
                  :model-value="localTriage.vitals.urine_sugar || undefined"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => { localTriage.vitals.urine_sugar = String(v ?? ''); saveTriage() }"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="trace">Trace</SelectItem>
                    <SelectItem value="1+">1+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <!-- 3. Concerns / Chief Complaints -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Concerns / Chief Complaints</h3>
            <Textarea
              id="triage-concerns"
              :model-value="localTriage.concerns"
              placeholder="Describe the patient's concerns or complaints..."
              :disabled="store.isFinalized || !canEditTriage"
              :rows="3"
              @update:model-value="(v) => localTriage.concerns = String(v)"
              @blur="saveTriage"
            />
          </div>

          <!-- 4. Fetal Movement + Mood / Wellbeing -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div v-if="showFetalMovement" class="flex flex-col gap-2">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fetal Movement</h3>
              <Select
                :model-value="localTriage.fetal_movement || undefined"
                :disabled="store.isFinalized || !canEditTriage"
                @update:model-value="(v) => { localTriage.fetal_movement = (v as LocalTriage['fetal_movement']) ?? ''; saveTriage() }"
              >
                <SelectTrigger class="w-full" :class="localTriage.fetal_movement === 'decreased' ? 'border-destructive text-destructive' : ''">
                  <SelectValue placeholder="Select fetal movement status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="decreased">Decreased</SelectItem>
                  <SelectItem value="not_yet_felt">Not yet felt</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="localTriage.fetal_movement === 'decreased'" class="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle class="size-3.5" />
                Decreased fetal movement — requires further evaluation
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mood / Wellbeing</h3>
              <Select
                :model-value="localTriage.mood_screening || undefined"
                :disabled="store.isFinalized || !canEditTriage"
                @update:model-value="(v) => { localTriage.mood_screening = String(v ?? ''); saveTriage() }"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_concerns">No concerns</SelectItem>
                  <SelectItem value="low_mood_anxiety">Reports low mood or anxiety</SelectItem>
                  <SelectItem value="referred">Referred for support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- 6. Danger Signs -->
          <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-destructive">Danger Signs</h3>
            <DangerSignsChecklist
              :model-value="localTriage.danger_signs"
              :disabled="store.isFinalized || !canEditTriage"
              @update:model-value="(v) => { localTriage.danger_signs = v; saveTriage() }"
            />
            <label class="flex items-center gap-2 border-t pt-3 cursor-pointer">
              <input
                type="checkbox"
                :checked="localTriage.danger_signs_reviewed"
                :disabled="store.isFinalized || !canEditTriage"
                class="size-4 shrink-0 rounded-[4px] border border-input shadow-xs accent-primary"
                @change="localTriage.danger_signs_reviewed = !localTriage.danger_signs_reviewed; saveTriage()"
              />
              <span class="text-sm font-normal">Danger signs reviewed with patient</span>
            </label>
          </div>
          </div>

          <!-- Bottom nav -->
          <div class="flex justify-end">
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ── ASSESSMENT TAB ─────────────────────────────────────── -->
        <TabsContent v-if="canEditAssessment" value="assessment" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

          <!-- OB Exam -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">OB Examination</h3>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <!-- Fundal height -->
              <div class="flex flex-col gap-2">
                <Label for="ob-fh" class="text-xs text-muted-foreground">Fundal Height (cm)</Label>
                <Input
                  id="ob-fh"
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  placeholder="e.g. 28"
                  :model-value="localAssessment.ob_exam.fundal_height"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => localAssessment.ob_exam.fundal_height = String(v)"
                  @blur="saveAssessment"
                />
                <p v-if="fhBadge" class="text-[10px] font-medium" :class="fhBadge.class">
                  {{ fhBadge.text }}
                </p>
              </div>

              <!-- FHR -->
              <div class="flex flex-col gap-2">
                <Label for="ob-fhr" class="text-xs text-muted-foreground">Fetal Heart Rate (bpm)</Label>
                <Input
                  id="ob-fhr"
                  type="number"
                  placeholder="e.g. 140"
                  :model-value="localAssessment.ob_exam.fetal_heart_rate"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => localAssessment.ob_exam.fetal_heart_rate = String(v)"
                  @blur="saveAssessment"
                />
                <p v-if="fhrAlert" class="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertTriangle class="size-3.5" />
                  FHR outside normal range (110–160 bpm)
                </p>
              </div>

              <!-- FHR method -->
              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">FHR Method</Label>
                <Select
                  :model-value="localAssessment.ob_exam.fhr_method || undefined"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => { localAssessment.ob_exam.fhr_method = v ?? ''; saveAssessment() }"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doppler">Doppler</SelectItem>
                    <SelectItem value="fetoscope">Fetoscope</SelectItem>
                    <SelectItem value="ctg">CTG</SelectItem>
                  </SelectContent>
                </Select>
                <p v-if="fhrMethodMissing" class="text-[10px] text-amber-600 dark:text-amber-400">
                  Please select the method used to measure FHR
                </p>
              </div>

              <!-- Fetal presentation (>= 34 weeks) -->
              <div v-if="showFetalPresentation" class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">Fetal Presentation</Label>
                <Select
                  :model-value="localAssessment.ob_exam.fetal_presentation || undefined"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => { localAssessment.ob_exam.fetal_presentation = v ?? ''; saveAssessment() }"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select presentation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cephalic">Cephalic</SelectItem>
                    <SelectItem value="breech">Breech</SelectItem>
                    <SelectItem value="transverse">Transverse</SelectItem>
                    <SelectItem value="oblique">Oblique</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Edema -->
              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">Edema</Label>
                <Select
                  :model-value="localAssessment.ob_exam.edema || undefined"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => { localAssessment.ob_exam.edema = v ?? ''; if (v === 'none') { localAssessment.ob_exam.edema_location = [] } saveAssessment() }"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="trace">Trace (+)</SelectItem>
                    <SelectItem value="mild">Mild (++)</SelectItem>
                    <SelectItem value="moderate">Moderate (+++)</SelectItem>
                    <SelectItem value="severe">Severe (++++)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <!-- Edema location (shown when edema is not none) -->
            <div v-if="localAssessment.ob_exam.edema && localAssessment.ob_exam.edema !== 'none'" class="flex flex-col gap-2">
              <Label class="text-xs text-muted-foreground">Edema Location</Label>
              <div class="flex flex-wrap gap-3">
                <div v-for="loc in [
                  { key: 'lower_extremities', label: 'Lower extremities' },
                  { key: 'upper_extremities', label: 'Upper extremities' },
                  { key: 'face', label: 'Face' },
                  { key: 'generalized', label: 'Generalized' },
                ]" :key="loc.key" class="flex items-center gap-1.5">
                  <Checkbox
                    :id="`edema-${loc.key}`"
                    :model-value="localAssessment.ob_exam.edema_location.includes(loc.key)"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => {
                      const arr = [...localAssessment.ob_exam.edema_location]
                      if (v) { arr.push(loc.key) } else { arr.splice(arr.indexOf(loc.key), 1) }
                      localAssessment.ob_exam.edema_location = arr
                      saveAssessment()
                    }"
                  />
                  <Label :for="`edema-${loc.key}`" class="cursor-pointer text-xs font-normal" :class="loc.key === 'face' || loc.key === 'generalized' ? 'text-destructive' : ''">
                    {{ loc.label }}
                  </Label>
                </div>
              </div>
              <p v-if="localAssessment.ob_exam.edema_location.includes('face') || localAssessment.ob_exam.edema_location.includes('generalized')" class="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle class="size-3.5" />
                Facial/generalized edema — evaluate for preeclampsia
              </p>
            </div>
          </div>

          <!-- Cervical exam (collapsible, >= 38 weeks) -->
          <div v-if="showCervical">
          <Collapsible
            v-model:open="cervicalOpen"
            class="rounded-md border"
          >
            <CollapsibleTrigger
              class="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
            >
              Cervical Examination
              <ChevronsUpDown class="size-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="grid grid-cols-1 gap-4 border-t px-4 pb-4 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                <div class="flex flex-col gap-2">
                  <Label for="cx-dilation" class="text-xs text-muted-foreground">Dilation (cm)</Label>
                  <Input
                    id="cx-dilation"
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    placeholder="0–10"
                    :model-value="localAssessment.cervical.cervical_dilation"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => localAssessment.cervical.cervical_dilation = String(v)"
                    @blur="saveAssessment"
                  />
                </div>
                <div class="flex flex-col gap-2">
                  <Label for="cx-effacement" class="text-xs text-muted-foreground">Effacement (%)</Label>
                  <Input
                    id="cx-effacement"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0–100"
                    :model-value="localAssessment.cervical.cervical_effacement"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => localAssessment.cervical.cervical_effacement = String(v)"
                    @blur="saveAssessment"
                  />
                </div>
                <div class="flex flex-col gap-2">
                  <Label class="text-xs text-muted-foreground">Consistency</Label>
                  <Select
                    :model-value="localAssessment.cervical.cervical_consistency || undefined"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localAssessment.cervical.cervical_consistency = v ?? ''; saveAssessment() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="firm">Firm</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="soft">Soft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-2">
                  <Label class="text-xs text-muted-foreground">Position</Label>
                  <Select
                    :model-value="localAssessment.cervical.cervical_position || undefined"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localAssessment.cervical.cervical_position = v ?? ''; saveAssessment() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="posterior">Posterior</SelectItem>
                      <SelectItem value="mid">Mid</SelectItem>
                      <SelectItem value="anterior">Anterior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-2">
                  <Label for="cx-station" class="text-xs text-muted-foreground">Station</Label>
                  <Input
                    id="cx-station"
                    type="number"
                    min="-5"
                    max="5"
                    placeholder="-5 to +5"
                    :model-value="localAssessment.cervical.fetal_station"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => localAssessment.cervical.fetal_station = String(v)"
                    @blur="saveAssessment"
                  />
                </div>
                <div class="flex flex-col gap-2">
                  <Label class="text-xs text-muted-foreground">Bishop Score (auto)</Label>
                  <div class="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-semibold tabular-nums">
                    {{ bishopScoreComputed !== null ? bishopScoreComputed : '—' }}
                    <span v-if="bishopScoreComputed !== null" class="ml-1.5 text-xs font-normal text-muted-foreground">/ 13</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          </div>

          <!-- Ultrasound section (collapsible, collapsed by default) -->
          <div>
          <Collapsible
            v-model:open="ultrasoundOpen"
            class="rounded-md border"
          >
            <CollapsibleTrigger
              class="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
            >
              Ultrasound
              <ChevronsUpDown class="size-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
            <div class="flex flex-col gap-4 border-t px-4 pb-4 pt-3">

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">Type</Label>
                <Select
                  :model-value="localAssessment.ultrasound.type || undefined"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => { localAssessment.ultrasound.type = v ?? ''; saveAssessment() }"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transabdominal">Transabdominal</SelectItem>
                    <SelectItem value="transvaginal">Transvaginal</SelectItem>
                    <SelectItem value="anatomy_scan">Anatomy Scan</SelectItem>
                    <SelectItem value="growth_scan">Growth Scan</SelectItem>
                    <SelectItem value="biophysical_profile">Biophysical Profile</SelectItem>
                    <SelectItem value="doppler">Doppler</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">Date</Label>
                <MFDatePicker
                  :model-value="localAssessment.ultrasound.date"
                  :disabled="store.isFinalized"
                  disable-future
                  placeholder="Select date"
                  @update:model-value="(v) => { localAssessment.ultrasound.date = v ?? ''; computeEddFromGA(); saveAssessment() }"
                />
              </div>

              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">GA from Ultrasound</Label>
                <div class="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="44"
                    placeholder="Weeks"
                    :model-value="localAssessment.ultrasound.ga_weeks"
                    :disabled="store.isFinalized"
                    class="w-28"
                    @update:model-value="(v) => localAssessment.ultrasound.ga_weeks = String(v)"
                    @blur="() => { const n = Number(localAssessment.ultrasound.ga_weeks); if (n > 44) localAssessment.ultrasound.ga_weeks = '44'; if (n < 0) localAssessment.ultrasound.ga_weeks = '0'; computeEddFromGA(); saveAssessment() }"
                  />
                  <span class="text-xs text-muted-foreground">wk</span>
                  <Input
                    type="number"
                    min="0"
                    max="6"
                    placeholder="Days"
                    :model-value="localAssessment.ultrasound.ga_days"
                    :disabled="store.isFinalized"
                    class="w-24"
                    @update:model-value="(v) => localAssessment.ultrasound.ga_days = String(v)"
                    @blur="() => { const n = Number(localAssessment.ultrasound.ga_days); if (n > 6) localAssessment.ultrasound.ga_days = '6'; if (n < 0) localAssessment.ultrasound.ga_days = '0'; computeEddFromGA(); saveAssessment() }"
                  />
                  <span class="text-xs text-muted-foreground">d</span>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <Label class="text-xs text-muted-foreground">EDD from Ultrasound</Label>
                <MFDatePicker
                  :model-value="localAssessment.ultrasound.edd"
                  :disabled="store.isFinalized"
                  :min-date="computedUtzEdd ? new Date(new Date(computedUtzEdd).getTime() - 14 * 86400000).toISOString().slice(0, 10) : undefined"
                  :max-date="computedUtzEdd ? new Date(new Date(computedUtzEdd).getTime() + 14 * 86400000).toISOString().slice(0, 10) : undefined"
                  placeholder="Auto from GA"
                  @update:model-value="(v) => { localAssessment.ultrasound.edd = v ?? ''; computeGAFromEdd(); saveAssessment() }"
                />
                <p v-if="computedUtzEdd && localAssessment.ultrasound.edd && computedUtzEdd !== localAssessment.ultrasound.edd" class="text-[10px] text-amber-600 dark:text-amber-400">
                  Manually adjusted from computed {{ new Date(computedUtzEdd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                </p>
              </div>
            </div>

            <!-- EDD comparison + adopt action -->
            <div v-if="eddDiffers && eddComparison && !store.isFinalized" class="flex flex-col gap-2">
              <!-- Adopt button -->
              <div v-if="!eddDeclined" class="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-700 dark:bg-amber-950">
                <div class="text-xs">
                  <p class="font-medium text-amber-800 dark:text-amber-300">Ultrasound EDD differs from current EDD by {{ eddComparison.diffDays }} days</p>
                  <p class="mt-0.5 text-amber-700 dark:text-amber-400">Current: {{ eddComparison.currentEdd }} ({{ eddComparison.currentGA }}) → Ultrasound: {{ eddComparison.newEdd }} ({{ eddComparison.newGA }})</p>
                </div>
                <Button size="sm" variant="outline" class="shrink-0 text-xs" @click="showEddAdoptModal = true">
                  Adopt EDD
                </Button>
              </div>
              <!-- Declined message -->
              <div v-else class="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span class="font-medium">EDD difference noted:</span>
                Current EDD {{ eddComparison.currentEdd }} ({{ eddComparison.currentGA }}) differs from ultrasound EDD {{ eddComparison.newEdd }} ({{ eddComparison.newGA }}) by {{ eddComparison.diffDays }} days.
                <button type="button" class="ml-1 font-medium text-primary underline" @click="showEddAdoptModal = true">Review again</button>
              </div>
            </div>
            <!-- Same EDD or read-only -->
            <div
              v-else-if="store.current.prenatal_visit && localAssessment.ultrasound.edd && !eddDiffers"
              class="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950 dark:text-green-400"
            >
              Ultrasound EDD matches current pregnancy EDD.
            </div>

            <!-- Findings -->
            <div class="flex flex-col gap-2">
              <Label for="utz-findings" class="text-xs text-muted-foreground">Findings</Label>
              <Textarea
                id="utz-findings"
                :model-value="localAssessment.ultrasound.findings"
                placeholder="Ultrasound findings..."
                :disabled="store.isFinalized"
                :rows="3"
                @update:model-value="(v) => localAssessment.ultrasound.findings = String(v)"
                @blur="saveAssessment"
              />
            </div>
          </div>
            </CollapsibleContent>
          </Collapsible>
          </div>

          <!-- Pregnancy progress + risk level -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pregnancy Status</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label class="text-xs text-muted-foreground">Pregnancy Progress</Label>
              <Select
                :model-value="localAssessment.pregnancy_progress || undefined"
                :disabled="store.isFinalized"
                @update:model-value="(v) => { localAssessment.pregnancy_progress = v ?? ''; saveAssessment() }"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select progress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="concerning">Concerning</SelectItem>
                  <SelectItem value="complication">Complication</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex flex-col gap-2">
              <Label class="text-xs text-muted-foreground">Risk Level</Label>
              <Select
                :model-value="localAssessment.risk_level_update || undefined"
                :disabled="store.isFinalized"
                @update:model-value="(v) => { localAssessment.risk_level_update = v ?? ''; saveAssessment() }"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select risk level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Badge
                v-if="localAssessment.risk_level_update"
                variant="outline"
                class="w-fit"
                :class="riskBadgeClass"
              >
                {{ localAssessment.risk_level_update.charAt(0).toUpperCase() + localAssessment.risk_level_update.slice(1) }} Risk
              </Badge>
            </div>
          </div>
          </div>

          <!-- Diagnoses -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Diagnoses</h3>

            <!-- Selected diagnoses -->
            <div v-if="localAssessment.diagnoses.length > 0" class="flex flex-wrap gap-2">
              <Badge
                v-for="(dx, idx) in localAssessment.diagnoses"
                :key="idx"
                variant="secondary"
                class="flex items-center gap-1.5 py-1 pl-2.5 pr-1.5"
              >
                <span class="text-sm">
                  {{ dx.description }}
                  <span v-if="dx.code" class="ml-1 font-mono text-xs text-muted-foreground">
                    {{ dx.code }}
                  </span>
                </span>
                <Button
                  v-if="!store.isFinalized"
                  variant="ghost"
                  size="icon"
                  class="size-4 rounded-full hover:bg-destructive/20"
                  @click="removeDiagnosis(idx)"
                >
                  <X class="size-3" />
                </Button>
              </Badge>
            </div>

            <!-- Diagnosis search -->
            <div v-if="!store.isFinalized" class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search class="size-3.5 text-muted-foreground" />
              </div>
              <Input
                :model-value="diagnosisQuery"
                placeholder="Search ICD-10 codes or type a custom diagnosis..."
                class="pl-9"
                @update:model-value="onDiagnosisInput"
                @keydown="onDiagnosisKeydown"
                @blur="onDiagnosisBlur"
              />
              <div
                v-if="showDiagnosisDropdown"
                class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
              >
                <button
                  v-for="(result, rIdx) in diagnosisResults"
                  :key="`${result.source}-${result.id}`"
                  :data-dx-highlighted="rIdx === diagnosisHighlight"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  :class="rIdx === diagnosisHighlight ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
                  @mousedown.prevent="selectDiagnosis(result)"
                  @mouseenter="diagnosisHighlight = rIdx"
                >
                  <Badge variant="outline" class="shrink-0 text-[10px]">
                    {{ result.source === 'icd' ? 'ICD' : 'Custom' }}
                  </Badge>
                  <span class="truncate">{{ result.description }}</span>
                  <span v-if="result.code" class="shrink-0 font-mono text-xs text-muted-foreground">
                    {{ result.code }}
                  </span>
                </button>
              </div>
            </div>
            <p v-if="!store.isFinalized" class="text-xs text-muted-foreground">
              Type to search or press Enter to add a custom diagnosis
            </p>
          </div>

          <!-- Notes -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assessment Notes</h3>
            <Textarea
              id="assessment-notes"
              :model-value="localAssessment.notes"
              placeholder="Additional assessment notes..."
              :disabled="store.isFinalized"
              :rows="4"
              @update:model-value="(v) => localAssessment.notes = String(v)"
              @blur="saveAssessment"
            />
          </div>

          <!-- Bottom nav -->
          <div class="flex justify-between">
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

        <!-- ── PLAN TAB ───────────────────────────────────────────── -->
        <TabsContent value="plan" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

          <!-- ── PRESCRIPTIONS ─────────────────────────────────────── -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prescriptions</h3>
            <PrescriptionSection
              :consultation-id="store.current.id"
              :disabled="store.isFinalized || !canEditPlan || !authStore.hasPermission('prescriptions.create')"
              :realtime-update="prescriptionUpdate"
              :document-update="documentUpdate"
            />
          </div>

          <!-- ── PROCEDURES ────────────────────────────────────────── -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Procedures</h3>
            <div
              v-if="dueReminders?.procedures?.length"
              class="flex items-start gap-2 rounded-md border border-purple-200 bg-purple-50 px-3 py-2 dark:border-purple-800 dark:bg-purple-950"
            >
              <ClipboardList class="mt-0.5 size-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
              <div class="text-xs">
                <span class="font-medium text-purple-800 dark:text-purple-300">Due procedures:</span>
                <span class="ml-1 text-purple-700 dark:text-purple-400">
                  {{ dueReminders.procedures.map(r => r.name).join(', ') }}
                </span>
              </div>
            </div>
            <ProcedureSection
              :encounter-id="store.current.id"
              :procedures="store.current.procedures ?? []"
              :disabled="store.isFinalized || !canEditPlan"
              @update="(p) => { if (store.current) store.current.procedures = p }"
            />
          </div>

          <!-- ── LAB ORDERS ────────────────────────────────────────── -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lab Orders</h3>
            <div
              v-if="dueReminders?.labs?.length"
              class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950"
            >
              <FlaskConical class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div class="text-xs">
                <span class="font-medium text-amber-800 dark:text-amber-300">Due lab orders:</span>
                <span class="ml-1 text-amber-700 dark:text-amber-400">
                  {{ dueReminders.labs.map(r => r.name).join(', ') }}
                </span>
              </div>
            </div>
            <LabOrderSection
              :consultation-id="store.current.id"
              :disabled="store.isFinalized || !canEditPlan || !authStore.hasPermission('lab-orders.create') || !authStore.hasFeature('lab_orders')"
              :realtime-update="labOrderUpdate"
              :document-update="documentUpdate"
              @lab-updated="store.loadEncounter(store.current!.id)"
            />
          </div>

          <!-- ── CONSUMABLES ───────────────────────────────────────── -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Consumables</h3>
            <ConsumableSection
              :consultation-id="store.current.id"
              :consumables="store.current.consumables ?? []"
              :disabled="store.isFinalized || !canEditPlan"
              @update="(c) => { if (store.current) store.current.consumables = c }"
            />
          </div>

          <!-- ── FOLLOW-UP ─────────────────────────────────────────── -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Follow-Up</h3>
            <p class="text-xs text-muted-foreground">{{ suggestedVisitInterval }}</p>

            <!-- Booked state -->
            <div
              v-if="followUpBooked && followUpSelectedDate"
              class="flex items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3 dark:border-green-700 dark:bg-green-950"
            >
              <CheckCircle2 class="size-5 shrink-0 text-green-600 dark:text-green-400" />
              <div class="flex-1">
                <p class="text-sm font-medium text-green-800 dark:text-green-300">Follow-up booked</p>
                <p class="text-xs text-green-700 dark:text-green-400">
                  {{ followUpDisplay }}
                  <span v-if="followUpSelectedSlot"> at {{ formatSlotTime(followUpSelectedSlot) }}</span>
                </p>
              </div>
              <Button
                v-if="!store.isFinalized && canEditPlan"
                variant="ghost"
                size="icon"
                class="size-7 text-green-700 hover:text-destructive dark:text-green-400"
                @click="clearFollowUp"
              >
                <X class="size-4" />
              </Button>
            </div>

            <!-- Date + slot picker -->
            <template v-else-if="!store.isFinalized && canEditPlan">
              <div class="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      class="w-[240px] justify-start text-left font-normal"
                      :class="{ 'text-muted-foreground': !followUpSelectedDate }"
                    >
                      <CalendarDays class="mr-2 size-4" />
                      {{ followUpSelectedDate ? new Date(followUpSelectedDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Select a date' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <Calendar
                      :model-value="followUpCalendarValue"
                      :min-value="minFollowUpDate"
                      :is-date-unavailable="isDateUnavailable"
                      @update:model-value="onFollowUpDateSelect"
                    />
                  </PopoverContent>
                </Popover>
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

              <!-- Recommendation: available — one-click button -->
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
            </template>

            <!-- Read-only display -->
            <p v-else-if="localPlan.next_visit_date" class="text-sm">
              {{ new Date(localPlan.next_visit_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) }}
            </p>
            <p v-else class="text-sm text-muted-foreground">No follow-up scheduled</p>
          </div>

          <!-- ── COUNSELING & EDUCATION ─────────────────────────────── -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Counseling & Education</h3>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label
                v-for="opt in COUNSELING_OPTIONS"
                :key="opt.key"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="localPlan.counseling_provided.includes(opt.key)"
                  :disabled="store.isFinalized || !canEditPlan"
                  class="peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs accent-primary"
                  @change="toggleCounseling(opt.key); savePlan()"
                />
                <span class="text-sm font-normal">{{ opt.label }}</span>
              </label>
            </div>

            <!-- Birth plan (trimester 3 only) -->
            <label v-if="isTrimester3" class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="localPlan.birth_plan_discussed"
                :disabled="store.isFinalized || !canEditPlan"
                class="peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs accent-primary"
                @change="localPlan.birth_plan_discussed = !localPlan.birth_plan_discussed; savePlan()"
              />
              <span class="text-sm font-normal">Birth plan discussed with patient</span>
            </label>
          </div>

          <!-- ── PLAN NOTES ────────────────────────────────────────── -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Plan Notes</h3>
            <Textarea
              id="plan-notes"
              :model-value="localPlan.notes"
              placeholder="Additional plan notes..."
              :disabled="store.isFinalized || !canEditPlan"
              :rows="3"
              @update:model-value="(v) => localPlan.notes = String(v)"
              @blur="savePlan"
            />
          </div>

          <!-- ── PRENATAL CARE CHECKLIST ────────────────────────────── -->
          <div v-if="store.current.pregnancy_id" class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prenatal Care Checklist</h3>
            <PrenatalCareChecklist
              :patient-id="store.current.patient_id"
              :pregnancy-id="store.current.pregnancy_id"
              :disabled="store.isFinalized || !canEditPlan"
            />
          </div>

          <!-- Bottom nav -->
          <div class="flex items-center justify-between">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
            <div class="flex items-center gap-2">
              <Button
                v-if="store.isDraft && canFinalize"
                :disabled="store.isSaving"
                @click="showFinalizeModal = true"
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

        <!-- ── BILLING TAB ────────────────────────────────────────── -->
        <TabsContent value="billing" class="mt-0 flex flex-col gap-5 px-0 md:px-8">
          <PaymentTab
            :disabled="store.isFinalized"
            :consultation-id="store.current.id"
            :status="store.current.status"
            :consultation-type="'default'"
            :patient-id="store.current.patient_id"
            :diagnoses="store.current.prenatal_visit?.assessment?.diagnoses ?? []"
            :document-update="documentUpdate"
            :consumables="store.current.consumables ?? []"
            :procedures="store.current.procedures ?? []"
            :prescription-summary="store.current.prescription_summary"
            :lab-order-summary="store.current.lab_order_summary"
            :payment="store.current.payment"
            :can-finalize="store.isDraft && canFinalize"
            :is-saving="store.isSaving"
            @update:payment="(p) => { if (store.current) store.current.payment = p }"
            @finalize="showFinalizeModal = true"
          />
          <div class="mt-5 flex justify-start">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
          </div>
        </TabsContent>

        </div>

        <!-- Right: Pregnancy Summary Sidebar (1/3) -->
        <aside class="hidden min-h-0 overflow-y-auto border-l px-4 pb-4 pt-0 lg:block lg:w-1/4">
          <div class="flex flex-col gap-3">
            <!-- Patient Card + GA Timeline (same as dashboard) -->
            <div v-if="patientData" class="flex flex-col gap-4 rounded-xl border bg-card p-4">
              <div class="flex items-center gap-3">
                <div class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-semibold text-white">
                  <img v-if="patientData.avatar_url" :src="patientData.avatar_url" :alt="patientData.full_name" class="size-full object-cover" />
                  <template v-else>{{ patientData.first_name.charAt(0) }}{{ patientData.last_name.charAt(0) }}</template>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold leading-tight">{{ patientData.full_name }}</p>
                  <div class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span v-if="patientAge !== null">{{ patientAge }} yrs old</span>
                    <span v-if="patientData.sex">&middot; {{ patientData.sex === 'female' ? 'Female' : patientData.sex }}</span>
                    <span v-if="patientData.blood_type">&middot; {{ patientData.blood_type }}</span>
                  </div>
                </div>
              </div>
              <!-- Blood type prompt if missing -->
              <p v-if="!patientData?.blood_type" class="rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                Blood type not recorded — update patient profile
              </p>

              <!-- GA Timeline Ruler -->
              <div v-if="gaWeeks !== null" class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{{ trimesterLabel }}</span>
                  <span class="font-medium text-foreground">{{ gaWeeks }}w {{ gaDays }}d</span>
                </div>
                <div class="relative mt-1 mb-2">
                  <div class="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div class="absolute left-[33.3%] top-0 h-3 w-px bg-border/50 z-10" />
                    <div class="absolute left-[66.6%] top-0 h-3 w-px bg-border/50 z-10" />
                    <div
                      class="absolute inset-y-0 left-0 h-3 rounded-full transition-all duration-1000 ease-out"
                      :style="{ width: `${Math.min(100, ((gaWeeks + (gaDays ?? 0) / 7) / 42) * 100)}%`, background: 'linear-gradient(90deg, #a78bfa, #ec4899, #f97316, #eab308, #22c55e, #06b6d4)' }"
                    />
                  </div>
                  <div
                    class="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-1000 ease-out"
                    :style="{ left: `${Math.min(100, ((gaWeeks + (gaDays ?? 0) / 7) / 42) * 100)}%` }"
                  >
                    <span class="-ml-2 text-sm">👶</span>
                  </div>
                </div>
                <div class="flex items-center justify-between text-[8px] text-muted-foreground/50">
                  <span>0w</span>
                  <span>13w</span>
                  <span>27w</span>
                  <span>40w</span>
                </div>
              </div>
            </div>

            <!-- Summary Cards (same as dashboard, stacked) -->
            <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-sm">
                <Baby class="size-4" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Obstetric Hx</p>
                <p v-if="gpal" class="font-mono text-lg font-bold">{{ gpal }}</p>
                <p v-else class="text-sm text-muted-foreground">—</p>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
                <CalendarDays class="size-4" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">EDD</p>
                <p class="text-lg font-bold">{{ formatEdd() }}</p>
                <p v-if="gaWeeks !== null && (40 - gaWeeks) > 0" class="text-[10px] text-muted-foreground">{{ 40 - gaWeeks }}w remaining</p>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
              <div
                class="flex size-7 shrink-0 items-center justify-center rounded-md text-white shadow-sm"
                :class="pregnancyRiskLevel === 'high' ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-emerald-500 to-green-500'"
              >
                <AlertTriangle class="size-4" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Risk</p>
                <p class="text-sm font-bold" :class="pregnancyRiskLevel === 'high' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                  {{ pregnancyRiskLevel === 'high' ? 'High Risk' : 'Low Risk' }}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-sm">
                <ClipboardList class="size-4" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Visit</p>
                <p class="text-lg font-bold tabular-nums">#{{ visitNumber ?? '—' }}</p>
              </div>
            </div>

            <!-- Clinical Summary -->
            <div class="rounded-xl border bg-card p-4">
              <div class="flex items-start gap-3">
                <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-sm">
                  <FileText class="size-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Clinical Summary</p>
                  <p v-if="clinicalSummary" class="mt-1 text-xs leading-relaxed text-muted-foreground [&_b]:text-foreground [&_b]:font-semibold" v-html="clinicalSummary" />
                  <p v-else class="mt-1 text-xs text-muted-foreground/50 italic">No data recorded yet.</p>
                </div>
              </div>
            </div>

            <!-- Previous Visit Comparison -->
            <div v-if="previousVisitData" class="rounded-xl border bg-card p-4">
              <p class="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last Visit</p>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div class="text-muted-foreground">Date</div>
                <div class="font-medium">{{ previousVisitData.date }}</div>
                <div class="text-muted-foreground">GA</div>
                <div class="font-mono font-medium">{{ previousVisitData.ga }}</div>
                <template v-if="previousVisitData.bp">
                  <div class="text-muted-foreground">BP</div>
                  <div class="font-mono font-medium">{{ previousVisitData.bp }}</div>
                </template>
                <template v-if="previousVisitData.weight">
                  <div class="text-muted-foreground">Weight</div>
                  <div class="font-medium">{{ previousVisitData.weight }}</div>
                </template>
                <template v-if="previousVisitData.fhr">
                  <div class="text-muted-foreground">FHR</div>
                  <div class="font-medium">{{ previousVisitData.fhr }}</div>
                </template>
                <template v-if="previousVisitData.fh">
                  <div class="text-muted-foreground">FH</div>
                  <div class="font-medium">{{ previousVisitData.fh }}</div>
                </template>
              </div>
            </div>

            <!-- Trend Sparklines -->
            <div v-if="bpSparkline || fhrSparkline" class="flex flex-col gap-3">
              <div v-if="bpSparkline" class="rounded-xl border bg-card p-3">
                <p class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">BP Trend</p>
                <VChart :option="bpSparkline" style="height: 48px; width: 100%" autoresize />
              </div>
              <div v-if="fhrSparkline" class="rounded-xl border bg-card p-3">
                <p class="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">FHR Trend</p>
                <VChart :option="fhrSparkline" style="height: 48px; width: 100%" autoresize />
              </div>
            </div>

            <!-- Danger signs alert -->
            <div
              v-if="localTriage.danger_signs.length > 0"
              class="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
            >
              <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertTriangle class="size-3.5" />
                Danger Signs ({{ localTriage.danger_signs.length }})
              </p>
              <div class="flex flex-wrap gap-1">
                <Badge
                  v-for="sign in localTriage.danger_signs"
                  :key="sign"
                  variant="destructive"
                  class="text-[10px] capitalize"
                >
                  {{ sign.replace(/_/g, ' ') }}
                </Badge>
              </div>
            </div>
          </div>
        </aside>
    </div>

    <!-- EDD Adoption Modal -->
    <Dialog :open="showEddAdoptModal" @update:open="showEddAdoptModal = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Pregnancy EDD?</DialogTitle>
          <DialogDescription>
            The ultrasound estimated delivery date differs from the current pregnancy EDD. Adopting the ultrasound EDD will change the gestational age calculation for this pregnancy going forward.
          </DialogDescription>
        </DialogHeader>

        <div v-if="eddComparison" class="flex flex-col gap-4">
          <!-- Comparison table -->
          <div class="grid grid-cols-3 gap-2 rounded-md border p-3 text-sm">
            <div />
            <div class="text-center font-semibold text-muted-foreground">Current</div>
            <div class="text-center font-semibold text-primary">Ultrasound</div>

            <div class="text-muted-foreground">EDD</div>
            <div class="text-center font-medium">{{ eddComparison.currentEdd }}</div>
            <div class="text-center font-medium text-primary">{{ eddComparison.newEdd }}</div>

            <div class="text-muted-foreground">GA Today</div>
            <div class="text-center font-mono font-medium">{{ eddComparison.currentGA }}</div>
            <div class="text-center font-mono font-medium text-primary">{{ eddComparison.newGA }}</div>

            <div class="text-muted-foreground">Difference</div>
            <div class="col-span-2 text-center font-medium text-amber-600 dark:text-amber-400">{{ eddComparison.diffDays }} days</div>
          </div>

          <!-- What changes -->
          <div class="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            <p class="mb-1 font-semibold text-foreground">What will change:</p>
            <ul class="list-inside list-disc space-y-0.5">
              <li>Pregnancy EDD will update to {{ eddComparison.newEdd }}</li>
              <li>EDD source will change to "Ultrasound"</li>
              <li>Gestational age will recalculate to {{ eddComparison.newGA }}</li>
              <li>Future visits will use the new EDD for GA computation</li>
              <li>Previous visits retain their original GA (snapshot at time of visit)</li>
            </ul>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="declineEddAdoption">
            Keep Current EDD
          </Button>
          <Button :disabled="isUpdatingEdd" @click="adoptUltrasoundEdd">
            <LoaderCircle v-if="isUpdatingEdd" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ isUpdatingEdd ? 'Updating...' : 'Adopt Ultrasound EDD' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Finalize confirmation dialog -->
    <Dialog :open="showFinalizeModal" @update:open="showFinalizeModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <CheckCircle2 class="size-5 text-primary" />
            Finalize Encounter
          </DialogTitle>
          <DialogDescription>
            This will lock the prenatal encounter record. No further edits will be possible after finalization.
            Are you sure you want to proceed?
          </DialogDescription>
        </DialogHeader>
        <div v-if="finalizeMissingItems.length > 0" class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950">
          <p class="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-300">Missing data:</p>
          <ul class="list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
            <li v-for="item in finalizeMissingItems" :key="item">{{ item }}</li>
          </ul>
        </div>
        <p v-if="store.saveError" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ store.saveError }}
        </p>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showFinalizeModal = false">
            Cancel
          </Button>
          <Button :disabled="store.isSaving" @click="handleFinalizeConfirm">
            <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ store.isSaving ? 'Finalizing...' : 'Confirm Finalize' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </Tabs>
</template>
