<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
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
import { obgynApi } from '../api/obgynApi'
import type { GynProfile, Pregnancy, ContraceptiveEntry, ScreeningEntry } from '../types/obgyn.types'
import { CONTRACEPTION_OPTIONS, contraceptionLabel, SCREENING_TYPE_OPTIONS, screeningTypeLabel } from '../types/obgyn.types'
import type { UpsertGynProfilePayload } from '../api/obgynApi'
import { useClinicalSummary } from '../composables/useClinicalSummary'

const route = useRoute()
const router = useRouter()
const patientId = computed(() => route.params.id as string)

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
const gynProfile = ref<GynProfile | null>(null)
const isLoadingGyn = ref(false)
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

const gpalString = computed(() => {
  const p = gynProfile.value
  if (!p) return null
  const g = p.gravidity
  const pt = p.parity_term
  const pp = p.parity_preterm
  const a = p.abortions
  const l = p.living_children
  if (g === null && pt === null) return null
  return `G${g ?? 0}P${pt ?? 0}(${pp ?? 0})(${a ?? 0})(${l ?? 0})`
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
  }
  showGpalDialog.value = true
}

async function loadGynProfile() {
  isLoadingGyn.value = true
  try {
    const res = await obgynApi.getGynProfile(patientId.value)
    gynProfile.value = res.data
  } catch {
    // silently fail — profile may not exist yet
  } finally {
    isLoadingGyn.value = false
  }
}

async function saveMenstrualHistory() {
  isSavingGyn.value = true
  try {
    const res = await obgynApi.upsertGynProfile(patientId.value, {
      menarche_age: gynForm.menarche_age,
      cycle_length: gynForm.cycle_length,
      regularity: gynForm.regularity,
      duration: gynForm.duration,
      flow: gynForm.flow,
      dysmenorrhea: gynForm.dysmenorrhea,
    })
    gynProfile.value = res.data
    showMenstrualDialog.value = false
    toast.success('Menstrual history updated')
  } catch {
    toast.error('Failed to save')
  } finally {
    isSavingGyn.value = false
  }
}

async function saveGpal() {
  isSavingGyn.value = true
  try {
    const res = await obgynApi.upsertGynProfile(patientId.value, {
      gravidity: gynForm.gravidity,
      parity_term: gynForm.parity_term,
      parity_preterm: gynForm.parity_preterm,
      abortions: gynForm.abortions,
      living_children: gynForm.living_children,
    })
    gynProfile.value = res.data
    showGpalDialog.value = false
    toast.success('GPAL updated')
  } catch {
    toast.error('Failed to save')
  } finally {
    isSavingGyn.value = false
  }
}

// ── Pregnancies ───────────────────────────────────────────────────────────
const pregnancies = ref<Pregnancy[]>([])
const isLoadingPreg = ref(false)
const showPregDialog = ref(false)
const deletingPregId = ref<string | null>(null)

const activePregnancy = computed(() =>
  pregnancies.value.find((p) => p.status === 'active') ?? null,
)

const pregnancyWidgetDetail = computed(() => {
  if (activePregnancy.value) {
    const ga = activePregnancy.value.current_ga
    if (ga) return `Active (${ga.weeks}w${ga.days}d)`
    return 'Active pregnancy'
  }
  const count = pregnancies.value.length
  return count > 0 ? `${count} previous` : 'None recorded'
})

const pregBadgeText = computed(() =>
  activePregnancy.value ? '1' : undefined,
)

async function loadPregnancies() {
  isLoadingPreg.value = true
  try {
    const res = await obgynApi.listPregnancies(patientId.value)
    pregnancies.value = res.data
  } catch {
    // silently fail
  } finally {
    isLoadingPreg.value = false
  }
}

async function deletePregnancy(uuid: string) {
  deletingPregId.value = uuid
  try {
    await obgynApi.deletePregnancy(patientId.value, uuid)
    pregnancies.value = pregnancies.value.filter((p) => p.id !== uuid)
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
    const res = await obgynApi.upsertGynProfile(patientId.value, { screenings: updated })
    gynProfile.value = res.data
    resetNewScreening()
    toast.success('Screening record added')
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
    const res = await obgynApi.upsertGynProfile(patientId.value, { screenings: updated })
    gynProfile.value = res.data
    editingScreeningIndex.value = null
    toast.success('Screening updated')
  } catch {
    toast.error('Failed to update')
  }
}

