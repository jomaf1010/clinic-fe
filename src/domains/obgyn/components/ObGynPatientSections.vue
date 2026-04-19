<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RouteNames } from '@/router/routeNames'
import { toast } from 'vue-sonner'
import {
  Heart,
  Baby,
  ShieldCheck,
  Pill,
  LoaderCircle,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  ExternalLink,
  FileText,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import MenstrualCycleIcon from '@/components/icons/MenstrualCycleIcon.vue'
import PregnantIcon from '@/components/icons/PregnantIcon.vue'
import PregnantWeeksIcon from '@/components/icons/PregnantWeeksIcon.vue'
import CervicalScreeningIcon from '@/components/icons/CervicalScreeningIcon.vue'
import FamilyPlanningIcon from '@/components/icons/FamilyPlanningIcon.vue'
import PatientSectionWidget from '@/domains/patient/components/specialties/PatientSectionWidget.vue'
import ContraceptionDialog from './ContraceptionDialog.vue'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import type { GynProfile, Pregnancy, ContraceptiveEntry, ScreeningEntry } from '../types/obgyn.types'
import { contraceptionLabel, SCREENING_TYPE_OPTIONS, screeningTypeLabel } from '../types/obgyn.types'
import type { UpsertGynProfilePayload } from '../api/obgynApi'
import { useClinicalSummary } from '../composables/useClinicalSummary'

const route = useRoute()
const router = useRouter()
const patientId = computed(() => route.params.id as string)

const pdStore = usePatientDetailStore()

function navigateToPregnancy(pregnancyUuid: string) {
  showPregDialog.value = false
  const target = {
    name: RouteNames.PREGNANCY_DETAIL,
    params: { patientId: patientId.value, pregnancyId: pregnancyUuid },
  }
  console.log('[OB-GYN] Navigating to:', target)
  router.push(target).then(() => {
    console.log('[OB-GYN] Navigation succeeded')
  }).catch((err) => {
    console.error('[OB-GYN] Navigation failed:', err)
  })
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── GYN Profile ───────────────────────────────────────────────────────────
const gynProfile = computed(() => pdStore.gynProfile)
const isLoadingGyn = computed(() => pdStore.isLoadingObgyn)
const showMenstrualDialog = ref(false)
const showGpalDialog = ref(false)
const showScreeningDialog = ref(false)
const showContraceptionDialog = ref(false)
const isSavingGyn = ref(false)

const gynForm = reactive<UpsertGynProfilePayload>({
  menarche_age: null,
  cycle_length: null,
  regularity: null,
  duration: null,
  flow: null,
  dysmenorrhea: null,
  gravidity: null,
  parity_term: null,
  parity_preterm: null,
  abortions: null,
  living_children: null,
})

// Patient DOB for year range calculation
const patientDob = computed(() => pdStore.patient?.date_of_birth ?? null)
const earliestDeliveryYear = computed(() => {
  if (!patientDob.value) return 1970
  return new Date(patientDob.value).getFullYear() + 12 // earliest realistic pregnancy age
})

interface PrevPregRow {
  year: number | null
  outcome: string
  delivery_type: string
  complications: string
  sex: string
  birth_weight: number | null
}

function emptyPrevRow(): PrevPregRow {
  return { year: null, outcome: '', delivery_type: '', complications: '', sex: '', birth_weight: null }
}

const prevPregnancies = ref<PrevPregRow[]>([])

// Number of delivery rows = term + preterm (live births that need delivery details)
const prevPregCount = computed(() => {
  const t = gynForm.parity_term ?? 0
  const pt = gynForm.parity_preterm ?? 0
  return t + pt
})

// Sync rows when G changes
watch(prevPregCount, (count) => {
  while (prevPregnancies.value.length < count) prevPregnancies.value.push(emptyPrevRow())
  if (prevPregnancies.value.length > count) prevPregnancies.value.length = count
})

const gpalString = computed(() => {
  const p = gynProfile.value
  if (!p) return null
  const g = p.gravidity
  const pt = p.parity_term
  const pp = p.parity_preterm
  const a = p.abortions
  const l = p.living_children
  if (g === null && pt === null) return null
  return `G${g ?? 0}P(${pt ?? 0}-${pp ?? 0}-${a ?? 0}-${l ?? 0})`
})

const menstrualWidgetDetail = computed(() => {
  const p = gynProfile.value
  if (!p) return 'Not recorded'
  const parts: string[] = []
  if (p.cycle_length) parts.push(`${p.cycle_length}d cycle`)
  if (p.regularity) parts.push(p.regularity)
  if (p.flow) parts.push(p.flow)
  return parts.length ? parts.join(' · ') : 'Not recorded'
})

const gpalWidgetDetail = computed(() => {
  return gpalString.value ?? 'Not recorded'
})

function openMenstrualDialog() {
  if (gynProfile.value) {
    gynForm.menarche_age = gynProfile.value.menarche_age
    gynForm.cycle_length = gynProfile.value.cycle_length
    gynForm.regularity = gynProfile.value.regularity
    gynForm.duration = gynProfile.value.duration
    gynForm.flow = gynProfile.value.flow
    gynForm.dysmenorrhea = gynProfile.value.dysmenorrhea
  }
  showMenstrualDialog.value = true
}

function openGpalDialog() {
  if (gynProfile.value) {
    gynForm.gravidity = gynProfile.value.gravidity
    gynForm.parity_term = gynProfile.value.parity_term
    gynForm.parity_preterm = gynProfile.value.parity_preterm
    gynForm.abortions = gynProfile.value.abortions
    gynForm.living_children = gynProfile.value.living_children
    // Load existing previous pregnancies
    const existing = gynProfile.value.previous_pregnancies ?? []
    prevPregnancies.value = existing.map((p: Record<string, unknown>) => ({
      year: p.year as number | null ?? null,
      outcome: (p.outcome as string) ?? '',
      delivery_type: (p.delivery_type as string) ?? '',
      complications: (p.complications as string) ?? '',
      sex: (p.sex as string) ?? '',
      birth_weight: p.birth_weight as number | null ?? null,
    }))
    // Pad rows to match G
    const count = prevPregCount.value
    while (prevPregnancies.value.length < count) prevPregnancies.value.push(emptyPrevRow())
    if (prevPregnancies.value.length > count) prevPregnancies.value.length = count
  }
  showGpalDialog.value = true
}

async function saveMenstrualHistory() {
  isSavingGyn.value = true
  try {
    await pdStore.updateGynProfile({
      menarche_age: gynForm.menarche_age,
      cycle_length: gynForm.cycle_length,
      regularity: gynForm.regularity,
      duration: gynForm.duration,
      flow: gynForm.flow,
      dysmenorrhea: gynForm.dysmenorrhea,
    })
    showMenstrualDialog.value = false
  } catch {
    toast.error('Failed to save')
  } finally {
    isSavingGyn.value = false
  }
}

const gpalErrors = computed(() => {
  const errors: string[] = []
  const g = gynForm.gravidity ?? 0
  const t = gynForm.parity_term ?? 0
  const pt = gynForm.parity_preterm ?? 0
  const a = gynForm.abortions ?? 0
  const l = gynForm.living_children ?? 0
  if (g > 20) errors.push('Gravidity cannot exceed 20')
  if (g > 0 && (t + pt + a) > g) errors.push('Term + Preterm + Abortions cannot exceed Gravidity')
  if (l > (t + pt)) errors.push('Living children cannot exceed term + preterm deliveries')
  return errors
})

async function saveGpal() {
  isSavingGyn.value = true
  try {
    await pdStore.updateGynProfile({
      gravidity: gynForm.gravidity,
      parity_term: gynForm.parity_term,
      parity_preterm: gynForm.parity_preterm,
      abortions: gynForm.abortions,
      living_children: gynForm.living_children,
      previous_pregnancies: prevPregnancies.value.map((p) => ({
        year: p.year,
        outcome: p.outcome || null,
        delivery_type: p.delivery_type || null,
        complications: p.complications || null,
        sex: p.sex || null,
        birth_weight: p.birth_weight,
        notes: null,
      })),
    })
    showGpalDialog.value = false
  } catch {
    toast.error('Failed to save')
  } finally {
    isSavingGyn.value = false
  }
}

// ── Pregnancies ───────────────────────────────────────────────────────────
const pregnancies = computed(() => pdStore.pregnancies)
const isLoadingPreg = computed(() => pdStore.isLoadingObgyn)
const showPregDialog = ref(false)
const deletingPregId = ref<string | null>(null)

const activePregnancy = computed(() => pdStore.activePregnancy)

const postpartumPregnancy = computed(() => {
  if (activePregnancy.value) return null
  const sixWeeksMs = 42 * 24 * 60 * 60 * 1000
  return pregnancies.value.find((p) => {
    if (p.status !== 'delivered' && p.status !== 'postpartum') return false
    if (!p.delivered_at) return false
    return Date.now() - new Date(p.delivered_at).getTime() < sixWeeksMs
  }) ?? null
})

const pregnancyWidgetDetail = computed(() => {
  if (activePregnancy.value) {
    const ga = activePregnancy.value.current_ga
    if (ga) return `Active (${ga.weeks}w${ga.days}d)`
    return 'Active pregnancy'
  }
  if (postpartumPregnancy.value) {
    const days = Math.floor((Date.now() - new Date(postpartumPregnancy.value.delivered_at!).getTime()) / (24 * 60 * 60 * 1000))
    return `Postpartum (day ${days})`
  }
  const count = pregnancies.value.length
  return count > 0 ? `${count} previous` : 'None recorded'
})

const pregBadgeText = computed(() =>
  activePregnancy.value || postpartumPregnancy.value ? '1' : undefined,
)

async function deletePregnancy(uuid: string) {
  deletingPregId.value = uuid
  try {
    await pdStore.deletePregnancy(uuid)
  } catch {
    toast.error('Failed to delete pregnancy record')
  } finally {
    deletingPregId.value = null
  }
}

function pregnancyStatusClass(status: Pregnancy['status']): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
    case 'postpartum': return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100'
    case 'delivered': return 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100'
    case 'resolved': return 'bg-red-100 text-red-600 border-red-200 hover:bg-red-100'
    default: return 'bg-muted text-muted-foreground border-border hover:bg-muted'
  }
}

