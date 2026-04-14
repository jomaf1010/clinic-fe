<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Plus,
  ChevronRight,
  Pencil,
  XCircle,
  LoaderCircle,
  Activity,
  Cigarette,
  Wine,
  Salad,
  Pill,
  Users,
  Trash2,
  ClipboardCheck,
  TrendingUp,
  FileText,
} from 'lucide-vue-next'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { Button } from '@/components/ui/button'
import PatientSectionWidget from '../PatientSectionWidget.vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { LifestyleData } from '@/domains/consultation/types/consultation.types'
import type { FamilyHistoryEntry, FamilyHistoryCondition, Medication, StoreMedicationPayload, PreventiveCareItem, StorePreventiveCarePayload } from '@/domains/patient/api/patientApi'
import type { ChronicTrendsData, Problem } from '@/domains/patient/types/patient.types'
import type { StructuredAllergy } from '@/domains/patient/api/patientApi'

use([LineChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const route = useRoute()
const patientId = computed(() => route.params.id as string)

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Lifestyle ────────────────────────────────────────────────────────────
const lifestyleLoading = ref(false)
const lifestyleEditing = ref(false)
const lifestyleSaving = ref(false)
const lifestyle = reactive<LifestyleData>({
  smoking: null,
  pack_years: null,
  alcohol: null,
  exercise: null,
  diet: null,
  medication_adherence: null,
})

const showPackYears = computed(() => lifestyle.smoking === 'current' || lifestyle.smoking === 'former')

const hasLifestyleData = computed(() =>
  Object.values(lifestyle).some((v) => v !== null && v !== undefined),
)

const lifestyleDisplayItems = computed(() => {
  const items: { label: string; value: string }[] = []
  const labels: Record<string, Record<string, string>> = {
    smoking: { never: 'Never', former: 'Former', current: 'Current' },
    alcohol: { none: 'None', social: 'Social', moderate: 'Moderate', heavy: 'Heavy' },
    exercise: { none: 'None', light: 'Light', moderate: 'Moderate', vigorous: 'Vigorous' },
    diet: { poor: 'Poor', fair: 'Fair', good: 'Good', excellent: 'Excellent' },
    medication_adherence: { non_adherent: 'Non-adherent', partial: 'Partial', adherent: 'Adherent' },
  }
  if (lifestyle.smoking) items.push({ label: 'Smoking', value: labels['smoking']?.[lifestyle.smoking] ?? lifestyle.smoking })
  if (lifestyle.pack_years != null && (lifestyle.smoking === 'current' || lifestyle.smoking === 'former')) {
    items.push({ label: 'Pack Years', value: String(lifestyle.pack_years) })
  }
  if (lifestyle.alcohol) items.push({ label: 'Alcohol', value: labels['alcohol']?.[lifestyle.alcohol] ?? lifestyle.alcohol })
  if (lifestyle.exercise) items.push({ label: 'Exercise', value: labels['exercise']?.[lifestyle.exercise] ?? lifestyle.exercise })
  if (lifestyle.diet) items.push({ label: 'Diet', value: labels['diet']?.[lifestyle.diet] ?? lifestyle.diet })
  if (lifestyle.medication_adherence) items.push({ label: 'Med. Adherence', value: labels['medication_adherence']?.[lifestyle.medication_adherence] ?? lifestyle.medication_adherence })
  return items
})

async function loadLifestyle() {
  lifestyleLoading.value = true
  try {
    const res = await patientApi.getLifestyle(patientId.value)
    if (res.data) Object.assign(lifestyle, res.data)
  } catch {
    // silently fail
  } finally {
    lifestyleLoading.value = false
  }
}

async function saveLifestyle() {
  lifestyleSaving.value = true
  try {
    const res = await patientApi.updateLifestyle(patientId.value, { ...lifestyle })
    Object.assign(lifestyle, res.data)
    lifestyleEditing.value = false
  } catch {
    toast.error('Failed to save lifestyle data')
  } finally {
    lifestyleSaving.value = false
  }
}

// ── Family History ────────────────────────────────────────────────────────
const familyHistory = ref<FamilyHistoryEntry[]>([])
const isLoadingFamilyHistory = ref(false)
const showFamilyHistoryDialog = ref(false)
const editingFamilyEntry = ref<FamilyHistoryEntry | null>(null)
const isSavingFamilyHistory = ref(false)

const relativeLabels: Record<string, string> = {
  father: 'Father',
  mother: 'Mother',
  sibling: 'Sibling',
  paternal_grandfather: 'Pat. Grandfather',
  paternal_grandmother: 'Pat. Grandmother',
  maternal_grandfather: 'Mat. Grandfather',
  maternal_grandmother: 'Mat. Grandmother',
  child: 'Child',
  other: 'Other',
}

interface FamilyFormCondition {
  name: string
  icd_code: string
  age_of_onset: number | null
}

const familyForm = reactive<{
  relative: string
  conditions: FamilyFormCondition[]
  alive: boolean
  age_at_death: number | null
  cause_of_death: string
  notes: string
}>({
  relative: '',
  conditions: [],
  alive: true,
  age_at_death: null,
  cause_of_death: '',
  notes: '',
})

function resetFamilyForm() {
  familyForm.relative = ''
  familyForm.conditions = []
  familyForm.alive = true
  familyForm.age_at_death = null
  familyForm.cause_of_death = ''
  familyForm.notes = ''
}

function openAddRelative() {
  editingFamilyEntry.value = null
  resetFamilyForm()
  familyForm.conditions = [{ name: '', icd_code: '', age_of_onset: null }]
  showFamilyHistoryDialog.value = true
}

function openEditRelative(entry: FamilyHistoryEntry) {
  editingFamilyEntry.value = entry
  familyForm.relative = entry.relative
  familyForm.conditions = entry.conditions.map((c) => ({
    name: c.name,
    icd_code: c.icd_code ?? '',
    age_of_onset: c.age_of_onset,
  }))
  familyForm.alive = entry.alive
  familyForm.age_at_death = entry.age_at_death
  familyForm.cause_of_death = entry.cause_of_death ?? ''
  familyForm.notes = entry.notes ?? ''
  showFamilyHistoryDialog.value = true
}

function addConditionRow() {
  familyForm.conditions.push({ name: '', icd_code: '', age_of_onset: null })
}

function removeConditionRow(index: number) {
  familyForm.conditions.splice(index, 1)
}

async function loadFamilyHistory() {
  isLoadingFamilyHistory.value = true
  try {
    const res = await patientApi.getFamilyHistory(patientId.value)
    familyHistory.value = res.data
  } catch {
    // silently fail
  } finally {
    isLoadingFamilyHistory.value = false
  }
}

async function saveFamilyHistory() {
  if (!familyForm.relative) return
  isSavingFamilyHistory.value = true
  try {
    const payload = {
      relative: familyForm.relative,
      conditions: familyForm.conditions
        .filter((c) => c.name.trim())
        .map((c): FamilyHistoryCondition => ({
          name: c.name.trim(),
          icd_code: c.icd_code.trim() || null,
          age_of_onset: c.age_of_onset,
        })),
      alive: familyForm.alive,
      age_at_death: familyForm.alive ? null : familyForm.age_at_death,
      cause_of_death: familyForm.alive ? null : (familyForm.cause_of_death.trim() || null),
      notes: familyForm.notes.trim() || null,
    }

    if (editingFamilyEntry.value) {
      const res = await patientApi.updateFamilyHistory(patientId.value, editingFamilyEntry.value.uuid, payload)
      const idx = familyHistory.value.findIndex((e) => e.uuid === editingFamilyEntry.value!.uuid)
      if (idx >= 0) familyHistory.value[idx] = res.data
    } else {
      const res = await patientApi.addFamilyHistory(patientId.value, payload)
      familyHistory.value.push(res.data)
    }

    showFamilyHistoryDialog.value = false
    resetFamilyForm()
  } catch {
    toast.error('Failed to save family history')
  } finally {
    isSavingFamilyHistory.value = false
  }
}

async function deleteFamilyEntry(uuid: string) {
  try {
    await patientApi.deleteFamilyHistory(patientId.value, uuid)
    familyHistory.value = familyHistory.value.filter((e) => e.uuid !== uuid)
  } catch {
    toast.error('Failed to delete family history entry')
  }
}

// ── Medications ───────────────────────────────────────────────────────────
const medications = ref<Medication[]>([])
const isLoadingMeds = ref(false)
const showMedDialog = ref(false)
const editingMed = ref<Medication | null>(null)
const isSavingMed = ref(false)
const showDiscontinueDialog = ref(false)
const discontinuingMed = ref<Medication | null>(null)
const discontinuing = ref(false)
const discontinueReason = ref('')
const discontinuedMedsOpen = ref(false)

const activeMeds = computed(() => medications.value.filter((m) => m.status === 'active' || m.status === 'on_hold'))
const discontinuedMeds = computed(() => medications.value.filter((m) => m.status === 'discontinued'))

const medForm = reactive({
  drug_name: '',
  dose: '',
  frequency: '',
  route: '',
  indication: '',
  started_date: '',
  status: 'active' as 'active' | 'on_hold',
  notes: '',
})

function resetMedForm() {
  medForm.drug_name = ''
  medForm.dose = ''
  medForm.frequency = ''
  medForm.route = ''
  medForm.indication = ''
  medForm.started_date = ''
  medForm.status = 'active'
  medForm.notes = ''
}

function openAddMed() {
  editingMed.value = null
  resetMedForm()
  showMedDialog.value = true
}

function openEditMed(med: Medication) {
  editingMed.value = med
  medForm.drug_name = med.drug_name
  medForm.dose = med.dose ?? ''
  medForm.frequency = med.frequency ?? ''
  medForm.route = med.route ?? ''
  medForm.indication = med.indication ?? ''
  medForm.started_date = med.started_date ?? ''
  medForm.status = med.status === 'discontinued' ? 'active' : med.status
  medForm.notes = med.notes ?? ''
  showMedDialog.value = true
}

async function loadMedications() {
  isLoadingMeds.value = true
  try {
    const res = await patientApi.getMedications(patientId.value)
    medications.value = res.data
  } catch {
    // silently fail
  } finally {
    isLoadingMeds.value = false
  }
}

async function saveMedication() {
  if (!medForm.drug_name.trim()) return
  isSavingMed.value = true
  try {
    const payload: StoreMedicationPayload = {
      drug_name: medForm.drug_name.trim(),
      dose: medForm.dose.trim() || null,
      frequency: medForm.frequency || null,
      route: medForm.route || null,
      indication: medForm.indication.trim() || null,
      started_date: medForm.started_date || null,
      status: medForm.status,
      notes: medForm.notes.trim() || null,
    }
    if (editingMed.value) {
      const res = await patientApi.updateMedication(patientId.value, editingMed.value.uuid, payload)
      const idx = medications.value.findIndex((m) => m.uuid === editingMed.value!.uuid)
      if (idx >= 0) medications.value[idx] = res.data
    } else {
      const res = await patientApi.addMedication(patientId.value, payload)
      medications.value.unshift(res.data)
    }
    showMedDialog.value = false
    resetMedForm()
  } catch {
    toast.error('Failed to save medication')
  } finally {
    isSavingMed.value = false
  }
}

function openDiscontinue(med: Medication) {
  discontinuingMed.value = med
  discontinueReason.value = ''
  showDiscontinueDialog.value = true
}

async function confirmDiscontinue() {
  if (!discontinuingMed.value) return
  discontinuing.value = true
  try {
    const res = await patientApi.updateMedication(patientId.value, discontinuingMed.value.uuid, {
      drug_name: discontinuingMed.value.drug_name,
      status: 'discontinued',
      discontinue_reason: discontinueReason.value.trim() || null,
    })
    const idx = medications.value.findIndex((m) => m.uuid === discontinuingMed.value!.uuid)
    if (idx >= 0) medications.value[idx] = res.data
    showDiscontinueDialog.value = false
  } catch {
    toast.error('Failed to discontinue medication')
  } finally {
    discontinuing.value = false
  }
}

async function deleteMedication(uuid: string) {
  try {
    await patientApi.deleteMedication(patientId.value, uuid)
    medications.value = medications.value.filter((m) => m.uuid !== uuid)
  } catch {
    toast.error('Failed to delete medication')
  }
}

// ── Preventive Care ───────────────────────────────────────────────────────
const preventiveCare = ref<PreventiveCareItem[]>([])
const isLoadingPreventive = ref(false)
const showPreventiveDialog = ref(false)
const editingScreening = ref<PreventiveCareItem | null>(null)
const isSavingPreventive = ref(false)

const categoryLabels: Record<string, string> = {
  cancer: 'Cancer Screenings',
  cardiovascular: 'Cardiovascular',
  metabolic: 'Metabolic',
  general: 'General',
}

const overdueScreenings = computed(() =>
  preventiveCare.value.filter((x) => x.status === 'overdue'),
)

const groupedByCategory = computed(() => {
  const catOrder = Object.keys(categoryLabels)
  const groups = new Map<string, PreventiveCareItem[]>()
  for (const item of preventiveCare.value) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }
  const result: { category: string; items: PreventiveCareItem[] }[] = []
  for (const cat of catOrder) {
    if (groups.has(cat)) result.push({ category: cat, items: groups.get(cat)! })
  }
  for (const [cat, items] of groups) {
    if (!catOrder.includes(cat)) result.push({ category: cat, items })
  }
  return result
})

const screeningForm = reactive<{
  status: 'completed' | 'declined' | 'not_applicable'
  lastDoneDate: string
  result: string
  notes: string
}>({
  status: 'completed',
  lastDoneDate: '',
  result: '',
  notes: '',
})

function openRecordScreening(item: PreventiveCareItem) {
  editingScreening.value = item
  screeningForm.status = item.status === 'declined' || item.status === 'not_applicable'
    ? item.status
    : 'completed'
  screeningForm.lastDoneDate = item.last_done_date ?? ''
  screeningForm.result = item.result ?? ''
  screeningForm.notes = item.notes ?? ''
  showPreventiveDialog.value = true
}

async function loadPreventiveCare() {
  isLoadingPreventive.value = true
  try {
    const res = await patientApi.getPreventiveCare(patientId.value)
    preventiveCare.value = res.data
  } catch {
    // silently fail
  } finally {
    isLoadingPreventive.value = false
  }
}

async function saveScreening() {
  if (!editingScreening.value) return
  isSavingPreventive.value = true
  try {
    const payload: StorePreventiveCarePayload = {
      screening_key: editingScreening.value.key,
      status: screeningForm.status,
      last_done_date: screeningForm.status === 'completed' ? (screeningForm.lastDoneDate || null) : null,
      result: screeningForm.status === 'completed' ? (screeningForm.result.trim() || null) : null,
      notes: screeningForm.notes.trim() || null,
    }
    if (editingScreening.value.recorded_uuid) {
      const res = await patientApi.updatePreventiveCare(patientId.value, editingScreening.value.recorded_uuid, payload)
      const idx = preventiveCare.value.findIndex((x) => x.key === editingScreening.value!.key)
      if (idx >= 0) preventiveCare.value[idx] = res.data
    } else {
      const res = await patientApi.storePreventiveCare(patientId.value, payload)
      const idx = preventiveCare.value.findIndex((x) => x.key === editingScreening.value!.key)
      if (idx >= 0) preventiveCare.value[idx] = res.data
    }
    showPreventiveDialog.value = false
  } catch {
    toast.error('Failed to save screening record')
  } finally {
    isSavingPreventive.value = false
  }
}

async function deleteScreening(entryUuid: string, key: string) {
  try {
    await patientApi.deletePreventiveCare(patientId.value, entryUuid)
    const idx = preventiveCare.value.findIndex((x) => x.key === key)
    if (idx >= 0) {
      preventiveCare.value[idx] = {
        ...preventiveCare.value[idx]!,
        status: 'due',
        last_done_date: null,
        next_due_date: null,
        result: null,
        notes: null,
        recorded_uuid: null,
      }
    }
  } catch {
    toast.error('Failed to remove screening record')
  }
}

function preventiveStatusLabel(status: PreventiveCareItem['status']): string {
  switch (status) {
    case 'completed': return 'Completed'
    case 'due': return 'Due'
    case 'overdue': return 'Overdue'
    case 'declined': return 'Declined'
    case 'not_applicable': return 'N/A'
  }
}

function preventiveStatusClass(status: PreventiveCareItem['status']): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
    case 'due': return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'
    case 'overdue': return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100'
    case 'declined': return 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100'
    case 'not_applicable': return 'bg-muted text-muted-foreground border-border hover:bg-muted'
  }
}

