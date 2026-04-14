<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  CalendarDays,
  Weight,
  HeartPulse,
  Leaf,
  ShieldCheck,
  LoaderCircle,
  FlaskConical,
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
import { usePregnancyStore } from '../stores/pregnancyStore'
import type { Pregnancy } from '../types/obgyn.types'
import type { CreatePregnancyPayload } from '../api/obgynApi'

const props = defineProps<{
  patientId: string
  pregnancy?: Pregnancy
}>()

const emit = defineEmits<{
  saved: [pregnancy: Pregnancy]
  cancel: []
}>()

const store = usePregnancyStore()

interface FormState {
  // Dating
  lmp: string
  edd: string
  edd_source: 'lmp' | 'ultrasound' | 'adjusted' | ''
  first_ultrasound_date: string
  first_ultrasound_ga: string
  // GPAL
  gravidity: number | null
  parity_term: number | null
  parity_preterm: number | null
  abortions: number | null
  living_children: number | null
  // Medical history
  medical_conditions: string
  surgical_history: string
  blood_type: string
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
    first_ultrasound_ga: p?.first_ultrasound_ga ?? '',
    gravidity: p?.gravidity ?? null,
    parity_term: p?.parity_term ?? null,
    parity_preterm: p?.parity_preterm ?? null,
    abortions: p?.abortions ?? null,
    living_children: p?.living_children ?? null,
    medical_conditions: p?.medical_conditions ?? '',
    surgical_history: p?.surgical_history ?? '',
    blood_type: p?.blood_type_rh ?? '',
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

// Parse GA string like "15w3d" or "15w" into total days
function parseGAToDays(ga: string): number | null {
  const match = ga.match(/^(\d+)w(?:(\d+)d)?$/)
  if (!match) return null
  return parseInt(match[1]!) * 7 + parseInt(match[2] ?? '0')
}

// Auto-calculate EDD from LMP (when source is lmp)
watch(
  () => form.lmp,
  (lmp) => {
    if (!lmp || form.edd_source === 'ultrasound' || form.edd_source === 'adjusted') return
    const lmpDate = new Date(lmp)
    if (isNaN(lmpDate.getTime())) return
    const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000)
    form.edd = eddDate.toISOString().split('T')[0]!
    if (!form.edd_source) form.edd_source = 'lmp'
  },
)