function pregnancyStatusLabel(status: Pregnancy['status']): string {
  switch (status) {
    case 'active': return 'Active'
    case 'postpartum': return 'Postpartum'
    case 'delivered': return 'Delivered'
    case 'resolved': return 'Resolved'
    case 'inactive': return 'Inactive'
  }
}

// ── Screenings (derived from GYN profile) ────────────────────────────────
const screeningWidgetDetail = computed(() => {
  const screenings = gynProfile.value?.screenings
  if (!screenings?.length) return 'No screenings recorded'
  const latest = screenings[screenings.length - 1]
  return `${screeningTypeLabel(latest.type)} — ${formatDate(latest.date)}`
})

const showAddScreeningForm = ref(false)
const newScreening = reactive<{ date: string; type: string; result: string; notes: string }>({
  date: '', type: '', result: '', notes: '',
})

function resetNewScreening() {
  newScreening.date = ''
  newScreening.type = ''
  newScreening.result = ''
  newScreening.notes = ''
  showAddScreeningForm.value = false
}

async function addScreening() {
  if (!newScreening.date || !newScreening.type) return
  const current = gynProfile.value?.screenings ?? []
  const updated = [...current, {
    date: newScreening.date,
    type: newScreening.type,
    result: newScreening.result || null,
    notes: newScreening.notes || null,
  }]
  // Sort by date descending
  updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  try {
    await pdStore.updateGynProfile({ screenings: updated })
    resetNewScreening()
  } catch {
    toast.error('Failed to add screening')
  }
}