// ── Patient Trends ────────────────────────────────────────────────────────
const showTrendsModal = ref(false)
const trendsData = ref<ChronicTrendsData | null>(null)
const trendsLoading = ref(true)
const activeTrendTab = ref<'bp' | 'blood_sugar' | 'weight' | 'bmi'>('bp')

const trendTabs = [
  { key: 'bp' as const, label: 'Blood Pressure' },
  { key: 'blood_sugar' as const, label: 'Blood Sugar' },
  { key: 'weight' as const, label: 'Weight' },
  { key: 'bmi' as const, label: 'BMI' },
]

async function loadTrends() {
  trendsLoading.value = true
  try {
    const res = await patientApi.getChronicTrends(patientId.value)
    trendsData.value = res.data
  } catch {
    // silent
  } finally {
    trendsLoading.value = false
  }
}

const trendsWidgetDetail = computed(() => {
  if (!trendsData.value) return 'No data'
  const latest = trendsData.value.bp?.[trendsData.value.bp.length - 1]
  if (latest?.classification) return latest.classification
  return 'Vitals over time'
})

function classificationColor(c: string): string {
  const lower = c.toLowerCase()
  if (lower.includes('normal')) return '#16a34a'
  if (lower.includes('elevated') || lower.includes('pre')) return '#d97706'
  return '#dc2626'
}

