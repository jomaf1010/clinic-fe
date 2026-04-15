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
import DangerSignsChecklist from '../components/DangerSignsChecklist.vue'
import { obgynApi } from '../api/obgynApi'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { PatientResponse } from '@/domains/patient/types/patient.types'
import type { DueReminders, GynProfile, Pregnancy as PregnancyType } from '../types/obgyn.types'
import { useClinicalSummary } from '../composables/useClinicalSummary'

// ── Router / stores ─────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
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
const pregnancyEdd = ref<string | null>(null)
const pregnancyRiskLevel = ref<string | null>(null)
const patientData = ref<PatientResponse | null>(null)
const gynProfile = ref<GynProfile | null>(null)

async function loadPregnancySummary() {
  const enc = store.current
  if (!enc?.patient_id) return

  const fetches: Promise<void>[] = []

  if (enc.pregnancy_id) {
    fetches.push(
      obgynApi.getPregnancy(enc.patient_id, enc.pregnancy_id).then((res) => {
        pregnancyEdd.value = res.data.edd
        pregnancyRiskLevel.value = res.data.risk_level
      }).catch(() => {}),
    )
  }

  fetches.push(
    patientApi.get(enc.patient_id).then((res) => {
      patientData.value = res.data
    }).catch(() => {}),
  )

  fetches.push(
    obgynApi.getGynProfile(enc.patient_id).then((res) => {
      gynProfile.value = res.data
    }).catch(() => {}),
  )

  await Promise.all(fetches)
}

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
  return `G${g}P${t}${pt}A${a}L${l}`
})

const activePregnancyRef = computed<PregnancyType | null>(() => {
  if (!pregnancyEdd.value) return null
  return {
    edd: pregnancyEdd.value,
    risk_level: pregnancyRiskLevel.value as 'low' | 'high' | null,
    current_ga: gaWeeks !== null ? { weeks: gaWeeks, days: gaDays ?? 0, trimester: trimester.value ?? '' } : null,
  } as PregnancyType
})

const { clinicalSummary } = useClinicalSummary(gynProfile, activePregnancyRef, gpal)