const editingScreeningIndex = ref<number | null>(null)
const editScreening = reactive<{ result: string; notes: string }>({ result: '', notes: '' })

function startEditScreening(index: number) {
  const entry = gynProfile.value?.screenings?.[index]
  if (!entry) return
  editScreening.result = entry.result ?? ''
  editScreening.notes = entry.notes ?? ''
  editingScreeningIndex.value = index
}

function cancelEditScreening() {
  editingScreeningIndex.value = null
}

async function saveEditScreening() {
  const idx = editingScreeningIndex.value
  if (idx === null) return
  const current = gynProfile.value?.screenings ?? []
  const updated = current.map((e: ScreeningEntry, i: number) =>
    i === idx ? { ...e, result: editScreening.result || null, notes: editScreening.notes || null } : e,
  )
  try {
    await pdStore.updateGynProfile({ screenings: updated })
    editingScreeningIndex.value = null
  } catch {
    toast.error('Failed to update')
  }
}

async function removeScreening(index: number) {
  const current = gynProfile.value?.screenings ?? []
  const updated = current.filter((_: ScreeningEntry, i: number) => i !== index)
  try {
    await pdStore.updateGynProfile({ screenings: updated })
  } catch {
    toast.error('Failed to remove screening')
  }
}

// ── Contraception (derived from GYN profile) ──────────────────────────────
const contraceptionDetail = computed(() => {
  const entries = gynProfile.value?.contraception
  if (!entries?.length) return 'None recorded'
  const current = entries.filter((e: ContraceptiveEntry) => !e.end_date)
  if (current.length === 0) return 'None active'
  return current.flatMap((e: ContraceptiveEntry) => e.method.map(contraceptionLabel)).join(', ')
})

