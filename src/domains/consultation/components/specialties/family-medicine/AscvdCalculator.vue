<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { HeartPulse, ChevronRight, Info } from 'lucide-vue-next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
  /** From store.current.patient_sex */
  patientSex?: string | null
  /** From triage.vitals.bp, format "120/80" */
  triageBp?: string | null
  /** From triage.specialty_data.lifestyle.smoking */
  smokingStatus?: string | null
  /** From patient_conditions (checked for "diabetes" keyword) */
  hasDiabetesCondition?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  patientSex: null,
  triageBp: null,
  smokingStatus: null,
  hasDiabetesCondition: false,
})

// ── State ─────────────────────────────────────────────────────────────────
const open = ref(false)

const age = ref<number | null>(null)
const sex = ref<'male' | 'female'>('male')
const race = ref<'white' | 'aa' | 'other'>('other')
const totalCholesterol = ref<number | null>(null)
const hdlCholesterol = ref<number | null>(null)
const systolicBp = ref<number | null>(null)
const onBpTreatment = ref(false)
const currentSmoker = ref(false)
const hasDiabetes = ref(false)

// Pre-populate from consultation context when section is opened
watch(open, (isOpen) => {
  if (!isOpen) return

  // Sex
  if (props.patientSex === 'female') sex.value = 'female'
  else sex.value = 'male'

  // Systolic BP from triage
  if (props.triageBp) {
    const systolic = parseInt(props.triageBp.split('/')[0], 10)
    if (!isNaN(systolic)) systolicBp.value = systolic
  }

  // Smoking
  currentSmoker.value = props.smokingStatus === 'current'

  // Diabetes from conditions
  hasDiabetes.value = props.hasDiabetesCondition
}, { immediate: false })

// ── ACC/AHA 2013 Pooled Cohort Equations ──────────────────────────────────
// Coefficients from Goff DC Jr et al. 2014 Circulation doi:10.1161/01.cir.0000437741.48606.98

interface GroupCoefficients {
  lnAge: number
  lnAge2?: number
  lnTC: number
  lnAgeTC?: number
  lnHDL: number
  lnAgeHDL?: number
  lnTxSBP: number
  lnUnTxSBP: number
  smoker: number
  lnAgeSmoker?: number
  diabetes: number
  baseline10yr: number
  mean: number
}

const COEFF: Record<string, GroupCoefficients> = {
  white_male: {
    lnAge: 12.344,
    lnTC: 11.853,
    lnAgeTC: -2.664,
    lnHDL: -7.990,
    lnAgeHDL: 1.769,
    lnTxSBP: 1.797,
    lnUnTxSBP: 1.764,
    smoker: 7.837,
    lnAgeSmoker: -1.795,
    diabetes: 0.658,
    baseline10yr: 0.9144,
    mean: 61.18,
  },
  aa_male: {
    lnAge: 2.469,
    lnTC: 0.302,
    lnHDL: -0.307,
    lnTxSBP: 1.916,
    lnUnTxSBP: 1.809,
    smoker: 0.549,
    diabetes: 0.645,
    baseline10yr: 0.8954,
    mean: 19.54,
  },
  white_female: {
    lnAge: -29.799,
    lnAge2: 4.884,
    lnTC: 13.540,
    lnAgeTC: -3.114,
    lnHDL: -13.578,
    lnAgeHDL: 3.149,
    lnTxSBP: 2.019,
    lnUnTxSBP: 1.957,
    smoker: 7.574,
    lnAgeSmoker: -1.665,
    diabetes: 0.661,
    baseline10yr: 0.9665,
    mean: 86.608,
  },
  aa_female: {
    lnAge: 17.1141,
    lnTC: 0.9396,
    lnHDL: -18.9196,
    lnTxSBP: 29.2907,
    lnUnTxSBP: 27.8197,
    smoker: 0.8738,
    diabetes: 0.8738,
    baseline10yr: 0.9533,
    mean: 86.6081,
  },
}