const patientAge = computed(() => {
  if (!patientData.value?.date_of_birth) return null
  const dob = new Date(patientData.value.date_of_birth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
})

// ── Plan tab reminders ──────────────────────────────────────────────
const dueReminders = ref<DueReminders | null>(null)

async function loadReminders() {
  const enc = store.current
  if (!enc?.pregnancy_id || !enc.patient_id) return
  try {
    const res = await obgynApi.getReminders(enc.patient_id, enc.pregnancy_id)
    dueReminders.value = res.data
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
  vitals: {
    bp_systolic: string
    bp_diastolic: string
    heart_rate: string
    respiratory_rate: string
    temperature: string
    weight: string
  }
}

function emptyTriage(): LocalTriage {
  return {
    concerns: '',
    fetal_movement: '',
    danger_signs: [],
    danger_signs_reviewed: false,
    vitals: {
      bp_systolic: '',
      bp_diastolic: '',
      heart_rate: '',
      respiratory_rate: '',
      temperature: '',
      weight: '',
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
  localTriage.vitals.bp_systolic = t.vitals?.bp_systolic !== null && t.vitals?.bp_systolic !== undefined ? String(t.vitals.bp_systolic) : ''
  localTriage.vitals.bp_diastolic = t.vitals?.bp_diastolic !== null && t.vitals?.bp_diastolic !== undefined ? String(t.vitals.bp_diastolic) : ''
  localTriage.vitals.heart_rate = t.vitals?.heart_rate !== null && t.vitals?.heart_rate !== undefined ? String(t.vitals.heart_rate) : ''
  localTriage.vitals.respiratory_rate = t.vitals?.respiratory_rate !== null && t.vitals?.respiratory_rate !== undefined ? String(t.vitals.respiratory_rate) : ''
  localTriage.vitals.temperature = t.vitals?.temperature !== null && t.vitals?.temperature !== undefined ? String(t.vitals.temperature) : ''
  localTriage.vitals.weight = t.vitals?.weight !== null && t.vitals?.weight !== undefined ? String(t.vitals.weight) : ''
}

const bpAlert = computed(() => {
  const sys = Number(localTriage.vitals.bp_systolic)
  const dia = Number(localTriage.vitals.bp_diastolic)
  if (!sys || !dia) return false
  return sys >= 140 || dia >= 90
})

const showFetalMovement = computed(() => (gaWeeks.value ?? 0) >= 20)

function buildTriagePayload(): PrenatalTriage {
  return {
    concerns: localTriage.concerns || null,
    fetal_movement: (localTriage.fetal_movement as PrenatalTriage['fetal_movement']) || null,
    kick_counts_performed: null,
    danger_signs: [...localTriage.danger_signs],
    danger_signs_reviewed: localTriage.danger_signs_reviewed,
    vitals: {
      bp_systolic: localTriage.vitals.bp_systolic ? Number(localTriage.vitals.bp_systolic) : null,
      bp_diastolic: localTriage.vitals.bp_diastolic ? Number(localTriage.vitals.bp_diastolic) : null,
      heart_rate: localTriage.vitals.heart_rate ? Number(localTriage.vitals.heart_rate) : null,
      respiratory_rate: localTriage.vitals.respiratory_rate ? Number(localTriage.vitals.respiratory_rate) : null,
      temperature: localTriage.vitals.temperature ? Number(localTriage.vitals.temperature) : null,
      weight: localTriage.vitals.weight ? Number(localTriage.vitals.weight) : null,
    },
  }
}

function saveTriage(): void {
  handleSave({ triage: buildTriagePayload() })
}

// ── Local assessment state ───────────────────────────────────────────
interface LocalAssessment {
  ob_exam: {
    fundal_height: string
    fetal_heart_rate: string
    fhr_method: string
    fetal_presentation: string
    edema: string
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

function syncAssessmentFromStore(): void {
  const a = store.current?.prenatal_visit?.assessment
  if (!a) return
  const o = a.ob_exam
  localAssessment.ob_exam.fundal_height = o.fundal_height !== null && o.fundal_height !== undefined ? String(o.fundal_height) : ''
  localAssessment.ob_exam.fetal_heart_rate = o.fetal_heart_rate !== null && o.fetal_heart_rate !== undefined ? String(o.fetal_heart_rate) : ''
  localAssessment.ob_exam.fhr_method = o.fhr_method ?? ''
  localAssessment.ob_exam.fetal_presentation = o.fetal_presentation ?? ''
  localAssessment.ob_exam.edema = o.edema ?? ''
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
  localAssessment.pregnancy_progress = a.pregnancy_progress ?? ''
  localAssessment.risk_level_update = a.risk_level_update ?? ''
  localAssessment.diagnoses = [...(a.diagnoses ?? [])]
  localAssessment.notes = a.notes ?? ''
}

const showFetalPresentation = computed(() => (gaWeeks.value ?? 0) >= 34)
const showCervical = computed(() => (gaWeeks.value ?? 0) >= 38)

const fhrAlert = computed(() => {
  const v = Number(localAssessment.ob_exam.fetal_heart_rate)
  if (!v) return false
  return v < 110 || v > 160
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
      fh_consistent_with_ga: null,
      fetal_heart_rate: localAssessment.ob_exam.fetal_heart_rate ? Number(localAssessment.ob_exam.fetal_heart_rate) : null,
      fhr_method: (localAssessment.ob_exam.fhr_method as PrenatalAssessment['ob_exam']['fhr_method']) || null,
      fetal_presentation: localAssessment.ob_exam.fetal_presentation || null,
      fetal_lie: null,
      engagement: null,
      leopolds_performed: null,
      edema: localAssessment.ob_exam.edema || null,
      edema_location: [],
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
      bishop_score: localAssessment.cervical.bishop_score ? Number(localAssessment.cervical.bishop_score) : null,
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
  referrals: string
  notes: string
}

function emptyPlan(): LocalPlan {
  return {
    next_visit_date: '',
    counseling_provided: [],
    birth_plan_discussed: false,
    referrals: '',
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
  localPlan.referrals = (p.referrals ?? []).join(', ')
  localPlan.notes = p.notes ?? ''
}

const isTrimester3 = computed(() => trimester.value === '3')

const suggestedVisitInterval = computed(() => {
  const w = gaWeeks.value ?? 0
  if (w >= 36) return 'Weekly visits recommended (36+ weeks)'
  if (w >= 28) return 'Bi-weekly visits recommended (28–36 weeks)'
  return 'Monthly visits recommended (< 28 weeks)'
})

const COUNSELING_OPTIONS = [
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'danger_signs', label: 'Danger Signs' },
  { key: 'breastfeeding', label: 'Breastfeeding' },
  { key: 'family_planning', label: 'Family Planning' },
  { key: 'birth_plan', label: 'Birth Plan' },
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
    referrals: localPlan.referrals ? localPlan.referrals.split(',').map((s) => s.trim()).filter(Boolean) : [],
    notes: localPlan.notes || null,
  }
}

function savePlan(): void {
  handleSave({ plan: buildPlanPayload() })
}

// ── Lifecycle ────────────────────────────────────────────────────────
onMounted(async () => {
  loadError.value = null
  try {
    const id = route.params.id
    await store.loadEncounter(typeof id === 'string' ? id : Array.isArray(id) ? (id[0] ?? '') : '')
    syncTriageFromStore()
    syncAssessmentFromStore()
    syncPlanFromStore()
    loadReminders()
    loadPregnancySummary()
    setupTabsObserver()
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
  () => { syncTriageFromStore() },
  { deep: true },
)
watch(
  () => store.current?.prenatal_visit?.assessment,
  () => { syncAssessmentFromStore() },
  { deep: true },
)
watch(
  () => store.current?.prenatal_visit?.plan,
  () => { syncPlanFromStore() },
  { deep: true },
)

// ── Save / finalize ──────────────────────────────────────────────────
async function handleSave(payload: UpdateEncounterPayload): Promise<void> {
  await store.saveSection(payload)
}

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
  plan: FlaskConical,
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

        <!-- Step tabs -->
        <div ref="tabsListRef" class="mb-5 py-3">
          <div class="relative mx-8">
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
        <TabsContent value="triage" class="mt-0 flex flex-col gap-6">

          <!-- GA context banner -->
          <div
            v-if="gaLabel"
            class="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-4 py-3 text-sm"
          >
            <Baby class="size-4 shrink-0 text-muted-foreground" />
            <span class="font-medium">
              {{ gaWeeks }} weeks{{ gaDays ? ` ${gaDays} days` : '' }}
            </span>
            <span v-if="trimesterLabel" class="text-muted-foreground">—</span>
            <span v-if="trimesterLabel" class="text-muted-foreground">{{ trimesterLabel }}</span>
            <span v-if="visitNumber" class="text-muted-foreground">—</span>
            <span v-if="visitNumber" class="text-muted-foreground">Visit #{{ visitNumber }}</span>
          </div>

          <!-- Concerns -->
          <div class="flex flex-col gap-2">
            <Label for="triage-concerns" class="flex items-center gap-1.5">
              <Activity class="size-3.5 text-muted-foreground" />
              Concerns / Chief Complaints
            </Label>
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

          <!-- Fetal movement (only >= 20 weeks) -->
          <div v-if="showFetalMovement" class="flex flex-col gap-2">
            <Label class="flex items-center gap-1.5">
              <Baby class="size-3.5 text-muted-foreground" />
              Fetal Movement
            </Label>
            <Select
              :model-value="localTriage.fetal_movement || undefined"
              :disabled="store.isFinalized || !canEditTriage"
              @update:model-value="(v) => { localTriage.fetal_movement = (v as LocalTriage['fetal_movement']) ?? ''; saveTriage() }"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select fetal movement status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="decreased">Decreased</SelectItem>
                <SelectItem value="not_yet_felt">Not yet felt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Danger Signs -->
          <div class="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <div class="flex items-center gap-2">
              <AlertTriangle class="size-4 shrink-0 text-destructive" />
              <span class="text-sm font-semibold text-destructive">Danger Signs</span>
            </div>
            <DangerSignsChecklist
              :model-value="localTriage.danger_signs"
              :disabled="store.isFinalized || !canEditTriage"
              @update:model-value="(v) => { localTriage.danger_signs = v; saveTriage() }"
            />
            <div class="flex items-center gap-2 border-t pt-3">
              <Checkbox
                id="danger-signs-reviewed"
                :checked="localTriage.danger_signs_reviewed"
                :disabled="store.isFinalized || !canEditTriage"
                @update:checked="(v) => { localTriage.danger_signs_reviewed = !!v; saveTriage() }"
              />
              <Label for="danger-signs-reviewed" class="cursor-pointer text-sm font-normal">
                Danger signs reviewed with patient
              </Label>
            </div>
          </div>

          <!-- Vitals -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold">Vitals</h3>

            <!-- Blood pressure -->
            <div class="flex flex-col gap-2">
              <Label class="flex items-center gap-1.5">
                <Activity class="size-3.5 text-muted-foreground" />
                Blood Pressure (mmHg)
              </Label>
              <div class="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Systolic"
                  :model-value="localTriage.vitals.bp_systolic"
                  :disabled="store.isFinalized || !canEditTriage"
                  class="w-32"
                  @update:model-value="(v) => localTriage.vitals.bp_systolic = String(v)"
                  @blur="saveTriage"
                />
                <span class="text-muted-foreground">/</span>
                <Input
                  type="number"
                  placeholder="Diastolic"
                  :model-value="localTriage.vitals.bp_diastolic"
                  :disabled="store.isFinalized || !canEditTriage"
                  class="w-32"
                  @update:model-value="(v) => localTriage.vitals.bp_diastolic = String(v)"
                  @blur="saveTriage"
                />
              </div>
              <p v-if="bpAlert" class="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle class="size-3.5" />
                BP >= 140/90 — consider hypertensive disorder screening
              </p>
            </div>

            <!-- Weight / HR / RR / Temp in a grid -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="flex flex-col gap-2">
                <Label for="vital-weight" class="text-xs text-muted-foreground">Weight (kg)</Label>
                <Input
                  id="vital-weight"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 58.5"
                  :model-value="localTriage.vitals.weight"
                  :disabled="store.isFinalized || !canEditTriage"
                  @update:model-value="(v) => localTriage.vitals.weight = String(v)"
                  @blur="saveTriage"
                />
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
            </div>
          </div>

          <!-- Bottom nav -->
          <div class="mt-4 flex justify-end border-t pt-4">
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ── ASSESSMENT TAB ─────────────────────────────────────── -->
        <TabsContent v-if="canEditAssessment" value="assessment" class="mt-0 flex flex-col gap-6">

          <!-- OB Exam -->
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold">OB Examination</h3>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <!-- Fundal height -->
              <div class="flex flex-col gap-2">
                <Label for="ob-fh" class="text-xs text-muted-foreground">Fundal Height (cm)</Label>
                <Input
                  id="ob-fh"
                  type="number"
                  step="0.5"
                  placeholder="e.g. 28"
                  :model-value="localAssessment.ob_exam.fundal_height"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => localAssessment.ob_exam.fundal_height = String(v)"
                  @blur="saveAssessment"
                />
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
                  @update:model-value="(v) => { localAssessment.ob_exam.edema = v ?? ''; saveAssessment() }"
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
          </div>

          <!-- Cervical exam (collapsible, >= 38 weeks) -->
          <Collapsible
            v-if="showCervical"
            v-model:open="cervicalOpen"
            class="rounded-md border"
          >
            <CollapsibleTrigger
              class="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50"
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
                  <Label for="cx-bishop" class="text-xs text-muted-foreground">Bishop Score</Label>
                  <Input
                    id="cx-bishop"
                    type="number"
                    min="0"
                    max="13"
                    placeholder="0–13"
                    :model-value="localAssessment.cervical.bishop_score"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => localAssessment.cervical.bishop_score = String(v)"
                    @blur="saveAssessment"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <!-- Ultrasound section -->
          <div class="flex flex-col gap-4 rounded-md border p-4">
            <h3 class="text-sm font-semibold">Ultrasound</h3>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <Label for="utz-date" class="text-xs text-muted-foreground">Date</Label>
                <Input
                  id="utz-date"
                  type="date"
                  :model-value="localAssessment.ultrasound.date"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => localAssessment.ultrasound.date = String(v)"
                  @blur="saveAssessment"
                />
              </div>

              <div class="flex flex-col gap-2">
                <Label for="utz-edd" class="text-xs text-muted-foreground">EDD from Ultrasound</Label>
                <Input
                  id="utz-edd"
                  type="date"
                  :model-value="localAssessment.ultrasound.edd"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => localAssessment.ultrasound.edd = String(v)"
                  @blur="saveAssessment"
                />
              </div>

              <div class="flex flex-col gap-2 sm:col-span-2">
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
                    @blur="saveAssessment"
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
                    @blur="saveAssessment"
                  />
                  <span class="text-xs text-muted-foreground">d</span>
                </div>
              </div>
            </div>

            <!-- EDD comparison line -->
            <div
              v-if="store.current.prenatal_visit && (store.current.prenatal_visit.gestational_age_weeks !== null || localAssessment.ultrasound.edd)"
              class="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
            >
              <span v-if="store.current.prenatal_visit.gestational_age_weeks !== null">
                Current GA (encounter): {{ store.current.prenatal_visit.gestational_age_weeks }}w{{ store.current.prenatal_visit.gestational_age_days ? `${store.current.prenatal_visit.gestational_age_days}d` : '' }}
              </span>
              <span v-if="localAssessment.ultrasound.edd" class="ml-3">
                | EDD from Ultrasound: {{ localAssessment.ultrasound.edd }}
              </span>
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

          <!-- Pregnancy progress + risk level -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label class="flex items-center gap-1.5">
                <Stethoscope class="size-3.5 text-muted-foreground" />
                Pregnancy Progress
              </Label>
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
              <Label class="flex items-center gap-1.5">
                <AlertTriangle class="size-3.5 text-muted-foreground" />
                Risk Level
              </Label>
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

          <!-- Diagnoses -->
          <div class="flex flex-col gap-2">
            <Label class="flex items-center gap-1.5">
              <Stethoscope class="size-3.5 text-muted-foreground" />
              Diagnoses
            </Label>

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
            <Label for="assessment-notes" class="flex items-center gap-1.5">
              <Stethoscope class="size-3.5 text-muted-foreground" />
              Assessment Notes
            </Label>
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
          <div class="mt-4 flex justify-between border-t pt-4">
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
        <TabsContent value="plan" class="mt-0 flex flex-col gap-6">

          <!-- Prescriptions -->
          <PrescriptionSection
            :consultation-id="store.current.id"
            :disabled="store.isFinalized || !canEditPlan || !authStore.hasPermission('prescriptions.create')"
            :realtime-update="prescriptionUpdate"
            :document-update="documentUpdate"
          />

          <!-- Due Procedures Reminder -->
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

          <!-- Procedures -->
          <ProcedureSection
            :encounter-id="store.current.id"
            :procedures="store.current.procedures ?? []"
            :disabled="store.isFinalized || !canEditPlan"
            @update="(p) => { if (store.current) store.current.procedures = p }"
          />

          <!-- Due Labs Reminder -->
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

          <!-- Lab Orders -->
          <LabOrderSection
            :consultation-id="store.current.id"
            :disabled="store.isFinalized || !canEditPlan || !authStore.hasPermission('lab-orders.create') || !authStore.hasFeature('lab_orders')"
            :realtime-update="labOrderUpdate"
            :document-update="documentUpdate"
            @lab-updated="store.loadEncounter(store.current!.id)"
          />

          <!-- Consumables -->
          <ConsumableSection
            :consultation-id="store.current.id"
            :consumables="store.current.consumables ?? []"
            :disabled="store.isFinalized || !canEditPlan"
            @update="(c) => { if (store.current) store.current.consumables = c }"
          />

          <!-- Next visit -->
          <div class="flex flex-col gap-3 rounded-md border p-4">
            <h3 class="text-sm font-semibold">Next Visit</h3>
            <p class="text-xs text-muted-foreground">
              {{ suggestedVisitInterval }}
            </p>
            <div class="flex flex-col gap-2">
              <Label for="plan-next-visit" class="text-xs text-muted-foreground">Scheduled Date</Label>
              <Input
                id="plan-next-visit"
                type="date"
                :model-value="localPlan.next_visit_date"
                :disabled="store.isFinalized || !canEditPlan"
                class="max-w-xs"
                @update:model-value="(v) => localPlan.next_visit_date = String(v)"
                @blur="savePlan"
              />
            </div>
          </div>

          <!-- Counseling provided -->
          <div class="flex flex-col gap-3">
            <Label class="flex items-center gap-1.5 text-sm font-semibold">
              Counseling Provided
            </Label>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="opt in COUNSELING_OPTIONS"
                :key="opt.key"
                class="flex items-center gap-2"
              >
                <Checkbox
                  :id="`counsel-${opt.key}`"
                  :checked="localPlan.counseling_provided.includes(opt.key)"
                  :disabled="store.isFinalized || !canEditPlan"
                  @update:checked="() => { toggleCounseling(opt.key); savePlan() }"
                />
                <Label :for="`counsel-${opt.key}`" class="cursor-pointer text-sm font-normal">
                  {{ opt.label }}
                </Label>
              </div>
            </div>
          </div>

          <!-- Birth plan (trimester 3 only) -->
          <div v-if="isTrimester3" class="flex items-center gap-2">
            <Checkbox
              id="plan-birth-plan"
              :checked="localPlan.birth_plan_discussed"
              :disabled="store.isFinalized || !canEditPlan"
              @update:checked="(v) => { localPlan.birth_plan_discussed = !!v; savePlan() }"
            />
            <Label for="plan-birth-plan" class="cursor-pointer text-sm font-normal">
              Birth plan discussed with patient
            </Label>
          </div>

          <!-- Referrals -->
          <div class="flex flex-col gap-2">
            <Label for="plan-referrals" class="flex items-center gap-1.5">
              <FlaskConical class="size-3.5 text-muted-foreground" />
              Referrals
            </Label>
            <Textarea
              id="plan-referrals"
              :model-value="localPlan.referrals"
              placeholder="e.g. MFM consult, cardiology, etc."
              :disabled="store.isFinalized || !canEditPlan"
              :rows="2"
              @update:model-value="(v) => localPlan.referrals = String(v)"
              @blur="savePlan"
            />
          </div>

          <!-- Notes -->
          <div class="flex flex-col gap-2">
            <Label for="plan-notes" class="flex items-center gap-1.5">
              <ClipboardList class="size-3.5 text-muted-foreground" />
              Plan Notes
            </Label>
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

          <!-- Bottom nav -->
          <div class="mt-4 flex items-center justify-between border-t pt-4">
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
        <TabsContent value="billing" class="mt-0">
          <PaymentTab
            :disabled="store.isFinalized"
            :consultation-id="store.current.id"
            :status="store.current.status"
            :consultation-type="'default'"
            :patient-id="store.current.patient_id"
            :diagnoses="store.current.prenatal_visit?.assessment?.diagnoses ?? []"
            :document-update="documentUpdate"
            :consumables="store.current.consumables ?? []"
            :prescription-summary="store.current.prescription_summary"
            :lab-order-summary="store.current.lab_order_summary"
            :payment="store.current.payment"
            :can-finalize="store.isDraft && canFinalize"
            :is-saving="store.isSaving"
            @update:payment="(p) => { if (store.current) store.current.payment = p }"
            @finalize="showFinalizeModal = true"
          />
          <div class="mt-8 flex justify-start border-t pt-4">
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
                  class="text-[10px]"
                >
                  {{ sign.replace(/_/g, ' ') }}
                </Badge>
              </div>
            </div>
          </div>
        </aside>
    </div>

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
