<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  CalendarDays,
  Weight,
  Leaf,
  ShieldCheck,
  LoaderCircle,
  FlaskConical,
  Baby,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import type { Pregnancy } from '../types/obgyn.types'
import type { CreatePregnancyPayload } from '../api/obgynApi'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  patientId: string
  pregnancy?: Pregnancy
}>()

const emit = defineEmits<{
  saved: [pregnancy: Pregnancy]
  cancel: []
}>()

const store = usePatientDetailStore()
const showRiskOverride = ref(false)
const isEvaluatingRisk = ref(false)
const evaluatedRisk = ref<{ level: string; factors: string[] } | null>(null)

async function evaluateRisk(): Promise<void> {
  isEvaluatingRisk.value = true
  try {
    const res = await store.evaluateRisk({
      pre_pregnancy_weight: form.pre_pregnancy_weight,
      height: form.height,
      medical_conditions: form.medical_conditions || null,
      fetus_count: form.fetus_count,
      smoking: form.smoking || null,
      alcohol: form.alcohol || null,
      pregnancy_id: props.pregnancy?.id ?? null,
    })
    evaluatedRisk.value = res
    // Auto-set form values from evaluation
    form.risk_level = res.level as typeof form.risk_level
    form.risk_factors = res.factors.join('\n')
  } catch {
    toast.error('Failed to evaluate risk')
  } finally {
    isEvaluatingRisk.value = false
  }
}

// Past diagnoses suggestions + auto-populate blood type from patient
const pastDiagnoses = ref<{ description: string; code: string | null }[]>([])

onMounted(async () => {
  // Past diagnoses already loaded in store by parent
  pastDiagnoses.value = store.pastDiagnoses
})

interface FormState {
  // Dating
  lmp: string
  edd: string
  edd_source: 'lmp' | 'ultrasound' | 'adjusted' | ''
  first_ultrasound_date: string
  first_ultrasound_ga_weeks: number | null
  first_ultrasound_ga_days: number | null
  // Fetus
  fetus_count: number
  fetuses: { label: string; sex: 'male' | 'female' | 'unknown' }[]
  // Medical history
  medical_conditions: string
  surgical_history: string
  // Social
  smoking: 'never' | 'former' | 'current' | ''
  alcohol: 'never' | 'occasional' | 'regular' | ''
  ipv_screened: boolean
  // Baseline
  pre_pregnancy_weight: number | null
  height: number | null
  // Risk
  risk_level: 'low' | 'high' | ''
  risk_factors: string
}

function buildInitialState(): FormState {
  const p = props.pregnancy as any
  return {
    lmp: p?.lmp ?? '',
    edd: p?.edd ?? '',
    edd_source: p?.edd_source ?? '',
    first_ultrasound_date: p?.first_ultrasound_date ?? '',
    first_ultrasound_ga_weeks: parseGAWeeks(p?.first_ultrasound_ga),
    first_ultrasound_ga_days: parseGADays(p?.first_ultrasound_ga),
    fetus_count: p?.fetus_count ?? 1,
    fetuses: p?.fetuses?.length ? [...p.fetuses] : [{ label: 'Baby', sex: 'unknown' as const }],
    medical_conditions: Array.isArray(p?.medical_conditions) ? p.medical_conditions.join('\n') : (p?.medical_conditions ?? ''),
    surgical_history: p?.surgical_history ?? '',
    smoking: p?.smoking ?? '',
    alcohol: p?.alcohol ?? '',
    ipv_screened: p?.ipv_screened ?? false,
    pre_pregnancy_weight: p?.pre_pregnancy_weight ?? null,
    height: p?.height ?? null,
    risk_level: p?.risk_level ?? '',
    risk_factors: Array.isArray(p?.risk_factors) ? p.risk_factors.join('\n') : '',
  }
}

const form = reactive<FormState>(buildInitialState())