// ── Clinical Summary Narrative ────────────────────────────────────────────
const { clinicalSummary: gynNarrativeSummary } = useClinicalSummary(gynProfile, activePregnancy, gpalString)

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!patientId.value) return
  if (!pdStore.gynProfile) await pdStore.loadObgyn()
})
</script>

<template>
  <div class="contents">
    <!-- Menstrual Cycle Widget -->
    <PatientSectionWidget
      :icon="MenstrualCycleIcon"
      icon-color="bg-gradient-to-br from-pink-500 to-pink-600"
      title="Menstrual Cycle"
      :detail="menstrualWidgetDetail"
      :loading="isLoadingGyn"
      @click="openMenstrualDialog"
    />

    <!-- GPAL Widget -->
    <PatientSectionWidget
      :icon="PregnantIcon"
      icon-color="bg-gradient-to-br from-violet-500 to-violet-600"
      title="GPAL"
      :detail="gpalWidgetDetail"
      :loading="isLoadingGyn"
      @click="openGpalDialog"
    />

    <!-- Pregnancies Widget -->
    <PatientSectionWidget
      :icon="PregnantWeeksIcon"
      icon-color="bg-gradient-to-br from-purple-500 to-purple-600"
      title="Pregnancies"
      :detail="pregnancyWidgetDetail"
      :badge-text="pregBadgeText"
      badge-variant="secondary"
      :loading="isLoadingPreg"
      @click="showPregDialog = true"
    />

    <!-- Screenings Widget -->
    <PatientSectionWidget
      :icon="CervicalScreeningIcon"
      icon-color="bg-gradient-to-br from-teal-500 to-teal-600"
      title="Screenings"
      :detail="screeningWidgetDetail"
      :badge-text="gynProfile?.screenings?.length ? String(gynProfile.screenings.length) : undefined"
      badge-variant="secondary"
      :loading="isLoadingGyn"
      @click="showScreeningDialog = true"
    />

    <!-- Contraception Widget -->
    <PatientSectionWidget
      :icon="FamilyPlanningIcon"
      icon-color="bg-gradient-to-br from-blue-500 to-blue-600"
      title="Contraception"
      :detail="contraceptionDetail"
      :loading="isLoadingGyn"
      @click="showContraceptionDialog = true"
    />

    <!-- Clinical Summary — full-width card -->
    <div class="col-span-full rounded-xl border bg-card p-4">
      <div class="flex items-start gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-sm">
          <FileText class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-tight">Clinical Summary</p>
          <p v-if="gynNarrativeSummary" class="mt-1.5 text-xs leading-relaxed text-muted-foreground [&_b]:text-foreground [&_b]:font-semibold" v-html="gynNarrativeSummary" />
          <p v-else class="mt-1 text-xs text-muted-foreground/50 italic">
            Summary will appear as patient data is recorded.
          </p>
        </div>
      </div>
    </div>

    <!-- Manage Pregnancy — full-width button spanning all columns -->
    <Button
      v-if="activePregnancy"
      variant="outline"
      class="col-span-full h-auto justify-start gap-3 rounded-lg border-purple-200 bg-purple-50/50 px-4 py-3 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-400 dark:hover:bg-purple-900"
      @click="navigateToPregnancy(activePregnancy!.id)"
    >
      <Baby class="size-5 shrink-0" />
      <div class="flex flex-col items-start gap-0.5">
        <span class="text-sm font-semibold">Manage Pregnancy</span>
        <span class="text-xs font-normal text-purple-600/70 dark:text-purple-400/70">
          {{ activePregnancy.current_ga ? `${activePregnancy.current_ga.weeks}w${activePregnancy.current_ga.days}d — ${activePregnancy.current_ga.trimester}` : 'Active' }}
          <template v-if="activePregnancy.edd"> · EDD {{ formatDate(activePregnancy.edd) }}</template>
        </span>
      </div>
      <Badge
        v-if="activePregnancy.risk_level"
        variant="outline"
        class="ml-auto text-[10px]"
        :class="activePregnancy.risk_level === 'high' ? 'border-red-200 bg-red-50 text-red-700' : activePregnancy.risk_level === 'moderate' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'"
      >
        {{ activePregnancy.risk_level }} risk
      </Badge>
      <ExternalLink class="size-4 shrink-0 text-purple-400" />
    </Button>

    <!-- Manage Postpartum — shown for recently delivered pregnancies (within 6 weeks) -->
    <Button
      v-else-if="postpartumPregnancy"
      variant="outline"
      class="col-span-full h-auto justify-start gap-3 rounded-lg border-teal-200 bg-teal-50/50 px-4 py-3 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-400 dark:hover:bg-teal-900"
      @click="navigateToPregnancy(postpartumPregnancy!.id)"
    >
      <Baby class="size-5 shrink-0" />
      <div class="flex flex-col items-start gap-0.5">
        <span class="text-sm font-semibold">Manage Postpartum</span>
        <span class="text-xs font-normal text-teal-600/70 dark:text-teal-400/70">
          Day {{ Math.floor((Date.now() - new Date(postpartumPregnancy.delivered_at!).getTime()) / (24 * 60 * 60 * 1000)) }} postpartum
          <template v-if="postpartumPregnancy.outcome"> · {{ postpartumPregnancy.outcome.replace(/_/g, ' ') }}</template>
        </span>
      </div>
      <ExternalLink class="size-4 shrink-0 text-teal-400" />
    </Button>

    <!-- Menstrual Cycle Dialog -->
    <Dialog v-model:open="showMenstrualDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Heart class="size-5 text-pink-600" />
            Menstrual Cycle
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-3 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Menarche Age</Label>
              <Input
                :model-value="gynForm.menarche_age ?? ''"
                type="number"
                placeholder="yrs"
                class="h-8 text-sm"
                @update:model-value="(v) => gynForm.menarche_age = v ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Cycle Length</Label>
              <Input
                :model-value="gynForm.cycle_length ?? ''"
                type="number"
                placeholder="days"
                class="h-8 text-sm"
                @update:model-value="(v) => gynForm.cycle_length = v ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Duration</Label>
              <Input
                :model-value="gynForm.duration ?? ''"
                type="number"
                placeholder="days"
                class="h-8 text-sm"
                @update:model-value="(v) => gynForm.duration = v ? Number(v) : null"
              />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Regularity</Label>
              <Select :model-value="gynForm.regularity ?? undefined" @update:model-value="(v) => gynForm.regularity = v || null">
                <SelectTrigger class="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="irregular">Irregular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Flow</Label>
              <Select :model-value="gynForm.flow ?? undefined" @update:model-value="(v) => gynForm.flow = v || null">
                <SelectTrigger class="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Dysmenorrhea</Label>
              <Select :model-value="gynForm.dysmenorrhea ?? undefined" @update:model-value="(v) => gynForm.dysmenorrhea = v || null">
                <SelectTrigger class="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="showMenstrualDialog = false">Cancel</Button>
          <Button :disabled="isSavingGyn" @click="saveMenstrualHistory">
            <LoaderCircle v-if="isSavingGyn" class="size-4 animate-spin mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- GPAL Dialog -->
    <Dialog v-model:open="showGpalDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Baby class="size-5 text-violet-600" />
            Obstetric History (GPAL)
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <!-- GPAL display -->
          <div v-if="gpalString" class="rounded-md bg-muted/50 px-3 py-2 text-center">
            <span class="font-mono text-lg font-semibold">{{ gpalString }}</span>
            <p class="mt-0.5 text-xs text-muted-foreground">G · P · Preterm · Abortions · Living</p>
          </div>

          <div class="grid grid-cols-5 gap-2">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">G</Label>
              <Input
                :model-value="gynForm.gravidity ?? ''"
                type="number"
                min="0"
                max="20"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.gravidity = v !== '' && v != null ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">P (Term)</Label>
              <Input
                :model-value="gynForm.parity_term ?? ''"
                type="number"
                min="0"
                max="20"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.parity_term = v !== '' && v != null ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">Preterm</Label>
              <Input
                :model-value="gynForm.parity_preterm ?? ''"
                type="number"
                min="0"
                max="20"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.parity_preterm = v !== '' && v != null ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">A</Label>
              <Input
                :model-value="gynForm.abortions ?? ''"
                type="number"
                min="0"
                max="20"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.abortions = v !== '' && v != null ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">L</Label>
              <Input
                :model-value="gynForm.living_children ?? ''"
                type="number"
                min="0"
                max="20"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.living_children = v !== '' && v != null ? Number(v) : null"
              />
            </div>
          </div>
        </div>

        <!-- Previous Delivery Details (only for live births) -->
        <div v-if="prevPregCount > 0" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Previous Deliveries</h4>
            <span class="text-xs text-muted-foreground">{{ prevPregCount }} {{ prevPregCount === 1 ? 'delivery' : 'deliveries' }}</span>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="(row, idx) in prevPregnancies"
              :key="idx"
              class="grid grid-cols-3 items-end gap-2 rounded-md border bg-muted/20 px-3 py-2 sm:grid-cols-4"
            >
              <div class="flex flex-col gap-1">
                <Label class="text-[10px] text-muted-foreground">Delivery #{{ idx + 1 }} — Year</Label>
                <Select
                  :model-value="row.year ? String(row.year) : undefined"
                  @update:model-value="(v) => row.year = v ? Number(v) : null"
                >
                  <SelectTrigger class="h-7 text-xs">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="y in Array.from({ length: new Date().getFullYear() - earliestDeliveryYear + 1 }, (_, i) => new Date().getFullYear() - i)"
                      :key="y"
                      :value="String(y)"
                    >
                      {{ y }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-[10px] text-muted-foreground">Method</Label>
                <Select
                  :model-value="row.delivery_type || undefined"
                  @update:model-value="(v) => row.delivery_type = String(v ?? '')"
                >
                  <SelectTrigger class="h-7 text-xs">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nvd">NVD</SelectItem>
                    <SelectItem value="cs">C-Section</SelectItem>
                    <SelectItem value="vacuum">Vacuum</SelectItem>
                    <SelectItem value="forceps">Forceps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1 sm:col-span-2">
                <Label class="text-[10px] text-muted-foreground">Complications</Label>
                <Input
                  :model-value="row.complications"
                  placeholder="e.g. Preeclampsia, GDM..."
                  class="h-7 text-xs"
                  @update:model-value="(v) => row.complications = String(v)"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-if="gpalErrors.length > 0" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <ul class="list-inside list-disc text-xs text-destructive">
            <li v-for="err in gpalErrors" :key="err">{{ err }}</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="showGpalDialog = false">Cancel</Button>
          <Button :disabled="isSavingGyn || gpalErrors.length > 0" @click="saveGpal">
            <LoaderCircle v-if="isSavingGyn" class="size-4 animate-spin mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Pregnancies Dialog -->
    <Dialog v-model:open="showPregDialog">
      <DialogContent class="flex sm:max-w-2xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Baby class="size-5" />
            Pregnancies
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-2">
          <!-- Loading -->
          <div v-if="isLoadingPreg" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- Empty -->
          <div v-else-if="pregnancies.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <Baby class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No pregnancies recorded</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Track current and previous pregnancies, including gestational age, EDD, and prenatal visit history.</p>
          </div>

          <!-- Active pregnancy highlight -->
          <button
            v-else-if="activePregnancy"
            type="button"
            class="w-full rounded-lg border-2 border-purple-200 bg-purple-50/50 p-3 mb-1 text-left transition-colors hover:bg-purple-50 cursor-pointer"
            @click.stop="navigateToPregnancy(activePregnancy!.id)"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <Badge variant="outline" class="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-[10px] px-1.5 py-0">Active</Badge>
                  <span class="text-sm font-semibold">Current Pregnancy</span>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span v-if="activePregnancy.current_ga">
                    GA: <strong class="text-foreground">{{ activePregnancy.current_ga.weeks }}w{{ activePregnancy.current_ga.days }}d</strong>
                    ({{ activePregnancy.current_ga.trimester }})
                  </span>
                  <span v-if="activePregnancy.edd">
                    EDD: <strong class="text-foreground">{{ formatDate(activePregnancy.edd) }}</strong>
                  </span>
                  <span v-if="activePregnancy.weeks_to_edd !== null">
                    <strong class="text-foreground">{{ activePregnancy.weeks_to_edd }}</strong> weeks to EDD
                  </span>
                  <span v-if="activePregnancy.risk_level">
                    Risk: <strong :class="activePregnancy.risk_level === 'high' ? 'text-red-600' : 'text-green-600'">{{ activePregnancy.risk_level }}</strong>
                  </span>
                </div>
                <div v-if="activePregnancy.lmp" class="mt-1 text-xs text-muted-foreground">
                  LMP: {{ formatDate(activePregnancy.lmp) }}
                </div>
              </div>
              <ExternalLink class="size-4 text-muted-foreground shrink-0" />
            </div>
          </button>

          <!-- Postpartum pregnancy highlight -->
          <button
            v-else-if="postpartumPregnancy"
            type="button"
            class="w-full rounded-lg border-2 border-teal-200 bg-teal-50/50 p-3 mb-1 text-left transition-colors hover:bg-teal-50 cursor-pointer dark:border-teal-800 dark:bg-teal-950/50 dark:hover:bg-teal-900"
            @click.stop="navigateToPregnancy(postpartumPregnancy!.id)"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <Badge variant="outline" class="bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100 text-[10px] px-1.5 py-0 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800">Postpartum</Badge>
                  <span class="text-sm font-semibold">Postpartum Care</span>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Day <strong class="text-foreground">{{ Math.floor((Date.now() - new Date(postpartumPregnancy.delivered_at!).getTime()) / (24 * 60 * 60 * 1000)) }}</strong> postpartum
                  </span>
                  <span v-if="postpartumPregnancy.outcome">
                    Outcome: <strong class="text-foreground capitalize">{{ postpartumPregnancy.outcome.replace(/_/g, ' ') }}</strong>
                  </span>
                  <span v-if="postpartumPregnancy.delivery_type">
                    {{ postpartumPregnancy.delivery_type === 'cesarean' ? 'Cesarean' : 'Vaginal' }}
                  </span>
                </div>
              </div>
              <ExternalLink class="size-4 text-muted-foreground shrink-0" />
            </div>
          </button>

          <!-- Pregnancy list (non-active) -->
          <template v-if="pregnancies.length > 0">
            <template v-for="preg in pregnancies" :key="preg.id">
            <div
              v-if="preg.status !== 'active'"
              class="flex cursor-pointer items-start gap-2 rounded-lg border bg-card p-2.5 transition-colors hover:bg-muted/50"
              @click="navigateToPregnancy(preg.id)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <Badge
                    variant="outline"
                    class="text-[10px] px-1.5 py-0"
                    :class="pregnancyStatusClass(preg.status)"
                  >
                    {{ pregnancyStatusLabel(preg.status) }}
                  </Badge>
                  <span v-if="preg.edd" class="text-xs text-muted-foreground">
                    <CalendarDays class="size-3 inline mr-0.5" />EDD: {{ formatDate(preg.edd) }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span v-if="preg.lmp">LMP: {{ formatDate(preg.lmp) }}</span>
                  <span v-if="preg.gravidity !== null">G{{ preg.gravidity }}</span>
                </div>
              </div>
              <Button
                v-if="preg.status !== 'delivered' && !preg.delivery_encounter_id"
                variant="ghost"
                size="icon"
                class="size-6 shrink-0"
                title="Delete"
                :disabled="deletingPregId === preg.id"
                @click.stop="deletePregnancy(preg.id)"
              >
                <LoaderCircle v-if="deletingPregId === preg.id" class="size-3.5 animate-spin" />
                <Trash2 v-else class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </template>
          </template>
        </div>

        <DialogFooter class="justify-end">
          <Button v-if="!activePregnancy" variant="secondary" @click="router.push({ name: RouteNames.PREGNANCY_CREATE, params: { patientId: patientId } })">
            <Plus class="size-4 mr-1" />
            Add Pregnancy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Screenings Dialog -->
    <Dialog v-model:open="showScreeningDialog">
      <DialogContent class="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <ShieldCheck class="size-4 text-teal-600" />
            Screenings
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-3">
          <!-- Add form -->
          <div v-if="showAddScreeningForm" class="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Date</Label>
                <MFDatePicker v-model="newScreening.date" placeholder="Select date" disable-future class="h-8 text-sm" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Type</Label>
                <Select v-model="newScreening.type">
                  <SelectTrigger class="h-8 text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in SCREENING_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Result</Label>
              <Input v-model="newScreening.result" placeholder="e.g. NILM, ASCUS, HPV 16+" class="h-8 text-sm" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Notes</Label>
              <Textarea v-model="newScreening.notes" placeholder="Additional notes..." class="text-sm" :rows="2" />
            </div>
            <div class="flex justify-end gap-2">
              <Button variant="ghost" size="sm" @click="resetNewScreening">Cancel</Button>
              <Button size="sm" :disabled="!newScreening.date || !newScreening.type" @click="addScreening">Save</Button>
            </div>
          </div>

          <!-- Screening list -->
          <div v-if="!gynProfile?.screenings?.length && !showAddScreeningForm" class="py-8 text-center text-sm text-muted-foreground">
            No screenings recorded
          </div>

          <div v-for="(s, i) in (gynProfile?.screenings ?? [])" :key="i" class="rounded-lg border bg-card p-2.5">
            <!-- Viewing mode -->
            <template v-if="editingScreeningIndex !== i">
              <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <Badge variant="outline" class="text-[10px] px-1.5 py-0 border-teal-200 bg-teal-50 text-teal-700">
                      {{ screeningTypeLabel(s.type) }}
                    </Badge>
                    <span class="text-xs text-muted-foreground">{{ formatDate(s.date) }}</span>
                  </div>
                  <p v-if="s.result" class="text-sm font-medium">{{ s.result }}</p>
                  <p v-if="s.notes" class="text-xs text-muted-foreground mt-0.5">{{ s.notes }}</p>
                </div>
                <Button variant="ghost" size="icon" class="size-6 shrink-0" @click="startEditScreening(i)">
                  <Pencil class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </template>

            <!-- Editing mode -->
            <template v-else>
              <div class="flex flex-col gap-2.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" class="text-[10px] px-1.5 py-0 border-teal-200 bg-teal-50 text-teal-700">
                    {{ screeningTypeLabel(s.type) }}
                  </Badge>
                  <span class="text-xs text-muted-foreground">{{ formatDate(s.date) }}</span>
                </div>
                <div class="flex flex-col gap-2">
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs">Result</Label>
                    <Input v-model="editScreening.result" placeholder="e.g. NILM, ASCUS, HPV 16+" class="h-8 text-sm" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs">Notes</Label>
                    <Input v-model="editScreening.notes" placeholder="Additional notes..." class="h-8 text-sm" />
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="removeScreening(i)">
                    <Trash2 class="size-3.5 mr-1" />
                    Delete
                  </Button>
                  <div class="flex gap-2">
                    <Button variant="ghost" size="sm" @click="cancelEditScreening">Cancel</Button>
                    <Button size="sm" @click="saveEditScreening">Save</Button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <DialogFooter>
          <Button v-if="!showAddScreeningForm" variant="secondary" size="sm" @click="showAddScreeningForm = true">
            <Plus class="size-4 mr-1" />
            Add Screening
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Contraception Dialog -->
    <ContraceptionDialog v-model:open="showContraceptionDialog" />
  </div>
</template>
