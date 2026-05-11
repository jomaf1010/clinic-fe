<script setup lang="ts">
import { computed } from 'vue'
import { Activity, Stethoscope, Baby, Ruler, Weight, Thermometer, Droplets, Heart, Wind } from 'lucide-vue-next'
import type { DisplaySummary, DisplaySummaryVitals, BpClassification } from '@/domains/encounter/types/encounter.types'

const props = defineProps<{
  summary: DisplaySummary
  headline?: string | null
  displaySummary?: string | null
  previousVitals?: DisplaySummaryVitals | null
}>()

const BP_CLASS_LABEL: Record<BpClassification, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  stage_1: 'Stage 1 HTN',
  stage_2: 'Stage 2 HTN',
  crisis: 'Crisis',
}

const BP_CLASS_COLOR: Record<BpClassification, string> = {
  normal: 'text-green-600',
  elevated: 'text-amber-600',
  stage_1: 'text-orange-600',
  stage_2: 'text-red-600',
  crisis: 'text-red-700 font-semibold',
}

const vitals = computed(() => props.summary.vitals)
const headline = computed(() => props.headline ?? props.summary.chief_complaint ?? null)

// Vitals to render as a compact inline chip row
function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

const vitalChips = computed(() => {
  const v = vitals.value
  const chips: Array<{ icon: typeof Activity; label: string; value: string; delta?: string; deltaTone?: 'up' | 'down' | 'neutral' }> = []
  const prev = props.previousVitals

  if (v.bp_systolic != null && v.bp_diastolic != null) {
    const value = `${v.bp_systolic}/${v.bp_diastolic}`
    let delta: string | undefined
    let deltaTone: 'up' | 'down' | 'neutral' | undefined
    if (prev?.bp_systolic != null && prev.bp_diastolic != null) {
      const diffSys = v.bp_systolic - prev.bp_systolic
      if (Math.abs(diffSys) >= 5) {
        delta = `${diffSys > 0 ? '↑' : '↓'} ${Math.abs(diffSys)}`
        deltaTone = diffSys > 0 ? 'up' : 'down'
      }
    }
    chips.push({ icon: Heart, label: 'BP', value: `${value} mmHg`, delta, deltaTone })
  }

  if (v.weight != null) {
    let delta: string | undefined
    let deltaTone: 'up' | 'down' | 'neutral' | undefined
    if (prev?.weight != null) {
      const diff = v.weight - prev.weight
      if (Math.abs(diff) >= 0.5) {
        delta = `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}kg`
        deltaTone = diff > 0 ? 'up' : 'down'
      }
    }
    chips.push({ icon: Weight, label: 'Wt', value: `${fmt1(v.weight)} kg`, delta, deltaTone })
  }

  if (v.temp != null) chips.push({ icon: Thermometer, label: 'Temp', value: `${fmt1(v.temp)}°C` })
  if (v.spo2 != null) chips.push({ icon: Wind, label: 'SpO₂', value: `${v.spo2}%` })
  if (v.hr != null) chips.push({ icon: Activity, label: 'HR', value: `${v.hr} bpm` })
  if (v.blood_sugar != null) chips.push({ icon: Droplets, label: 'BS', value: `${fmt1(v.blood_sugar)} mg/dL` })

  return chips
})

const ctx = computed(() => props.summary.context)

const bpClassColor = computed(() => {
  if (ctx.value.kind !== 'consultation') return ''
  if (ctx.value.specialty !== 'family_medicine' && ctx.value.specialty !== 'internal_medicine') return ''
  const c = (ctx.value as { bp_classification?: BpClassification }).bp_classification
  return c ? BP_CLASS_COLOR[c] : ''
})

const bpClassLabel = computed(() => {
  if (ctx.value.kind !== 'consultation') return null
  if (ctx.value.specialty !== 'family_medicine' && ctx.value.specialty !== 'internal_medicine') return null
  const c = (ctx.value as { bp_classification?: BpClassification }).bp_classification
  return c ? BP_CLASS_LABEL[c] : null
})

function ageLabel(months: number): string {
  if (months < 1) return 'newborn'
  if (months < 24) return `${months} mo`
  return `${Math.floor(months / 12)} y`
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <!-- Chief complaint + specialty context inline -->
    <div v-if="headline" class="text-sm text-foreground leading-relaxed">
      {{ headline }}
    </div>

    <p v-if="displaySummary" class="text-sm text-muted-foreground leading-relaxed">
      {{ displaySummary }}
    </p>

    <!-- Specialty context line -->
    <div v-if="ctx.kind !== 'consultation' || bpClassLabel" class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <template v-if="ctx.kind === 'consultation' && ctx.specialty === 'pediatrics' && (ctx as { age_months?: number }).age_months != null">
        <span class="flex items-center gap-1"><Baby class="size-3" />{{ ageLabel((ctx as { age_months: number }).age_months) }}</span>
      </template>
      <template v-if="bpClassLabel">
        <span class="flex items-center gap-1" :class="bpClassColor">
          <Heart class="size-3" />{{ bpClassLabel }}
        </span>
      </template>
      <template v-if="ctx.kind === 'prenatal'">
        <span v-if="ctx.visit_number" class="flex items-center gap-1"><Stethoscope class="size-3" />Visit #{{ ctx.visit_number }}</span>
        <span v-if="ctx.ga_weeks != null" class="flex items-center gap-1">{{ ctx.ga_weeks }}w{{ ctx.ga_days ?? 0 }}d</span>
        <span v-if="ctx.fundal_height_cm != null" class="flex items-center gap-1"><Ruler class="size-3" />FH {{ ctx.fundal_height_cm }}cm</span>
        <span v-if="ctx.fetal_heart_rate != null" class="flex items-center gap-1"><Heart class="size-3" />FHR {{ ctx.fetal_heart_rate }}</span>
      </template>
      <template v-if="ctx.kind === 'delivery'">
        <span v-if="ctx.delivery_mode" class="flex items-center gap-1">{{ ctx.delivery_mode.replace(/_/g, ' ') }}</span>
        <span v-if="ctx.birth_weight_grams != null" class="flex items-center gap-1"><Weight class="size-3" />{{ ctx.birth_weight_grams }}g</span>
        <span v-if="ctx.birth_gender" class="flex items-center gap-1">{{ ctx.birth_gender }}</span>
      </template>
      <template v-if="ctx.kind === 'postpartum' && ctx.days_postpartum != null">
        <span class="flex items-center gap-1">Day {{ ctx.days_postpartum }} postpartum</span>
      </template>
    </div>

    <!-- Vitals chip row -->
    <div v-if="vitalChips.length" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <div
        v-for="chip in vitalChips"
        :key="chip.label"
        class="flex items-center gap-1"
      >
        <component :is="chip.icon" class="size-3 shrink-0" />
        <span>{{ chip.label }}: <span class="font-medium text-foreground">{{ chip.value }}</span></span>
        <span
          v-if="chip.delta"
          class="text-[10px] font-medium"
          :class="{
            'text-red-600': chip.deltaTone === 'up',
            'text-green-600': chip.deltaTone === 'down',
            'text-muted-foreground': chip.deltaTone === 'neutral',
          }"
        >{{ chip.delta }}</span>
      </div>
    </div>

    <!-- Diagnoses -->
    <div v-if="summary.diagnoses.length" class="flex flex-wrap gap-1">
      <span
        v-for="dx in summary.diagnoses"
        :key="dx"
        class="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
      >{{ dx }}</span>
    </div>
  </div>
</template>