// Re-populate form when pregnancy prop loads asynchronously
watch(
  () => props.pregnancy,
  (p) => {
    if (!p) return
    Object.assign(form, buildInitialState())
  },
)

// Sync fetuses array when fetus_count changes
watch(
  () => form.fetus_count,
  (count) => {
    const labels = ['Baby', 'Baby A', 'Baby B', 'Baby C', 'Baby D', 'Baby E', 'Baby F', 'Baby G', 'Baby H']
    if (count <= 1) {
      form.fetuses = [{ label: 'Baby', sex: form.fetuses[0]?.sex ?? 'unknown' }]
      return
    }
    const updated: { label: string; sex: 'male' | 'female' | 'unknown' }[] = []
    for (let i = 0; i < count; i++) {
      updated.push({
        label: form.fetuses[i]?.label ?? labels[i + 1] ?? `Baby ${String.fromCharCode(65 + i)}`,
        sex: form.fetuses[i]?.sex ?? 'unknown',
      })
    }
    form.fetuses = updated
  },
)

// Parse GA string like "15w3d" into weeks/days
function parseGAWeeks(ga: string | null | undefined): number | null {
  if (!ga) return null
  const match = ga.match(/^(\d+)w/)
  return match ? parseInt(match[1]!) : null
}
function parseGADays(ga: string | null | undefined): number | null {
  if (!ga) return null
  const match = ga.match(/(\d+)d$/)
  return match ? parseInt(match[1]!) : null
}

// Computed EDD from LMP (Naegele's rule: LMP + 280 days)
const lmpEdd = computed(() => {
  if (!form.lmp) return null
  const lmpDate = new Date(form.lmp)
  if (isNaN(lmpDate.getTime())) return null
  return new Date(lmpDate.getTime() + 280 * 86400000).toISOString().slice(0, 10)
})

// Computed EDD from Ultrasound (US date + (280 - GA_days))
const ultrasoundEdd = computed(() => {
  if (!form.first_ultrasound_date || form.first_ultrasound_ga_weeks === null) return null
  const usDate = new Date(form.first_ultrasound_date)
  if (isNaN(usDate.getTime())) return null
  const gaDays = form.first_ultrasound_ga_weeks * 7 + (form.first_ultrasound_ga_days ?? 0)
  if (gaDays <= 0) return null
  return new Date(usDate.getTime() + (280 - gaDays) * 86400000).toISOString().slice(0, 10)
})

// Sync form.edd when source or computed values change
function selectEddSource(source: 'lmp' | 'ultrasound'): void {
  form.edd_source = source
  const edd = source === 'lmp' ? lmpEdd.value : ultrasoundEdd.value
  if (edd) form.edd = edd
}

// Auto-update EDD when inputs change for the selected source
watch(lmpEdd, (edd) => {
  if (form.edd_source === 'lmp' && edd) form.edd = edd
})
watch(ultrasoundEdd, (edd) => {
  if (form.edd_source === 'ultrasound' && edd) form.edd = edd
})

// Auto-select source when first data is entered
watch(() => form.lmp, (lmp) => {
  if (lmp && !form.edd_source) selectEddSource('lmp')
})

const bmi = computed(() => {
  if (!form.pre_pregnancy_weight || !form.height || form.height <= 0) return null
  return form.pre_pregnancy_weight / Math.pow(form.height / 100, 2)
})

const recommendedWeightGain = computed((): { min: number; max: number } | null => {
  if (!bmi.value) return null
  if (bmi.value < 18.5) return { min: 12.5, max: 18 }
  if (bmi.value < 25) return { min: 11.5, max: 16 }
  if (bmi.value < 30) return { min: 7, max: 11.5 }
  return { min: 5, max: 9 }
})

const bmiCategory = computed(() => {
  if (!bmi.value) return null
  if (bmi.value < 18.5) return 'Underweight'
  if (bmi.value < 25) return 'Normal weight'
  if (bmi.value < 30) return 'Overweight'
  return 'Obese'
})

