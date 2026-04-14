<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
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
import PatientSectionWidget from '@/domains/patient/components/specialties/PatientSectionWidget.vue'
import { obgynApi } from '../api/obgynApi'
import type { GynProfile, Pregnancy } from '../types/obgyn.types'
import type { UpsertGynProfilePayload, CreatePregnancyPayload } from '../api/obgynApi'

const route = useRoute()
const patientId = computed(() => route.params.id as string)

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── GYN Profile ───────────────────────────────────────────────────────────
const gynProfile = ref<GynProfile | null>(null)
const isLoadingGyn = ref(false)
const showGynDialog = ref(false)
const isSavingGyn = ref(false)
const gynEditing = ref(false)

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
  last_pap_date: null,
  last_pap_result: null,
  hpv_status: null,
  screening_interval: null,
  current_contraception: null,
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

const gynWidgetDetail = computed(() => {
  if (!gynProfile.value) return 'Not recorded'
  return gpalString.value ?? 'Recorded'
})

function openGynDialog() {
  if (gynProfile.value) {
    gynForm.menarche_age = gynProfile.value.menarche_age
    gynForm.cycle_length = gynProfile.value.cycle_length
    gynForm.regularity = gynProfile.value.regularity
    gynForm.duration = gynProfile.value.duration
    gynForm.flow = gynProfile.value.flow
    gynForm.dysmenorrhea = gynProfile.value.dysmenorrhea
    gynForm.gravidity = gynProfile.value.gravidity
    gynForm.parity_term = gynProfile.value.parity_term
    gynForm.parity_preterm = gynProfile.value.parity_preterm
    gynForm.abortions = gynProfile.value.abortions
    gynForm.living_children = gynProfile.value.living_children
    gynForm.last_pap_date = gynProfile.value.last_pap_date
    gynForm.last_pap_result = gynProfile.value.last_pap_result
    gynForm.hpv_status = gynProfile.value.hpv_status
    gynForm.screening_interval = gynProfile.value.screening_interval
    gynForm.current_contraception = gynProfile.value.current_contraception
      ? { ...gynProfile.value.current_contraception }
      : null
    gynEditing.value = false
  } else {
    gynEditing.value = true
  }
  showGynDialog.value = true
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

async function saveGynProfile() {
  isSavingGyn.value = true
  try {
    const res = await obgynApi.upsertGynProfile(patientId.value, { ...gynForm })
    gynProfile.value = res.data
    gynEditing.value = false
    toast.success('GYN profile saved')
  } catch {
    toast.error('Failed to save GYN profile')
  } finally {
    isSavingGyn.value = false
  }
}

// ── Pregnancies ───────────────────────────────────────────────────────────
const pregnancies = ref<Pregnancy[]>([])
const isLoadingPreg = ref(false)
const showPregDialog = ref(false)
const showAddPregDialog = ref(false)
const isSavingPreg = ref(false)
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

const pregForm = reactive<CreatePregnancyPayload>({
  lmp: null,
  edd: null,
  edd_source: null,
  gravidity: null,
  parity_term: null,
  parity_preterm: null,
  abortions: null,
  living_children: null,
  pre_pregnancy_weight: null,
  risk_factors: [],
})

function resetPregForm() {
  pregForm.lmp = null
  pregForm.edd = null
  pregForm.edd_source = null
  pregForm.gravidity = null
  pregForm.parity_term = null
  pregForm.parity_preterm = null
  pregForm.abortions = null
  pregForm.living_children = null
  pregForm.pre_pregnancy_weight = null
  pregForm.risk_factors = []
}

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

async function savePregnancy() {
  isSavingPreg.value = true
  try {
    const res = await obgynApi.createPregnancy(patientId.value, { ...pregForm })
    pregnancies.value.unshift(res.data)
    showAddPregDialog.value = false
    resetPregForm()
    toast.success('Pregnancy record created')
  } catch {
    toast.error('Failed to create pregnancy record')
  } finally {
    isSavingPreg.value = false
  }
}

async function deletePregnancy(uuid: string) {
  deletingPregId.value = uuid
  try {
    await obgynApi.deletePregnancy(patientId.value, uuid)
    pregnancies.value = pregnancies.value.filter((p) => p.uuid !== uuid)
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
    case 'lost': return 'bg-red-100 text-red-600 border-red-200 hover:bg-red-100'
    default: return 'bg-muted text-muted-foreground border-border hover:bg-muted'
  }
}

function pregnancyStatusLabel(status: Pregnancy['status']): string {
  switch (status) {
    case 'active': return 'Active'
    case 'postpartum': return 'Postpartum'
    case 'delivered': return 'Delivered'
    case 'lost': return 'Lost'
    case 'inactive': return 'Inactive'
  }
}

// ── Cervical Screening (derived from GYN profile) ─────────────────────────
const cervicalWidgetDetail = computed(() => {
  const p = gynProfile.value
  if (!p || !p.last_pap_date) return 'Not recorded'
  const parts = [formatDate(p.last_pap_date)]
  if (p.last_pap_result) parts.push(p.last_pap_result)
  return parts.join(' · ')
})

// ── Contraception (derived from GYN profile) ──────────────────────────────
const contraceptionDetail = computed(() => {
  const cc = gynProfile.value?.current_contraception
  if (!cc?.method) return 'None recorded'
  return cc.method
})

// ── Contraception method input within GYN dialog ─────────────────────────
const contraMethodInput = computed({
  get() {
    return gynForm.current_contraception?.method ?? ''
  },
  set(val: string) {
    if (val) {
      gynForm.current_contraception = {
        method: val,
        started_date: gynForm.current_contraception?.started_date ?? null,
      }
    } else {
      gynForm.current_contraception = null
    }
  },
})

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(() => {
  if (!patientId.value) return
  loadGynProfile()
  loadPregnancies()
})
</script>

<template>
  <div class="contents">
    <!-- GYN Profile Widget -->
    <PatientSectionWidget
      :icon="Heart"
      icon-color="bg-pink-500/10 text-pink-600"
      title="GYN Profile"
      :detail="gynWidgetDetail"
      :loading="isLoadingGyn"
      @click="openGynDialog"
    />

    <!-- Pregnancies Widget -->
    <PatientSectionWidget
      :icon="Baby"
      icon-color="bg-purple-500/10 text-purple-600"
      title="Pregnancies"
      :detail="pregnancyWidgetDetail"
      :badge-text="pregBadgeText"
      badge-variant="secondary"
      :loading="isLoadingPreg"
      @click="showPregDialog = true"
    />

    <!-- Cervical Screening Widget -->
    <PatientSectionWidget
      :icon="ShieldCheck"
      icon-color="bg-teal-500/10 text-teal-600"
      title="Cervical Screening"
      :detail="cervicalWidgetDetail"
      :loading="isLoadingGyn"
      @click="openGynDialog"
    />

    <!-- Contraception Widget -->
    <PatientSectionWidget
      :icon="Pill"
      icon-color="bg-blue-500/10 text-blue-600"
      title="Contraception"
      :detail="contraceptionDetail"
      :loading="isLoadingGyn"
      @click="openGynDialog"
    />

    <!-- GYN Profile Dialog -->
    <Dialog v-model:open="showGynDialog">
      <DialogContent class="flex sm:max-w-2xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Heart class="size-5" />
            GYN Profile
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-4">
          <!-- Loading -->
          <div v-if="isLoadingGyn" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- View mode -->
          <template v-else-if="!gynEditing">
            <div v-if="!gynProfile" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
              <Heart class="size-10 text-muted-foreground/30" />
              <p class="text-sm font-medium text-muted-foreground">No GYN profile recorded</p>
              <p class="max-w-sm text-xs text-muted-foreground/70">Record menstrual history, GPAL, cervical screening, and contraception details.</p>
            </div>
            <div v-else class="flex flex-col gap-5">
              <!-- Menstrual History -->
              <div>
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Menstrual History</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  <div v-if="gynProfile.menarche_age !== null" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Menarche Age</span>
                    <span class="text-sm font-medium">{{ gynProfile.menarche_age }} yrs</span>
                  </div>
                  <div v-if="gynProfile.cycle_length !== null" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Cycle Length</span>
                    <span class="text-sm font-medium">{{ gynProfile.cycle_length }} days</span>
                  </div>
                  <div v-if="gynProfile.duration !== null" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Duration</span>
                    <span class="text-sm font-medium">{{ gynProfile.duration }} days</span>
                  </div>
                  <div v-if="gynProfile.regularity" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Regularity</span>
                    <span class="text-sm font-medium capitalize">{{ gynProfile.regularity }}</span>
                  </div>
                  <div v-if="gynProfile.flow" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Flow</span>
                    <span class="text-sm font-medium capitalize">{{ gynProfile.flow }}</span>
                  </div>
                  <div v-if="gynProfile.dysmenorrhea" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Dysmenorrhea</span>
                    <span class="text-sm font-medium capitalize">{{ gynProfile.dysmenorrhea }}</span>
                  </div>
                </div>
              </div>

              <!-- GPAL -->
              <div v-if="gpalString">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obstetric History</p>
                <span class="font-mono text-base font-semibold">{{ gpalString }}</span>
                <p class="mt-0.5 text-xs text-muted-foreground">G=Gravidity · P=Term · (Preterm) · (Abortions) · (Living)</p>
              </div>

              <!-- Cervical Screening -->
              <div v-if="gynProfile.last_pap_date || gynProfile.hpv_status">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cervical Screening</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  <div v-if="gynProfile.last_pap_date" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Last Pap</span>
                    <span class="text-sm font-medium">{{ formatDate(gynProfile.last_pap_date) }}</span>
                  </div>
                  <div v-if="gynProfile.last_pap_result" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Result</span>
                    <span class="text-sm font-medium">{{ gynProfile.last_pap_result }}</span>
                  </div>
                  <div v-if="gynProfile.hpv_status" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">HPV Status</span>
                    <span class="text-sm font-medium">{{ gynProfile.hpv_status }}</span>
                  </div>
                  <div v-if="gynProfile.screening_interval" class="flex flex-col gap-0.5">
                    <span class="text-xs text-muted-foreground">Screening Interval</span>
                    <span class="text-sm font-medium">{{ gynProfile.screening_interval }}</span>
                  </div>
                </div>
              </div>

              <!-- Contraception -->
              <div v-if="gynProfile.current_contraception">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Contraception</p>
                <span class="text-sm font-medium">{{ gynProfile.current_contraception.method }}</span>
                <span v-if="gynProfile.current_contraception.started_date" class="ml-2 text-xs text-muted-foreground">
                  since {{ formatDate(gynProfile.current_contraception.started_date) }}
                </span>
              </div>
            </div>
          </template>

          <!-- Edit mode -->
          <template v-else>
            <!-- Menstrual History -->
            <div>
              <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Menstrual History</p>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Menarche Age (yrs)</Label>
                  <Input
                    :model-value="gynForm.menarche_age ?? undefined"
                    type="number"
                    min="8"
                    max="20"
                    placeholder="e.g. 13"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.menarche_age = v ? Number(v) : null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Cycle Length (days)</Label>
                  <Input
                    :model-value="gynForm.cycle_length ?? undefined"
                    type="number"
                    min="21"
                    max="45"
                    placeholder="e.g. 28"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.cycle_length = v ? Number(v) : null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Duration (days)</Label>
                  <Input
                    :model-value="gynForm.duration ?? undefined"
                    type="number"
                    min="1"
                    max="10"
                    placeholder="e.g. 5"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.duration = v ? Number(v) : null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Regularity</Label>
                  <Select
                    :model-value="gynForm.regularity ?? ''"
                    @update:model-value="(v) => { gynForm.regularity = (v || null) as typeof gynForm.regularity }"
                  >
                    <SelectTrigger class="h-8 text-sm">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="irregular">Irregular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Flow</Label>
                  <Select
                    :model-value="gynForm.flow ?? ''"
                    @update:model-value="(v) => { gynForm.flow = (v || null) as typeof gynForm.flow }"
                  >
                    <SelectTrigger class="h-8 text-sm">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="heavy">Heavy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Dysmenorrhea</Label>
                  <Select
                    :model-value="gynForm.dysmenorrhea ?? ''"
                    @update:model-value="(v) => { gynForm.dysmenorrhea = (v || null) as typeof gynForm.dysmenorrhea }"
                  >
                    <SelectTrigger class="h-8 text-sm">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
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

            <!-- GPAL -->
            <div>
              <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obstetric History (GPAL)</p>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Gravidity (G)</Label>
                  <Input
                    :model-value="gynForm.gravidity ?? undefined"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.gravidity = v ? Number(v) : null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Term (P)</Label>
                  <Input
                    :model-value="gynForm.parity_term ?? undefined"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.parity_term = v ? Number(v) : null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Preterm</Label>
                  <Input
                    :model-value="gynForm.parity_preterm ?? undefined"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.parity_preterm = v ? Number(v) : null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Abortions (A)</Label>
                  <Input
                    :model-value="gynForm.abortions ?? undefined"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.abortions = v ? Number(v) : null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Living (L)</Label>
                  <Input
                    :model-value="gynForm.living_children ?? undefined"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.living_children = v ? Number(v) : null"
                  />
                </div>
              </div>
            </div>

            <!-- Cervical Screening -->
            <div>
              <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cervical Screening</p>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Last Pap Date</Label>
                  <Input
                    :model-value="gynForm.last_pap_date ?? ''"
                    type="date"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.last_pap_date = String(v) || null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Pap Result</Label>
                  <Input
                    :model-value="gynForm.last_pap_result ?? ''"
                    placeholder="e.g. Normal"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.last_pap_result = String(v) || null"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">HPV Status</Label>
                  <Input
                    :model-value="gynForm.hpv_status ?? ''"
                    placeholder="e.g. Negative"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.hpv_status = String(v) || null"
                  />
                </div>
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <Label class="text-xs">Screening Interval</Label>
                  <Input
                    :model-value="gynForm.screening_interval ?? ''"
                    placeholder="e.g. Every 3 years"
                    class="h-8 text-sm"
                    @update:model-value="(v) => gynForm.screening_interval = String(v) || null"
                  />
                </div>
              </div>
            </div>

            <!-- Contraception -->
            <div>
              <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Contraception</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Method</Label>
                  <Input
                    v-model="contraMethodInput"
                    placeholder="e.g. Oral contraceptive pills"
                    class="h-8 text-sm"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs">Start Date</Label>
                  <Input
                    :model-value="gynForm.current_contraception?.started_date ?? ''"
                    type="date"
                    class="h-8 text-sm"
                    :disabled="!gynForm.current_contraception"
                    @update:model-value="(v) => {
                      if (gynForm.current_contraception) {
                        gynForm.current_contraception.started_date = String(v) || null
                      }
                    }"
                  />
                </div>
              </div>
            </div>
          </template>
        </div>

        <DialogFooter class="justify-end">
          <template v-if="gynEditing">
            <Button variant="ghost" @click="gynEditing = gynProfile ? false : (showGynDialog = false)">
              Cancel
            </Button>
            <Button :disabled="isSavingGyn" @click="saveGynProfile">
              <LoaderCircle v-if="isSavingGyn" class="size-4 mr-1 animate-spin" />
              Save
            </Button>
          </template>
          <Button v-else-if="!isLoadingGyn" variant="secondary" @click="gynEditing = true">
            <Pencil class="size-4 mr-1" />
            Edit Profile
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
          <div
            v-else-if="activePregnancy"
            class="rounded-lg border-2 border-purple-200 bg-purple-50/50 p-3 mb-1"
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
              <Button
                variant="ghost"
                size="icon"
                class="size-6 shrink-0"
                title="Delete"
                @click="deletePregnancy(activePregnancy.uuid)"
              >
                <Trash2 class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <!-- Pregnancy list (non-active) -->
          <template v-if="pregnancies.length > 0">
            <template v-for="preg in pregnancies" :key="preg.uuid">
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
                :disabled="deletingPregId === preg.uuid"
                @click="deletePregnancy(preg.uuid)"
              >
                <LoaderCircle v-if="deletingPregId === preg.uuid" class="size-3.5 animate-spin" />
                <Trash2 v-else class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </template>
        </div>

        <DialogFooter class="justify-end">
          <Button variant="secondary" @click="showAddPregDialog = true">
            <Plus class="size-4 mr-1" />
            Add Pregnancy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add Pregnancy Dialog -->
    <Dialog v-model:open="showAddPregDialog">
      <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Pregnancy Record</DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <!-- LMP + EDD -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">LMP Date</Label>
              <Input
                :model-value="pregForm.lmp ?? ''"
                type="date"
                class="h-8 text-sm"
                @update:model-value="(v) => pregForm.lmp = String(v) || null"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">EDD</Label>
              <Input
                :model-value="pregForm.edd ?? ''"
                type="date"
                class="h-8 text-sm"
                @update:model-value="(v) => pregForm.edd = String(v) || null"
              />
            </div>
          </div>

          <!-- EDD source -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">EDD Source</Label>
            <Select
              :model-value="pregForm.edd_source ?? ''"
              @update:model-value="(v) => { pregForm.edd_source = (v || null) as typeof pregForm.edd_source }"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lmp">LMP</SelectItem>
                <SelectItem value="ultrasound">Ultrasound</SelectItem>
                <SelectItem value="adjusted">Adjusted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- GPAL -->
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obstetric History</p>
            <div class="grid grid-cols-5 gap-2">
              <div class="flex flex-col gap-1">
                <Label class="text-[10px] text-muted-foreground">G</Label>
                <Input
                  :model-value="pregForm.gravidity ?? undefined"
                  type="number" min="0" placeholder="0"
                  class="h-7 text-xs"
                  @update:model-value="(v) => pregForm.gravidity = v ? Number(v) : null"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-[10px] text-muted-foreground">Term</Label>
                <Input
                  :model-value="pregForm.parity_term ?? undefined"
                  type="number" min="0" placeholder="0"
                  class="h-7 text-xs"
                  @update:model-value="(v) => pregForm.parity_term = v ? Number(v) : null"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-[10px] text-muted-foreground">Preterm</Label>
                <Input
                  :model-value="pregForm.parity_preterm ?? undefined"
                  type="number" min="0" placeholder="0"
                  class="h-7 text-xs"
                  @update:model-value="(v) => pregForm.parity_preterm = v ? Number(v) : null"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-[10px] text-muted-foreground">Abort.</Label>
                <Input
                  :model-value="pregForm.abortions ?? undefined"
                  type="number" min="0" placeholder="0"
                  class="h-7 text-xs"
                  @update:model-value="(v) => pregForm.abortions = v ? Number(v) : null"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-[10px] text-muted-foreground">Living</Label>
                <Input
                  :model-value="pregForm.living_children ?? undefined"
                  type="number" min="0" placeholder="0"
                  class="h-7 text-xs"
                  @update:model-value="(v) => pregForm.living_children = v ? Number(v) : null"
                />
              </div>
            </div>
          </div>

          <!-- Pre-pregnancy weight -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Pre-pregnancy Weight (kg)</Label>
            <Input
              :model-value="pregForm.pre_pregnancy_weight ?? undefined"
              type="number"
              min="30"
              max="200"
              step="0.1"
              placeholder="e.g. 58.5"
              class="h-8 text-sm"
              @update:model-value="(v) => pregForm.pre_pregnancy_weight = v ? Number(v) : null"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showAddPregDialog = false">Cancel</Button>
          <Button size="sm" :disabled="isSavingPreg" @click="savePregnancy">
            <LoaderCircle v-if="isSavingPreg" class="size-3 animate-spin mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