async function removeScreening(index: number) {
  const current = gynProfile.value?.screenings ?? []
  const updated = current.filter((_: ScreeningEntry, i: number) => i !== index)
  try {
    const res = await obgynApi.upsertGynProfile(patientId.value, { screenings: updated })
    gynProfile.value = res.data
    toast.success('Screening removed')
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

const showAddContraceptionForm = ref(false)
const newContraception = reactive<{ method: string[]; start_date: string; end_date: string; notes: string }>({
  method: [], start_date: '', end_date: '', notes: '',
})

function toggleNewContraMethod(m: string) {
  const idx = newContraception.method.indexOf(m)
  if (idx === -1) newContraception.method.push(m)
  else newContraception.method.splice(idx, 1)
}

function resetNewContraception() {
  newContraception.method = []
  newContraception.start_date = ''
  newContraception.end_date = ''
  newContraception.notes = ''
  showAddContraceptionForm.value = false
}

async function addContraception() {
  if (!newContraception.method.length || !newContraception.start_date) return
  const current = gynProfile.value?.contraception ?? []
  const updated = [...current, {
    method: newContraception.method,
    start_date: newContraception.start_date,
    end_date: newContraception.end_date || null,
    notes: newContraception.notes || null,
  }]
  updated.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
  try {
    const res = await obgynApi.upsertGynProfile(patientId.value, { contraception: updated })
    gynProfile.value = res.data
    resetNewContraception()
    toast.success('Contraception record added')
  } catch {
    toast.error('Failed to add record')
  }
}

const editingContraceptionIndex = ref<number | null>(null)
const editContraception = reactive<{ end_date: string; notes: string }>({ end_date: '', notes: '' })

function startEditContraception(index: number) {
  const entry = gynProfile.value?.contraception?.[index]
  if (!entry) return
  editContraception.end_date = entry.end_date ?? ''
  editContraception.notes = entry.notes ?? ''
  editingContraceptionIndex.value = index
}

function cancelEditContraception() {
  editingContraceptionIndex.value = null
}

async function saveEditContraception() {
  const idx = editingContraceptionIndex.value
  if (idx === null) return
  const current = gynProfile.value?.contraception ?? []
  const updated = current.map((e: ContraceptiveEntry, i: number) =>
    i === idx ? { ...e, end_date: editContraception.end_date || null, notes: editContraception.notes || null } : e,
  )
  try {
    const res = await obgynApi.upsertGynProfile(patientId.value, { contraception: updated })
    gynProfile.value = res.data
    editingContraceptionIndex.value = null
    toast.success('Record updated')
  } catch {
    toast.error('Failed to update')
  }
}

async function removeContraception(index: number) {
  const current = gynProfile.value?.contraception ?? []
  const updated = current.filter((_: ContraceptiveEntry, i: number) => i !== index)
  try {
    const res = await obgynApi.upsertGynProfile(patientId.value, { contraception: updated })
    gynProfile.value = res.data
    toast.success('Record removed')
  } catch {
    toast.error('Failed to remove record')
  }
}

// ── Clinical Summary Narrative ────────────────────────────────────────────
const { clinicalSummary: gynNarrativeSummary } = useClinicalSummary(gynProfile, activePregnancy, gpalString)

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(() => {
  if (!patientId.value) return
  loadGynProfile()
  loadPregnancies()
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
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.gravidity = v ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">P (Term)</Label>
              <Input
                :model-value="gynForm.parity_term ?? ''"
                type="number"
                min="0"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.parity_term = v ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">Preterm</Label>
              <Input
                :model-value="gynForm.parity_preterm ?? ''"
                type="number"
                min="0"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.parity_preterm = v ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">A</Label>
              <Input
                :model-value="gynForm.abortions ?? ''"
                type="number"
                min="0"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.abortions = v ? Number(v) : null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-center">L</Label>
              <Input
                :model-value="gynForm.living_children ?? ''"
                type="number"
                min="0"
                class="h-8 text-sm text-center"
                @update:model-value="(v) => gynForm.living_children = v ? Number(v) : null"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="showGpalDialog = false">Cancel</Button>
          <Button :disabled="isSavingGyn" @click="saveGpal">
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

          <!-- Pregnancy list (non-active) -->
          <template v-if="pregnancies.length > 0">
            <template v-for="preg in pregnancies" :key="preg.id">
            <div
              v-if="preg.status !== 'active'"
              class="flex items-start gap-2 rounded-lg border bg-card p-2.5"
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
                variant="ghost"
                size="icon"
                class="size-6 shrink-0"
                title="Delete"
                :disabled="deletingPregId === preg.id"
                @click="deletePregnancy(preg.id)"
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
    <Dialog v-model:open="showContraceptionDialog">
      <DialogContent class="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Pill class="size-4 text-blue-600" />
            Contraception
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-3">
          <!-- Add form -->
          <div v-if="showAddContraceptionForm" class="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Methods</Label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="opt in CONTRACEPTION_OPTIONS.filter(o => o.value !== 'none')"
                  :key="opt.value"
                  type="button"
                  class="rounded-full border px-2.5 py-1 text-xs transition-colors"
                  :class="newContraception.method.includes(opt.value) ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium' : 'hover:bg-muted/50'"
                  @click="toggleNewContraMethod(opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Start Date</Label>
                <MFDatePicker v-model="newContraception.start_date" placeholder="Start date" disable-future class="h-8 text-sm" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">End Date <span class="text-muted-foreground">(empty = current)</span></Label>
                <MFDatePicker v-model="newContraception.end_date" placeholder="Still using" disable-future class="h-8 text-sm" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Notes</Label>
              <Input v-model="newContraception.notes" placeholder="e.g. Side effects, reason stopped..." class="h-8 text-sm" />
            </div>
            <div class="flex justify-end gap-2">
              <Button variant="ghost" size="sm" @click="resetNewContraception">Cancel</Button>
              <Button size="sm" :disabled="!newContraception.method.length || !newContraception.start_date" @click="addContraception">Save</Button>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="!gynProfile?.contraception?.length && !showAddContraceptionForm" class="py-8 text-center text-sm text-muted-foreground">
            No contraception recorded
          </div>

          <!-- Entry list -->
          <div v-for="(c, i) in (gynProfile?.contraception ?? [])" :key="i" class="rounded-lg border bg-card p-2.5">
            <!-- Viewing mode -->
            <template v-if="editingContraceptionIndex !== i">
              <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-1 mb-0.5">
                    <Badge
                      v-for="m in c.method"
                      :key="m"
                      variant="outline"
                      class="text-[10px] px-1.5 py-0"
                      :class="!c.end_date ? 'border-blue-200 bg-blue-50 text-blue-700' : ''"
                    >
                      {{ contraceptionLabel(m) }}
                    </Badge>
                    <span v-if="!c.end_date" class="text-[10px] font-medium text-blue-600">Active</span>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {{ formatDate(c.start_date) }} — {{ c.end_date ? formatDate(c.end_date) : 'Present' }}
                  </p>
                  <p v-if="c.notes" class="text-xs text-muted-foreground mt-0.5">{{ c.notes }}</p>
                </div>
                <Button variant="ghost" size="icon" class="size-6 shrink-0" @click="startEditContraception(i)">
                  <Pencil class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </template>

            <!-- Editing mode -->
            <template v-else>
              <div class="flex flex-col gap-2.5">
                <div class="flex flex-wrap items-center gap-1">
                  <Badge v-for="m in c.method" :key="m" variant="outline" class="text-[10px] px-1.5 py-0">
                    {{ contraceptionLabel(m) }}
                  </Badge>
                  <span class="text-xs text-muted-foreground">from {{ formatDate(c.start_date) }}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs">End Date</Label>
                    <MFDatePicker v-model="editContraception.end_date" placeholder="Still using" disable-future class="h-8 text-sm" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs">Notes</Label>
                    <Input v-model="editContraception.notes" placeholder="Reason stopped..." class="h-8 text-sm" />
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="removeContraception(i)">
                    <Trash2 class="size-3.5 mr-1" />
                    Delete
                  </Button>
                  <div class="flex gap-2">
                    <Button variant="ghost" size="sm" @click="cancelEditContraception">Cancel</Button>
                    <Button size="sm" @click="saveEditContraception">Save</Button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <DialogFooter>
          <Button v-if="!showAddContraceptionForm" variant="secondary" size="sm" @click="showAddContraceptionForm = true">
            <Plus class="size-4 mr-1" />
            Add Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