// Auto-calculate EDD from ultrasound (when source is ultrasound)
// EDD = ultrasound_date + (280 - GA_in_days)
watch(
  () => [form.edd_source, form.first_ultrasound_date, form.first_ultrasound_ga],
  () => {
    if (form.edd_source !== 'ultrasound') return
    if (!form.first_ultrasound_date || !form.first_ultrasound_ga) return
    const usDate = new Date(form.first_ultrasound_date)
    if (isNaN(usDate.getTime())) return
    const gaDays = parseGAToDays(form.first_ultrasound_ga)
    if (gaDays === null) return
    const remainingDays = 280 - gaDays
    const eddDate = new Date(usDate.getTime() + remainingDays * 24 * 60 * 60 * 1000)
    form.edd = eddDate.toISOString().split('T')[0]!
  },
)

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
    first_ultrasound_ga: form.first_ultrasound_ga || null,
    gravidity: form.gravidity,
    parity_term: form.parity_term,
    parity_preterm: form.parity_preterm,
    abortions: form.abortions,
    living_children: form.living_children,
    pre_pregnancy_weight: form.pre_pregnancy_weight,
    height: form.height,
    medical_conditions: form.medical_conditions || null,
    surgical_history: form.surgical_history || null,
    blood_type_rh: form.blood_type || null,
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
    result = await store.updatePregnancy(props.patientId, props.pregnancy.id, payload)
  } else {
    result = await store.createPregnancy(props.patientId, payload)
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

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="lmp" class="text-xs">LMP Date <span class="text-destructive">*</span></Label>
          <Input
            id="lmp"
            v-model="form.lmp"
            type="date"
            class="h-8 text-sm"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label class="text-xs">Estimated Due Date</Label>
          <div class="flex h-8 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            {{ eddDisplay ?? 'Auto-calculated from LMP' }}
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="edd_source" class="text-xs">EDD Source</Label>
          <Select
            :model-value="form.edd_source"
            @update:model-value="(v) => { form.edd_source = v as typeof form.edd_source }"
          >
            <SelectTrigger id="edd_source" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lmp">LMP</SelectItem>
              <SelectItem value="ultrasound">Ultrasound</SelectItem>
              <SelectItem value="adjusted">Adjusted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="first_us_date" class="text-xs">First Ultrasound Date</Label>
          <Input
            id="first_us_date"
            v-model="form.first_ultrasound_date"
            type="date"
            class="h-8 text-sm"
          />
        </div>

        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <Label for="first_us_ga" class="text-xs">First Ultrasound GA</Label>
          <Input
            id="first_us_ga"
            v-model="form.first_ultrasound_ga"
            placeholder="e.g. 8w4d"
            class="h-8 text-sm"
          />
        </div>
      </div>
    </section>

    <Separator />

    <!-- B. Obstetric History (GPAL) -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <HeartPulse class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Obstetric History (GPAL)
        </h3>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="flex flex-col gap-1.5">
          <Label for="gravidity" class="text-xs">Gravidity (G)</Label>
          <Input
            id="gravidity"
            :model-value="form.gravidity ?? undefined"
            type="number"
            min="0"
            placeholder="0"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.gravidity = v ? Number(v) : null)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="parity_term" class="text-xs">Term (P)</Label>
          <Input
            id="parity_term"
            :model-value="form.parity_term ?? undefined"
            type="number"
            min="0"
            placeholder="0"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.parity_term = v ? Number(v) : null)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="parity_preterm" class="text-xs">Preterm</Label>
          <Input
            id="parity_preterm"
            :model-value="form.parity_preterm ?? undefined"
            type="number"
            min="0"
            placeholder="0"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.parity_preterm = v ? Number(v) : null)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="abortions" class="text-xs">Abortions (A)</Label>
          <Input
            id="abortions"
            :model-value="form.abortions ?? undefined"
            type="number"
            min="0"
            placeholder="0"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.abortions = v ? Number(v) : null)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="living_children" class="text-xs">Living (L)</Label>
          <Input
            id="living_children"
            :model-value="form.living_children ?? undefined"
            type="number"
            min="0"
            placeholder="0"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.living_children = v ? Number(v) : null)"
          />
        </div>
      </div>
      <p class="text-xs text-muted-foreground">G=Gravidity · P=Term · (Preterm) · (Abortions) · (Living)</p>
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
        <div class="flex flex-col gap-1.5">
          <Label for="blood_type" class="text-xs">Blood Type &amp; Rh</Label>
          <Select
            :model-value="form.blood_type"
            @update:model-value="(v) => { form.blood_type = v }"
          >
            <SelectTrigger id="blood_type" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A-">A-</SelectItem>
              <SelectItem value="B+">B+</SelectItem>
              <SelectItem value="B-">B-</SelectItem>
              <SelectItem value="AB+">AB+</SelectItem>
              <SelectItem value="AB-">AB-</SelectItem>
              <SelectItem value="O+">O+</SelectItem>
              <SelectItem value="O-">O-</SelectItem>
            </SelectContent>
          </Select>
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
          <p class="text-xs text-muted-foreground">Enter each risk factor on a new line</p>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 border-t pt-4">
      <Button variant="outline" :disabled="store.isSaving" @click="emit('cancel')">
        Cancel
      </Button>
      <Button :disabled="store.isSaving" @click="handleSubmit">
        <LoaderCircle v-if="store.isSaving" class="size-4 animate-spin" />
        {{ pregnancy ? 'Save Changes' : 'Create Pregnancy Record' }}
      </Button>
    </div>
  </div>
</template>