const trendsChartOption = computed(() => {
  const tab = activeTrendTab.value
  const data = trendsData.value
  if (!data) return {}

  if (tab === 'bp') {
    const points = data.bp ?? []
    return {
      animation: true,
      animationDuration: 300,
      grid: { top: 16, right: 24, bottom: 40, left: 52 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: { dataIndex: number }[]) => {
          const p = params[0]
          if (!p) return ''
          const pt = points[p.dataIndex]
          if (!pt) return ''
          const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          return `<div style="font-size:12px;">
            <b>${date}</b><br/>
            ${pt.systolic}/${pt.diastolic} mmHg
            ${pt.classification ? `<br/><span style="color:${classificationColor(pt.classification)}">${pt.classification}</span>` : ''}
          </div>`
        },
      },
      xAxis: {
        type: 'category',
        data: points.map(p => {
          const d = new Date(p.date)
          return `${d.getMonth() + 1}/${d.getDate()}`
        }),
        axisLabel: { fontSize: 11 },
        axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'mmHg',
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: { fontSize: 11 },
        axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
        splitLine: { lineStyle: { color: 'hsl(var(--border))', opacity: 0.15, type: 'dotted' } },
      },
      series: [
        {
          name: 'Systolic',
          type: 'line',
          data: points.map(p => p.systolic),
          lineStyle: { color: '#ef4444', width: 2 },
          itemStyle: { color: '#ef4444' },
          symbolSize: 6,
        },
        {
          name: 'Diastolic',
          type: 'line',
          data: points.map(p => p.diastolic),
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' },
          symbolSize: 6,
        },
      ],
    }
  }

  const points = (tab === 'blood_sugar' ? data.blood_sugar : tab === 'weight' ? data.weight : data.bmi) ?? []
  const unit = tab === 'blood_sugar' ? 'mg/dL' : tab === 'weight' ? 'kg' : ''
  const color = '#00B2B2'

  return {
    animation: true,
    animationDuration: 300,
    grid: { top: 16, right: 24, bottom: 40, left: 52 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number }[]) => {
        const p = params[0]
        if (!p) return ''
        const pt = points[p.dataIndex]
        if (!pt) return ''
        const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return `<div style="font-size:12px;">
          <b>${date}</b><br/>
          ${pt.value} ${unit}
          ${pt.classification ? `<br/><span style="color:${classificationColor(pt.classification)}">${pt.classification}</span>` : ''}
        </div>`
      },
    },
    xAxis: {
      type: 'category',
      data: points.map(p => {
        const d = new Date(p.date)
        return `${d.getMonth() + 1}/${d.getDate()}`
      }),
      axisLabel: { fontSize: 11 },
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameLocation: 'middle',
      nameGap: 40,
      axisLabel: { fontSize: 11 },
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      splitLine: { lineStyle: { color: 'hsl(var(--border))', opacity: 0.15, type: 'dotted' } },
    },
    series: [
      {
        name: tab === 'blood_sugar' ? 'Blood Sugar' : tab === 'weight' ? 'Weight' : 'BMI',
        type: 'line',
        data: points.map(p => p.value),
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.08 },
        symbolSize: 6,
      },
    ],
  }
})