function computeRisk(
  ageVal: number,
  sexVal: 'male' | 'female',
  raceVal: 'white' | 'aa' | 'other',
  tcVal: number,
  hdlVal: number,
  sbpVal: number,
  treated: boolean,
  smoker: boolean,
  diabetes: boolean,
): number | null {
  if (ageVal < 40 || ageVal > 79) return null
  if (tcVal <= 0 || hdlVal <= 0 || sbpVal <= 0) return null

  // "other" uses white coefficients as per ACC/AHA guidance
  const effRace = raceVal === 'aa' ? 'aa' : 'white'
  const key = `${effRace}_${sexVal}`
  const c = COEFF[key]
  if (!c) return null

  const la = Math.log(ageVal)
  const ltc = Math.log(tcVal)
  const lhdl = Math.log(hdlVal)
  const lsbp = Math.log(sbpVal)
  const sm = smoker ? 1 : 0
  const dm = diabetes ? 1 : 0

  let sum = c.lnAge * la
  if (c.lnAge2 !== undefined) sum += c.lnAge2 * la * la
  sum += c.lnTC * ltc
  if (c.lnAgeTC !== undefined) sum += c.lnAgeTC * la * ltc
  sum += c.lnHDL * lhdl
  if (c.lnAgeHDL !== undefined) sum += c.lnAgeHDL * la * lhdl
  sum += (treated ? c.lnTxSBP : c.lnUnTxSBP) * lsbp
  sum += c.smoker * sm
  if (c.lnAgeSmoker !== undefined) sum += c.lnAgeSmoker * la * sm
  sum += c.diabetes * dm

  const risk10yr = 1 - Math.pow(c.baseline10yr, Math.exp(sum - c.mean))
  return Math.max(0, Math.min(1, risk10yr)) * 100
}

const riskPercent = computed<number | null>(() => {
  if (
    age.value === null ||
    totalCholesterol.value === null ||
    hdlCholesterol.value === null ||
    systolicBp.value === null
  ) {
    return null
  }

  return computeRisk(
    age.value,
    sex.value,
    race.value,
    totalCholesterol.value,
    hdlCholesterol.value,
    systolicBp.value,
    onBpTreatment.value,
    currentSmoker.value,
    hasDiabetes.value,
  )
})

interface RiskCategory {
  label: string
  description: string
  colorClass: string
  bgClass: string
}