function addDiagnosisToMedical(description: string): void {
  const current = form.medical_conditions.trim()
  if (current.toLowerCase().includes(description.toLowerCase())) return // already added
  form.medical_conditions = current ? `${current}\n${description}` : description
}

// Filter out diagnoses already in medical conditions
const availableSuggestions = computed(() =>
  pastDiagnoses.value.filter(
    (d) => !form.medical_conditions.toLowerCase().includes(d.description.toLowerCase()),
  ),
)

function formatDateStr(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Difference in days between LMP and Ultrasound EDD
const eddDiffDays = computed(() => {
  if (!lmpEdd.value || !ultrasoundEdd.value) return null
  return Math.abs(Math.round((new Date(ultrasoundEdd.value).getTime() - new Date(lmpEdd.value).getTime()) / 86400000))
})

const eddDisplay = computed(() => {
  if (!form.edd) return null
  const d = new Date(form.edd)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
})

async function handleSubmit(): Promise<void> {
  const payload: CreatePregnancyPayload = {
    lmp: form.lmp || null,
    edd: form.edd || null,
    edd_source: (form.edd_source as 'lmp' | 'ultrasound' | 'adjusted') || null,
    first_ultrasound_date: form.first_ultrasound_date || null,
    first_ultrasound_ga: form.first_ultrasound_ga_weeks !== null ? `${form.first_ultrasound_ga_weeks}w${form.first_ultrasound_ga_days ?? 0}d` : null,
    fetus_count: form.fetus_count,
    fetuses: form.fetuses,
    pre_pregnancy_weight: form.pre_pregnancy_weight,
    height: form.height,
    medical_conditions: form.medical_conditions || null,
    surgical_history: form.surgical_history || null,
    ...(form.smoking ? { smoking: form.smoking } : {}),
    ...(form.alcohol ? { alcohol: form.alcohol } : {}),
    ipv_screened: form.ipv_screened,
    risk_level: form.risk_level || null,
    risk_factors: form.risk_factors
      ? form.risk_factors.split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
  }

  let result: Pregnancy
  if (props.pregnancy) {
    result = await store.updatePregnancy(props.pregnancy.id, payload)
  } else {
    result = await store.createPregnancy(payload)
  }
  emit('saved', result)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- A. Pregnancy Dating -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <CalendarDays class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pregnancy Dating
        </h3>
      </div>

      <p class="text-xs text-muted-foreground">Select a dating method to determine the estimated due date.</p>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <!-- LMP Card -->
        <button
          type="button"
          class="flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-all"
          :class="form.edd_source === 'lmp'
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border hover:border-primary/40'"
          @click="selectEddSource('lmp')"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">Last Menstrual Period</span>
            <div
              class="flex size-5 items-center justify-center rounded-full border-2 transition-colors"
              :class="form.edd_source === 'lmp' ? 'border-primary bg-primary' : 'border-muted-foreground/30'"
            >
              <div v-if="form.edd_source === 'lmp'" class="size-2 rounded-full bg-white" />
            </div>
          </div>
          <div class="flex flex-col gap-2" @click.stop>
            <Label class="text-xs text-muted-foreground">LMP Date</Label>
            <MFDatePicker
              v-model="form.lmp"
              disable-future
              :min-date="new Date(Date.now() - 308 * 86400000).toISOString().slice(0, 10)"
              class="h-8 text-sm"
            />
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">EDD</span>
            <span class="font-semibold" :class="form.edd_source === 'lmp' ? 'text-primary' : 'text-foreground'">
              {{ lmpEdd ? formatDateStr(lmpEdd) : '—' }}
            </span>
          </div>
        </button>

        <!-- Ultrasound Card -->
        <button
          type="button"
          class="flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-all"
          :class="form.edd_source === 'ultrasound'
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border hover:border-primary/40'"
          @click="selectEddSource('ultrasound')"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">Ultrasound Dating</span>
            <div
              class="flex size-5 items-center justify-center rounded-full border-2 transition-colors"
              :class="form.edd_source === 'ultrasound' ? 'border-primary bg-primary' : 'border-muted-foreground/30'"
            >
              <div v-if="form.edd_source === 'ultrasound'" class="size-2 rounded-full bg-white" />
            </div>
          </div>
          <div class="flex flex-col gap-2" @click.stop>
            <Label class="text-xs text-muted-foreground">Ultrasound Date</Label>
            <MFDatePicker v-model="form.first_ultrasound_date" disable-future class="h-8 text-sm" />
          </div>
          <div class="flex flex-col gap-2" @click.stop>
            <Label class="text-xs text-muted-foreground">GA at Ultrasound</Label>
            <div class="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="44"
                placeholder="Wk"
                :model-value="form.first_ultrasound_ga_weeks ?? ''"
                class="h-8 w-20 text-sm"
                @update:model-value="(v) => form.first_ultrasound_ga_weeks = v ? Number(v) : null"
                @blur="() => { if (form.first_ultrasound_ga_weeks !== null && form.first_ultrasound_ga_weeks > 44) form.first_ultrasound_ga_weeks = 44 }"
              />
              <span class="text-xs text-muted-foreground">w</span>
              <Input
                type="number"
                min="0"
                max="6"
                placeholder="D"
                :model-value="form.first_ultrasound_ga_days ?? ''"
                class="h-8 w-16 text-sm"
                @update:model-value="(v) => form.first_ultrasound_ga_days = v ? Number(v) : null"
                @blur="() => { if (form.first_ultrasound_ga_days !== null && form.first_ultrasound_ga_days > 6) form.first_ultrasound_ga_days = 6 }"
              />
              <span class="text-xs text-muted-foreground">d</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">EDD</span>
            <span class="font-semibold" :class="form.edd_source === 'ultrasound' ? 'text-primary' : 'text-foreground'">
              {{ ultrasoundEdd ? formatDateStr(ultrasoundEdd) : '—' }}
            </span>
          </div>
        </button>
      </div>

      <!-- EDD difference notice -->
      <div v-if="eddDiffDays && eddDiffDays > 0 && lmpEdd && ultrasoundEdd" class="rounded-md border px-3 py-2 text-xs" :class="eddDiffDays > 7 ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400' : 'bg-muted/50 text-muted-foreground'">
        LMP and Ultrasound EDDs differ by <span class="font-semibold">{{ eddDiffDays }} days</span>.
        <span v-if="eddDiffDays > 7"> Consider using the ultrasound EDD for more accurate dating.</span>
      </div>

      <!-- Active EDD summary -->
      <div v-if="form.edd" class="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
        <CalendarDays class="size-4 shrink-0 text-muted-foreground" />
        <span class="text-muted-foreground">Active EDD:</span>
        <span class="font-semibold">{{ eddDisplay }}</span>
        <Badge variant="outline" class="text-[10px]">{{ form.edd_source === 'ultrasound' ? 'Ultrasound' : 'LMP' }}</Badge>
      </div>
    </section>

    <Separator />

    <!-- B. Fetus Information -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <Baby class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Fetus
        </h3>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="fetus-count" class="text-xs">Number of Fetuses</Label>
          <Select
            :model-value="String(form.fetus_count)"
            @update:model-value="(v) => { form.fetus_count = Number(v) }"
          >
            <SelectTrigger class="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — Singleton</SelectItem>
              <SelectItem value="2">2 — Twins</SelectItem>
              <SelectItem value="3">3 — Triplets</SelectItem>
              <SelectItem value="4">4 — Quadruplets</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Sex per fetus -->
        <div v-for="(fetus, idx) in form.fetuses" :key="idx" class="flex flex-col gap-1.5">
          <Label class="text-xs">{{ form.fetus_count > 1 ? fetus.label + ' Sex' : 'Sex' }}</Label>
            <Select
              :model-value="fetus.sex"
              @update:model-value="(v) => { const fet = form.fetuses[idx]; if (fet) fet.sex = v as 'male' | 'female' | 'unknown' }"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>
    </section>

    <Separator />

    <!-- C. Medical & Surgical History -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <FlaskConical class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Medical &amp; Surgical History
        </h3>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="medical_conditions" class="text-xs">Medical Conditions</Label>
          <Textarea
            id="medical_conditions"
            v-model="form.medical_conditions"
            placeholder="e.g. Hypertension, Diabetes, Thyroid disorder..."
            class="min-h-20 resize-none text-sm"
          />
          <div v-if="availableSuggestions.length > 0" class="flex flex-col gap-1.5">
            <span class="text-[10px] text-muted-foreground">From past consultations:</span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="dx in availableSuggestions"
                :key="dx.description"
                type="button"
                class="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-[11px] transition-colors hover:border-primary hover:bg-primary/10"
                @click="addDiagnosisToMedical(dx.description)"
              >
                <span>+ {{ dx.description }}</span>
                <span v-if="dx.code" class="font-mono text-[9px] text-muted-foreground">{{ dx.code }}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="surgical_history" class="text-xs">Surgical History</Label>
          <Textarea
            id="surgical_history"
            v-model="form.surgical_history"
            placeholder="e.g. Appendectomy 2018, Cesarean section..."
            class="min-h-20 resize-none text-sm"
          />
        </div>
      </div>
    </section>

    <Separator />

    <!-- D. Social & Lifestyle -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <Leaf class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Social &amp; Lifestyle
        </h3>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <Label for="smoking" class="text-xs">Smoking</Label>
          <Select
            :model-value="form.smoking"
            @update:model-value="(v) => { form.smoking = v as typeof form.smoking }"
          >
            <SelectTrigger id="smoking" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never</SelectItem>
              <SelectItem value="former">Former</SelectItem>
              <SelectItem value="current">Current</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="alcohol" class="text-xs">Alcohol</Label>
          <Select
            :model-value="form.alcohol"
            @update:model-value="(v) => { form.alcohol = v as typeof form.alcohol }"
          >
            <SelectTrigger id="alcohol" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never</SelectItem>
              <SelectItem value="occasional">Occasional</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs">IPV Screened</Label>
          <div class="flex h-8 items-center gap-2">
            <Switch
              id="ipv_screened"
              :checked="form.ipv_screened"
              @update:checked="(v) => (form.ipv_screened = v)"
            />
            <Label for="ipv_screened" class="cursor-pointer text-sm">
              {{ form.ipv_screened ? 'Yes' : 'No' }}
            </Label>
          </div>
        </div>
      </div>
    </section>

    <Separator />

    <!-- E. Baseline Measurements -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <Weight class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Baseline Measurements
        </h3>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex flex-col gap-1.5">
          <Label for="pre_weight" class="text-xs">Pre-pregnancy Weight (kg)</Label>
          <Input
            id="pre_weight"
            :model-value="form.pre_pregnancy_weight ?? undefined"
            type="number"
            min="30"
            max="200"
            step="0.1"
            placeholder="e.g. 58.5"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.pre_pregnancy_weight = v ? Number(v) : null)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="height" class="text-xs">Height (cm)</Label>
          <Input
            id="height"
            :model-value="form.height ?? undefined"
            type="number"
            min="100"
            max="220"
            step="0.1"
            placeholder="e.g. 160"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.height = v ? Number(v) : null)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs">Pre-pregnancy BMI</Label>
          <div class="flex h-8 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            <template v-if="bmi">
              {{ bmi.toFixed(1) }}
              <span class="ml-1 text-xs">({{ bmiCategory }})</span>
            </template>
            <template v-else>—</template>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs">Recommended Weight Gain</Label>
          <div class="flex h-8 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            <template v-if="recommendedWeightGain">
              {{ recommendedWeightGain.min }}–{{ recommendedWeightGain.max }} kg
            </template>
            <template v-else>—</template>
          </div>
        </div>
      </div>
    </section>

    <Separator />

    <!-- F. Risk Classification -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <ShieldCheck class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Risk Classification
        </h3>
      </div>

      <!-- Evaluate button -->
      <Button
        variant="outline"
        size="sm"
        class="w-fit"
        :disabled="isEvaluatingRisk"
        @click="evaluateRisk"
      >
        <LoaderCircle v-if="isEvaluatingRisk" class="size-3.5 animate-spin" />
        <ShieldCheck v-else class="size-3.5" />
        {{ isEvaluatingRisk ? 'Evaluating...' : (evaluatedRisk || pregnancy?.risk_level) ? 'Re-evaluate Risk' : 'Calculate Risk' }}
      </Button>

      <!-- Risk result display -->
      <div v-if="(evaluatedRisk || pregnancy?.risk_level) && !showRiskOverride" class="flex flex-col gap-3">
        <div class="flex items-center gap-3 rounded-md border px-4 py-3" :class="(evaluatedRisk?.level ?? pregnancy?.risk_level) === 'high' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950' : 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950'">
          <div class="flex size-8 items-center justify-center rounded-full" :class="(evaluatedRisk?.level ?? pregnancy?.risk_level) === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'">
            <ShieldCheck class="size-4" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold" :class="(evaluatedRisk?.level ?? pregnancy?.risk_level) === 'high' ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'">
              {{ (evaluatedRisk?.level ?? pregnancy?.risk_level) === 'high' ? 'High Risk' : 'Low Risk' }}
            </p>
            <p class="text-xs text-muted-foreground">Based on patient profile and pregnancy data</p>
          </div>
          <Button variant="ghost" size="sm" class="shrink-0 text-xs" @click="showRiskOverride = true">
            Override
          </Button>
        </div>
        <!-- Risk factors -->
        <div v-if="(evaluatedRisk?.factors ?? pregnancy?.risk_factors)?.length" class="flex flex-col gap-1.5">
          <span class="text-xs text-muted-foreground">Detected risk factors:</span>
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="factor in (evaluatedRisk?.factors ?? pregnancy?.risk_factors)"
              :key="factor"
              variant="outline"
              class="text-[11px]"
              :class="(evaluatedRisk?.level ?? pregnancy?.risk_level) === 'high' ? 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400' : ''"
            >
              {{ factor }}
            </Badge>
          </div>
        </div>
        <p v-else class="text-xs text-green-600 dark:text-green-400">No risk factors detected.</p>
      </div>

      <!-- Manual override -->
      <div v-if="showRiskOverride" class="flex flex-col gap-3">
        <div class="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span>Manual override — risk will not auto-compute on save</span>
          <button type="button" class="font-medium text-primary underline" @click="showRiskOverride = false">Cancel override</button>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label for="risk_level" class="text-xs">Risk Level</Label>
            <Select
              :model-value="form.risk_level"
              @update:model-value="(v) => { form.risk_level = v as typeof form.risk_level }"
            >
              <SelectTrigger id="risk_level" class="h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="risk_factors" class="text-xs">Risk Factors</Label>
            <Textarea
              id="risk_factors"
              v-model="form.risk_factors"
              placeholder="One factor per line..."
              class="min-h-20 resize-none text-sm"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 border-t pt-4">
      <Button variant="outline" :disabled="store.isSavingObgyn" @click="emit('cancel')">
        Cancel
      </Button>
      <Button :disabled="store.isSavingObgyn" @click="handleSubmit">
        <LoaderCircle v-if="store.isSavingObgyn" class="size-4 animate-spin" />
        {{ pregnancy ? 'Save Changes' : 'Create Pregnancy Record' }}
      </Button>
    </div>
  </div>
</template>