// ── Clinical Narrative Summary ────────────────────────────────────────────
const narrativeProblems = ref<Problem[]>([])
const narrativeAllergies = ref<StructuredAllergy[]>([])

async function loadNarrativeData() {
  const [probRes, allergyRes] = await Promise.allSettled([
    patientApi.getProblems(patientId.value),
    patientApi.getAllergies(patientId.value),
  ])
  if (probRes.status === 'fulfilled') narrativeProblems.value = probRes.value.data
  if (allergyRes.status === 'fulfilled') narrativeAllergies.value = allergyRes.value.data
}

function b(text: string | number) { return `<b>${text}</b>` }

const narrativeSummary = computed(() => {
  const lines: string[] = []

  // Problems
  const active = narrativeProblems.value.filter(p => p.status !== 'resolved')
  if (active.length > 0) {
    const items = active.map(p => {
      const status = p.status === 'active' ? '' : ` (${b(p.status)})`
      return `${b(p.description)}${status}`
    })
    lines.push(`Has ${b(active.length)} active problem${active.length > 1 ? 's' : ''}: ${items.join(', ')}.`)
  }

  // Allergies
  if (narrativeAllergies.value.length > 0) {
    const items = narrativeAllergies.value.map(a => {
      const sev = a.severity !== 'mild' ? ` (${b(a.severity)})` : ''
      return `${b(a.allergen)}${sev}`
    })
    lines.push(`Known allergies: ${items.join(', ')}.`)
  }

  // Medications
  const activeMedsList = medications.value.filter(m => m.status === 'active')
  if (activeMedsList.length > 0) {
    const names = activeMedsList.slice(0, 3).map(m => b(m.drug_name))
    const more = activeMedsList.length > 3 ? ` and ${b(activeMedsList.length - 3)} more` : ''
    lines.push(`Currently taking ${b(activeMedsList.length)} medication${activeMedsList.length > 1 ? 's' : ''}: ${names.join(', ')}${more}.`)
  }

  // Lifestyle
  if (lifestyle) {
    const ls = lifestyle
    const risks: string[] = []
    if (ls.smoking === 'current') {
      risks.push(ls.pack_years ? `${b('current smoker')} (${b(ls.pack_years)} pack-years)` : b('current smoker'))
    } else if (ls.smoking === 'former') {
      risks.push(b('former smoker'))
    }
    if (ls.alcohol === 'heavy') risks.push(b('heavy alcohol use'))
    else if (ls.alcohol === 'moderate') risks.push(b('moderate alcohol use'))
    if (ls.exercise === 'none') risks.push(b('sedentary'))
    if (ls.medication_adherence === 'non_adherent') risks.push(b('non-adherent to medications'))
    else if (ls.medication_adherence === 'partial') risks.push(b('partially adherent to medications'))
    if (risks.length > 0) lines.push(`Lifestyle: ${risks.join(', ')}.`)
  }

  // Family history
  if (familyHistory.value.length > 0) {
    const items = familyHistory.value.slice(0, 3).map(f => {
      const conds = f.conditions.map((c: FamilyHistoryCondition) => b(c.name)).join(', ')
      const rel = b(f.relative.replace(/_/g, ' '))
      return `${rel} — ${conds || 'no conditions noted'}`
    })
    const more = familyHistory.value.length > 3 ? ` (+${b(familyHistory.value.length - 3)} more)` : ''
    lines.push(`Family history: ${items.join('; ')}${more}.`)
  }

  // Latest trends
  const bp = trendsData.value?.bp
  if (bp && bp.length > 0) {
    const latest = bp[bp.length - 1]!
    const cls = latest.classification ? ` — ${b(latest.classification)}` : ''
    lines.push(`Latest BP: ${b(`${latest.systolic}/${latest.diastolic}`)} mmHg${cls}.`)
  }
  const bs = trendsData.value?.blood_sugar
  if (bs && bs.length > 0) {
    const latest = bs[bs.length - 1]!
    const cls = latest.classification ? ` — ${b(latest.classification)}` : ''
    lines.push(`Latest blood sugar: ${b(latest.value!)} mg/dL${cls}.`)
  }

  // Overdue screenings
  const overdue = preventiveCare.value.filter(p => p.status === 'overdue')
  if (overdue.length > 0) {
    const names = overdue.map(p => b(p.name)).join(', ')
    lines.push(`${b(overdue.length)} overdue screening${overdue.length > 1 ? 's' : ''}: ${names}.`)
  }

  return lines.length > 0 ? lines.join(' ') : null
})