const riskCategory = computed<RiskCategory | null>(() => {
  if (riskPercent.value === null) return null
  const r = riskPercent.value
  if (r < 5) {
    return {
      label: 'Low Risk',
      description: '<5% 10-year risk',
      colorClass: 'text-green-700 dark:text-green-400',
      bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    }
  }
  if (r < 7.5) {
    return {
      label: 'Borderline Risk',
      description: '5–<7.5% 10-year risk',
      colorClass: 'text-yellow-700 dark:text-yellow-400',
      bgClass: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    }
  }
  if (r < 20) {
    return {
      label: 'Intermediate Risk',
      description: '7.5–<20% 10-year risk',
      colorClass: 'text-orange-700 dark:text-orange-400',
      bgClass: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    }
  }
  return {
    label: 'High Risk',
    description: '≥20% 10-year risk',
    colorClass: 'text-red-700 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  }
})

const isOutOfRange = computed(() => age.value !== null && (age.value < 40 || age.value > 79))
</script>

<template>
  <Collapsible v-model:open="open">
    <CollapsibleTrigger
      class="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
    >
      <ChevronRight
        class="size-3.5 transition-transform"
        :class="open ? 'rotate-90' : ''"
      />
      <HeartPulse class="size-3.5" />
      ASCVD 10-Year Risk Calculator
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div class="mt-4 rounded-lg border bg-card p-4">
        <!-- Info note -->
        <div class="mb-4 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info class="mt-0.5 size-3.5 shrink-0" />
          <span>
            ACC/AHA 2013 Pooled Cohort Equations. Valid for ages 40–79.
            Fields pre-populated from current consultation where available.
          </span>
        </div>

        <!-- Age out-of-range warning -->
        <div
          v-if="isOutOfRange"
          class="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400"
        >
          Patient age must be between 40 and 79 for this calculator.
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Age -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Age (years)</Label>
            <Input
              :model-value="age ?? undefined"
              type="number"
              min="40"
              max="79"
              placeholder="40–79"
              class="h-8 text-sm"
              @update:model-value="(v) => age = v ? Number(v) : null"
            />
          </div>

          <!-- Sex -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Sex</Label>
            <Select
              :model-value="sex"
              @update:model-value="(v) => sex = v as 'male' | 'female'"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Race -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Race</Label>
            <Select
              :model-value="race"
              @update:model-value="(v) => race = v as 'white' | 'aa' | 'other'"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="aa">African American</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Total Cholesterol -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Total Cholesterol (mg/dL)</Label>
            <Input
              :model-value="totalCholesterol ?? undefined"
              type="number"
              min="100"
              max="400"
              placeholder="e.g. 200"
              class="h-8 text-sm"
              @update:model-value="(v) => totalCholesterol = v ? Number(v) : null"
            />
          </div>

          <!-- HDL-C -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">HDL-Cholesterol (mg/dL)</Label>
            <Input
              :model-value="hdlCholesterol ?? undefined"
              type="number"
              min="20"
              max="150"
              placeholder="e.g. 50"
              class="h-8 text-sm"
              @update:model-value="(v) => hdlCholesterol = v ? Number(v) : null"
            />
          </div>

          <!-- Systolic BP -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Systolic BP (mmHg)</Label>
            <Input
              :model-value="systolicBp ?? undefined"
              type="number"
              min="90"
              max="200"
              placeholder="e.g. 130"
              class="h-8 text-sm"
              @update:model-value="(v) => systolicBp = v ? Number(v) : null"
            />
          </div>

          <!-- BP Treatment -->
          <div class="flex items-center gap-3 pt-4">
            <Switch
              :model-value="onBpTreatment"
              @update:model-value="(v) => onBpTreatment = Boolean(v)"
            />
            <Label class="cursor-pointer text-xs">On BP Treatment</Label>
          </div>

          <!-- Current Smoker -->
          <div class="flex items-center gap-3 pt-4">
            <Switch
              :model-value="currentSmoker"
              @update:model-value="(v) => currentSmoker = Boolean(v)"
            />
            <Label class="cursor-pointer text-xs">Current Smoker</Label>
          </div>

          <!-- Diabetes -->
          <div class="flex items-center gap-3 pt-4">
            <Switch
              :model-value="hasDiabetes"
              @update:model-value="(v) => hasDiabetes = Boolean(v)"
            />
            <Label class="cursor-pointer text-xs">Diabetes</Label>
          </div>
        </div>

        <!-- Result -->
        <div
          v-if="riskPercent !== null && riskCategory && !isOutOfRange"
          class="mt-4 rounded-lg border p-4"
          :class="riskCategory.bgClass"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-2xl font-bold" :class="riskCategory.colorClass">
                {{ riskPercent.toFixed(1) }}%
              </p>
              <p class="text-sm font-semibold" :class="riskCategory.colorClass">
                {{ riskCategory.label }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ riskCategory.description }} — 10-year ASCVD risk
              </p>
            </div>
            <HeartPulse class="size-8 opacity-20" :class="riskCategory.colorClass" />
          </div>
        </div>

        <div
          v-else-if="age !== null && totalCholesterol !== null && hdlCholesterol !== null && systolicBp !== null && isOutOfRange"
          class="mt-4 text-sm text-muted-foreground"
        >
          Calculator valid for ages 40–79 only.
        </div>

        <div
          v-else-if="open"
          class="mt-4 text-sm text-muted-foreground"
        >
          Fill in age, cholesterol values, and systolic BP to calculate.
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