const hasPreventiveCare = computed(() => !isLoadingPreventive.value && preventiveCare.value.length > 0)

// ── Section modal visibility ──────────────────────────────────────────────
const showMedsModal = ref<boolean>(false)
const showLifestyleModal = ref<boolean>(false)
const showFamilyModal = ref<boolean>(false)
const showPreventiveModal = ref<boolean>(false)

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(() => {
  if (!patientId.value) return
  loadLifestyle()
  loadFamilyHistory()
  loadMedications()
  loadPreventiveCare()
  loadTrends()
  loadNarrativeData()
})
</script>

<template>
  <div class="contents">
    <PatientSectionWidget
        :icon="Pill"
        icon-color="bg-blue-500/10 text-blue-600"
        title="Medications"
        :detail="activeMeds.length > 0 ? `${activeMeds.length} active` : 'None recorded'"
        :sub-detail="discontinuedMeds.length > 0 ? `${discontinuedMeds.length} discontinued` : undefined"
        :badge-text="activeMeds.length > 0 ? String(activeMeds.length) : undefined"
        badge-variant="secondary"
        :loading="isLoadingMeds"
        @click="showMedsModal = true"
      />
      <PatientSectionWidget
        :icon="TrendingUp"
        icon-color="bg-orange-500/10 text-orange-500"
        title="Patient Trends"
        :detail="trendsWidgetDetail"
        :loading="trendsLoading"
        @click="showTrendsModal = true"
      />
      <PatientSectionWidget
        :icon="Activity"
        icon-color="bg-green-500/10 text-green-600"
        title="Lifestyle"
        :detail="hasLifestyleData ? 'Recorded' : 'Not recorded'"
        :loading="lifestyleLoading"
        @click="showLifestyleModal = true"
      />
      <PatientSectionWidget
        :icon="Users"
        icon-color="bg-purple-500/10 text-purple-600"
        title="Family History"
        :detail="familyHistory.length > 0 ? `${familyHistory.length} relatives` : 'None recorded'"
        :badge-text="familyHistory.length > 0 ? String(familyHistory.length) : undefined"
        badge-variant="secondary"
        :loading="isLoadingFamilyHistory"
        @click="showFamilyModal = true"
      />
      <PatientSectionWidget
        v-if="hasPreventiveCare"
        :icon="ClipboardCheck"
        icon-color="bg-amber-500/10 text-amber-600"
        title="Preventive Care"
        :detail="overdueScreenings.length > 0 ? `${overdueScreenings.length} overdue` : `${preventiveCare.length} screenings`"
        :badge-text="overdueScreenings.length > 0 ? String(overdueScreenings.length) : undefined"
        badge-variant="destructive"
        :loading="isLoadingPreventive"
        @click="showPreventiveModal = true"
      />

      <!-- Clinical Narrative Card — spans remaining columns -->
      <div
        class="rounded-xl border bg-card p-4"
        :class="hasPreventiveCare ? 'col-span-1 sm:col-span-2' : 'col-span-1 sm:col-span-2 lg:col-span-3'"
      >
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500">
            <FileText class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold leading-tight">Clinical Summary</p>
            <p v-if="narrativeSummary" class="mt-1.5 text-xs leading-relaxed text-muted-foreground [&_b]:text-foreground [&_b]:font-semibold" v-html="narrativeSummary" />
            <p v-else class="mt-1 text-xs text-muted-foreground/50 italic">
              Summary will appear as patient data is recorded.
            </p>
          </div>
        </div>
      </div>

    <!-- Medications Modal -->
    <Dialog v-model:open="showMedsModal">
      <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Pill class="size-5" />
            Current Medications
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-2">
          <!-- Loading -->
          <div v-if="isLoadingMeds" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- Empty -->
          <div v-else-if="activeMeds.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <Pill class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No medications recorded</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Track active medications, dosages, and discontinuation history.</p>
          </div>

          <!-- Active / on-hold list -->
          <div
            v-for="med in activeMeds"
            :key="med.uuid"
            class="flex items-start gap-2 rounded-lg border bg-card p-2.5"
          >
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-sm font-semibold">{{ med.drug_name }}</span>
                <Badge v-if="med.status === 'on_hold'" variant="outline" class="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">
                  On Hold
                </Badge>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span v-if="med.dose || med.frequency || med.route" class="text-xs text-muted-foreground">
                  {{ [med.dose, med.frequency, med.route].filter(Boolean).join(' · ') }}
                </span>
                <span
                  v-if="med.indication"
                  class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {{ med.indication }}
                </span>
              </div>
              <span v-if="med.started_date" class="mt-0.5 block text-xs text-muted-foreground">
                Since {{ formatDate(med.started_date) }}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" class="size-6" title="Edit" @click="openEditMed(med)">
                <Pencil class="size-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" class="size-6" title="Discontinue" @click="openDiscontinue(med)">
                <XCircle class="size-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" class="size-6" title="Delete" @click="deleteMedication(med.uuid)">
                <Trash2 class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <!-- Discontinued collapsible -->
          <Collapsible v-if="discontinuedMeds.length > 0" v-model:open="discontinuedMedsOpen">
            <CollapsibleTrigger class="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
              <ChevronRight class="size-3.5 transition-transform" :class="discontinuedMedsOpen ? 'rotate-90' : ''" />
              Discontinued ({{ discontinuedMeds.length }})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="mt-2 flex flex-col gap-2">
                <div
                  v-for="med in discontinuedMeds"
                  :key="med.uuid"
                  class="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5"
                >
                  <div class="flex-1 min-w-0">
                    <span class="text-sm text-muted-foreground line-through">{{ med.drug_name }}</span>
                    <p v-if="med.discontinue_reason" class="mt-0.5 text-xs text-muted-foreground">
                      {{ med.discontinue_reason }}
                    </p>
                    <span v-if="med.started_date" class="mt-0.5 block text-xs text-muted-foreground">
                      Since {{ formatDate(med.started_date) }}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" class="size-6 shrink-0" title="Delete" @click="deleteMedication(med.uuid)">
                    <Trash2 class="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter class="justify-end">
          <Button variant="secondary" @click="openAddMed">
            <Plus class="size-4 mr-1" />
            Add Medication
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Lifestyle Modal -->
    <Dialog v-model:open="showLifestyleModal">
      <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Activity class="size-5" />
            Lifestyle &amp; Risk Factors
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-3">
          <!-- Loading -->
          <div v-if="lifestyleLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- View mode -->
          <template v-else-if="!lifestyleEditing">
            <div v-if="!hasLifestyleData" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
              <Activity class="size-10 text-muted-foreground/30" />
              <p class="text-sm font-medium text-muted-foreground">No lifestyle data recorded</p>
              <p class="max-w-sm text-xs text-muted-foreground/70">Record smoking, alcohol, exercise, diet, and medication adherence for cardiovascular risk assessment.</p>
            </div>
            <div v-else class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <div v-for="item in lifestyleDisplayItems" :key="item.label" class="flex flex-col gap-0.5">
                <span class="text-xs text-muted-foreground">{{ item.label }}</span>
                <span class="text-sm font-medium">{{ item.value }}</span>
              </div>
            </div>
          </template>

          <!-- Edit mode -->
          <template v-else>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <!-- Smoking -->
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs">
                  <Cigarette class="size-3.5 text-muted-foreground" />
                  Smoking Status
                </Label>
                <Select
                  :model-value="lifestyle.smoking ?? ''"
                  @update:model-value="(v) => { lifestyle.smoking = (v || null) as LifestyleData['smoking'] }"
                >
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="former">Former</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Pack years (conditional) -->
              <div v-if="showPackYears" class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs">
                  <Cigarette class="size-3.5 text-muted-foreground" />
                  Pack Years
                </Label>
                <Input
                  :model-value="lifestyle.pack_years ?? undefined"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 10"
                  class="h-8 text-sm"
                  @update:model-value="(v) => lifestyle.pack_years = v ? Number(v) : null"
                />
              </div>

              <!-- Alcohol -->
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs">
                  <Wine class="size-3.5 text-muted-foreground" />
                  Alcohol Use
                </Label>
                <Select
                  :model-value="lifestyle.alcohol ?? ''"
                  @update:model-value="(v) => { lifestyle.alcohol = (v || null) as LifestyleData['alcohol'] }"
                >
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="heavy">Heavy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Exercise -->
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs">
                  <Activity class="size-3.5 text-muted-foreground" />
                  Physical Activity
                </Label>
                <Select
                  :model-value="lifestyle.exercise ?? ''"
                  @update:model-value="(v) => { lifestyle.exercise = (v || null) as LifestyleData['exercise'] }"
                >
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="vigorous">Vigorous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Diet -->
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs">
                  <Salad class="size-3.5 text-muted-foreground" />
                  Diet Quality
                </Label>
                <Select
                  :model-value="lifestyle.diet ?? ''"
                  @update:model-value="(v) => { lifestyle.diet = (v || null) as LifestyleData['diet'] }"
                >
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Medication adherence -->
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs">
                  <Pill class="size-3.5 text-muted-foreground" />
                  Medication Adherence
                </Label>
                <Select
                  :model-value="lifestyle.medication_adherence ?? ''"
                  @update:model-value="(v) => { lifestyle.medication_adherence = (v || null) as LifestyleData['medication_adherence'] }"
                >
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_adherent">Non-adherent</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="adherent">Adherent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </template>
        </div>

        <DialogFooter class="justify-end">
          <template v-if="lifestyleEditing">
            <Button variant="ghost" @click="lifestyleEditing = false">
              Cancel
            </Button>
            <Button :disabled="lifestyleSaving" @click="saveLifestyle">
              <LoaderCircle v-if="lifestyleSaving" class="size-4 mr-1 animate-spin" />
              Save
            </Button>
          </template>
          <Button v-else-if="!lifestyleLoading" variant="secondary" @click="lifestyleEditing = true">
            <Pencil class="size-4 mr-1" />
            Edit Lifestyle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Family History Modal -->
    <Dialog v-model:open="showFamilyModal">
      <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Users class="size-5" />
            Family History
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-2">
          <!-- Loading -->
          <div v-if="isLoadingFamilyHistory" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- Empty -->
          <div v-else-if="familyHistory.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <Users class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No family history recorded</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Document family medical history including conditions, age of onset, and status for hereditary risk screening.</p>
          </div>

          <!-- Entries -->
          <div
            v-else
            v-for="entry in familyHistory"
            :key="entry.uuid"
            class="flex items-start gap-3 rounded-lg border bg-card p-3"
          >
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-1.5">
                <span class="text-sm font-semibold">{{ relativeLabels[entry.relative] ?? entry.relative }}</span>
                <span v-if="entry.alive" class="inline-flex items-center gap-1 text-xs text-green-600">
                  <span class="inline-block size-1.5 rounded-full bg-green-500" />
                  Alive
                </span>
                <span v-else class="text-xs text-muted-foreground">
                  Deceased
                  <template v-if="entry.age_at_death">(age {{ entry.age_at_death }}<template v-if="entry.cause_of_death">, {{ entry.cause_of_death }}</template>)</template>
                </span>
              </div>
              <div v-if="entry.conditions.length" class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="(cond, i) in entry.conditions"
                  :key="i"
                  variant="secondary"
                  class="text-xs font-normal"
                >
                  {{ cond.name }}<template v-if="cond.age_of_onset"> (age {{ cond.age_of_onset }})</template>
                </Badge>
              </div>
              <p v-if="entry.notes" class="mt-1.5 text-xs text-muted-foreground">{{ entry.notes }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="size-6"
                title="Edit"
                @click="openEditRelative(entry)"
              >
                <Pencil class="size-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-6"
                title="Delete"
                @click="deleteFamilyEntry(entry.uuid)"
              >
                <Trash2 class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter class="justify-end">
          <Button variant="secondary" @click="openAddRelative">
            <Plus class="size-4 mr-1" />
            Add Relative
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Preventive Care Modal -->
    <Dialog v-model:open="showPreventiveModal">
      <DialogContent class="sm:max-w-5xl min-h-[40vh] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <ClipboardCheck class="size-5" />
            Preventive Care
            <span v-if="overdueScreenings.length" class="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-normal text-red-600">
              {{ overdueScreenings.length }} overdue
            </span>
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-3">
          <!-- Loading -->
          <div v-if="isLoadingPreventive" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- Empty -->
          <div v-else-if="preventiveCare.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <ClipboardCheck class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No screenings recorded</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Track cancer, cardiovascular, and metabolic screenings with due dates and results.</p>
          </div>

          <!-- Grouped by category -->
          <template v-else>
            <div
              v-for="group in groupedByCategory"
              :key="group.category"
              class="flex flex-col gap-1.5"
            >
              <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {{ categoryLabels[group.category] ?? group.category }}
              </p>
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="item in group.items"
                  :key="item.key"
                  class="flex items-start gap-2 rounded-lg border p-2.5"
                  :class="item.status === 'overdue' ? 'border-l-[3px] border-l-red-400 bg-red-50/40' : 'bg-card'"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-sm font-medium">{{ item.name }}</span>
                      <Badge
                        variant="outline"
                        class="text-[10px] px-1.5 py-0"
                        :class="preventiveStatusClass(item.status)"
                      >
                        {{ preventiveStatusLabel(item.status) }}
                      </Badge>
                    </div>
                    <div class="mt-0.5 flex flex-wrap items-center gap-2">
                      <span v-if="item.last_done_date" class="text-xs text-muted-foreground">
                        Last: {{ formatDate(item.last_done_date) }}
                      </span>
                      <span v-if="item.next_due_date" class="text-xs text-muted-foreground">
                        Due: {{ formatDate(item.next_due_date) }}
                      </span>
                      <span v-if="item.result && item.status === 'completed'" class="text-xs text-muted-foreground">
                        · {{ item.result }}
                      </span>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm" variant="outline" class="h-7 px-2 text-xs"
                      @click="openRecordScreening(item)"
                    >
                      <Plus class="size-3.5" />
                      {{ item.status === 'completed' ? 'Update' : 'Record' }}
                    </Button>
                    <Button
                      v-if="item.recorded_uuid"
                      size="sm" variant="ghost" class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="Remove record"
                      @click="deleteScreening(item.recorded_uuid, item.key)"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Patient Trends Modal -->
    <Dialog v-model:open="showTrendsModal">
      <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <TrendingUp class="size-5" />
            Patient Trends
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-4">
          <!-- Loading -->
          <div v-if="trendsLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- Empty -->
          <div v-else-if="!trendsData || (!trendsData.bp?.length && !trendsData.blood_sugar?.length && !trendsData.weight?.length && !trendsData.bmi?.length)" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <TrendingUp class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No trend data available</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Trends are generated from finalized consultations. BP, blood sugar, weight, and BMI are tracked over time.</p>
          </div>

          <!-- Chart -->
          <template v-else>
            <!-- Tab buttons -->
            <div class="flex gap-1 rounded-lg border bg-muted/40 p-1">
              <button
                v-for="tab in trendTabs"
                :key="tab.key"
                type="button"
                class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                :class="activeTrendTab === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                @click="activeTrendTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>

            <!-- Chart -->
            <VChart
              :option="trendsChartOption"
              autoresize
              style="height: 350px; width: 100%;"
            />

            <!-- Latest reading -->
            <div v-if="activeTrendTab === 'bp' && trendsData.bp?.length" class="flex items-center gap-2 text-sm">
              <span class="text-muted-foreground">Latest:</span>
              <span class="font-semibold">{{ trendsData.bp[trendsData.bp.length - 1]?.systolic }}/{{ trendsData.bp[trendsData.bp.length - 1]?.diastolic }} mmHg</span>
              <span v-if="trendsData.bp[trendsData.bp.length - 1]?.classification" class="text-xs" :style="{ color: classificationColor(trendsData.bp[trendsData.bp.length - 1]!.classification!) }">
                {{ trendsData.bp[trendsData.bp.length - 1]?.classification }}
              </span>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Family History Dialog -->
    <Dialog v-model:open="showFamilyHistoryDialog">
      <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ editingFamilyEntry ? 'Edit Relative' : 'Add Relative' }}</DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <!-- Relative -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Relative</Label>
            <Select v-model="familyForm.relative">
              <SelectTrigger class="h-9 text-sm">
                <SelectValue placeholder="Select relative..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="father">Father</SelectItem>
                <SelectItem value="mother">Mother</SelectItem>
                <SelectItem value="sibling">Sibling</SelectItem>
                <SelectItem value="paternal_grandfather">Pat. Grandfather</SelectItem>
                <SelectItem value="paternal_grandmother">Pat. Grandmother</SelectItem>
                <SelectItem value="maternal_grandfather">Mat. Grandfather</SelectItem>
                <SelectItem value="maternal_grandmother">Mat. Grandmother</SelectItem>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Conditions -->
          <div class="flex flex-col gap-2">
            <Label class="text-xs">Conditions</Label>
            <div
              v-for="(cond, i) in familyForm.conditions"
              :key="i"
              class="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div class="flex items-center gap-2">
                <Input
                  v-model="cond.name"
                  placeholder="Condition name"
                  class="h-8 text-sm flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0"
                  :disabled="familyForm.conditions.length <= 1"
                  @click="removeConditionRow(i)"
                >
                  <svg class="size-3.5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex flex-col gap-1">
                  <Label class="text-[10px] text-muted-foreground">ICD Code (optional)</Label>
                  <Input
                    v-model="cond.icd_code"
                    placeholder="e.g. I10"
                    class="h-7 text-xs font-mono"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <Label class="text-[10px] text-muted-foreground">Age of Onset</Label>
                  <Input
                    :model-value="cond.age_of_onset ?? undefined"
                    type="number"
                    min="0"
                    placeholder="Age"
                    class="h-7 text-xs"
                    @update:model-value="(v) => cond.age_of_onset = v ? Number(v) : null"
                  />
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-7 w-full text-xs gap-1.5"
              @click="addConditionRow"
            >
              <Plus class="size-3.5" />
              Add Condition
            </Button>
          </div>

          <!-- Alive toggle -->
          <div class="flex items-center justify-between">
            <Label class="text-xs">Alive</Label>
            <Switch v-model:checked="familyForm.alive" />
          </div>

          <!-- Deceased fields -->
          <template v-if="!familyForm.alive">
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Age at Death</Label>
                <Input
                  :model-value="familyForm.age_at_death ?? undefined"
                  type="number"
                  min="0"
                  placeholder="Age"
                  class="h-8 text-sm"
                  @update:model-value="(v) => familyForm.age_at_death = v ? Number(v) : null"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Cause of Death</Label>
                <Input
                  v-model="familyForm.cause_of_death"
                  placeholder="e.g. Stroke"
                  class="h-8 text-sm"
                />
              </div>
            </div>
          </template>

          <!-- Notes -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Notes (optional)</Label>
            <Textarea
              v-model="familyForm.notes"
              placeholder="Additional notes..."
              class="min-h-16 text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showFamilyHistoryDialog = false">
            Cancel
          </Button>
          <Button
            size="sm"
            :disabled="isSavingFamilyHistory || !familyForm.relative"
            @click="saveFamilyHistory"
          >
            <LoaderCircle v-if="isSavingFamilyHistory" class="size-3 animate-spin mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Medication Add/Edit Dialog -->
    <Dialog v-model:open="showMedDialog">
      <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ editingMed ? 'Edit Medication' : 'Add Medication' }}</DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <!-- Drug name -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Drug Name <span class="text-destructive">*</span></Label>
            <Input v-model="medForm.drug_name" placeholder="e.g. Losartan 50mg" class="h-9 text-sm" />
          </div>

          <!-- Dose + Frequency -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Dose</Label>
              <Input v-model="medForm.dose" placeholder="e.g. 50mg" class="h-8 text-sm" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Frequency</Label>
              <Select v-model="medForm.frequency">
                <SelectTrigger class="h-8 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OD">OD</SelectItem>
                  <SelectItem value="BID">BID</SelectItem>
                  <SelectItem value="TID">TID</SelectItem>
                  <SelectItem value="QID">QID</SelectItem>
                  <SelectItem value="Q4H">Q4H</SelectItem>
                  <SelectItem value="Q6H">Q6H</SelectItem>
                  <SelectItem value="Q8H">Q8H</SelectItem>
                  <SelectItem value="Q12H">Q12H</SelectItem>
                  <SelectItem value="PRN">PRN</SelectItem>
                  <SelectItem value="STAT">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Route + Indication -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Route</Label>
              <Select v-model="medForm.route">
                <SelectTrigger class="h-8 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PO">PO</SelectItem>
                  <SelectItem value="IV">IV</SelectItem>
                  <SelectItem value="IM">IM</SelectItem>
                  <SelectItem value="SC">SC</SelectItem>
                  <SelectItem value="SL">SL</SelectItem>
                  <SelectItem value="topical">Topical</SelectItem>
                  <SelectItem value="inhaled">Inhaled</SelectItem>
                  <SelectItem value="rectal">Rectal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Indication</Label>
              <Input v-model="medForm.indication" placeholder="e.g. Hypertension" class="h-8 text-sm" />
            </div>
          </div>

          <!-- Start date + Status -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Start Date</Label>
              <Input v-model="medForm.started_date" type="date" class="h-8 text-sm" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Status</Label>
              <Select v-model="medForm.status">
                <SelectTrigger class="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Notes -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Notes (optional)</Label>
            <Textarea v-model="medForm.notes" placeholder="Additional notes..." class="min-h-16 text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showMedDialog = false">Cancel</Button>
          <Button size="sm" :disabled="isSavingMed || !medForm.drug_name.trim()" @click="saveMedication">
            <LoaderCircle v-if="isSavingMed" class="size-3 animate-spin mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Discontinue Medication Dialog -->
    <Dialog v-model:open="showDiscontinueDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Discontinue {{ discontinuingMed?.drug_name }}?</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-3 py-2">
          <p class="text-sm text-muted-foreground">This medication will be moved to the discontinued list.</p>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Reason (optional)</Label>
            <Textarea v-model="discontinueReason" placeholder="e.g. Side effects, goal achieved..." class="min-h-16 text-sm resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showDiscontinueDialog = false">Cancel</Button>
          <Button size="sm" variant="destructive" :disabled="discontinuing" @click="confirmDiscontinue">
            <LoaderCircle v-if="discontinuing" class="size-3 animate-spin mr-1" />
            Discontinue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Record Screening Dialog -->
    <Dialog v-model:open="showPreventiveDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingScreening?.name }}</DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <!-- Status -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Status</Label>
            <Select
              :model-value="screeningForm.status"
              @update:model-value="(v) => { screeningForm.status = v as 'completed' | 'declined' | 'not_applicable' }"
            >
              <SelectTrigger class="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="not_applicable">Not Applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Date performed (completed only) -->
          <div v-if="screeningForm.status === 'completed'" class="flex flex-col gap-1.5">
            <Label class="text-xs">Date Performed</Label>
            <Input
              v-model="screeningForm.lastDoneDate"
              type="date"
              class="h-9 text-sm"
            />
          </div>

          <!-- Result (completed only) -->
          <div v-if="screeningForm.status === 'completed'" class="flex flex-col gap-1.5">
            <Label class="text-xs">Result (optional)</Label>
            <Input
              v-model="screeningForm.result"
              placeholder="e.g. Normal, Negative..."
              class="h-9 text-sm"
            />
          </div>

          <!-- Notes -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Notes (optional)</Label>
            <Textarea
              v-model="screeningForm.notes"
              placeholder="Additional notes..."
              class="min-h-16 text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showPreventiveDialog = false">Cancel</Button>
          <Button size="sm" :disabled="isSavingPreventive" @click="saveScreening">
            <LoaderCircle v-if="isSavingPreventive" class="size-3 animate-spin mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>
