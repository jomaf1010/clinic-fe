<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ConsultationTriage } from '../types/consultation.types'

const props = defineProps<{
  triage: ConsultationTriage
}>()

function parseBP(bp: string | null): { systolic: number; diastolic: number } | null {
  if (!bp) return null
  const match = bp.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) return null
  return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) }
}

const bmi = computed(() => {
  if (!props.triage.weight || !props.triage.height) return null
  const heightM = props.triage.height / 100
  return +(props.triage.weight / (heightM * heightM)).toFixed(1)
})

const bmiCategory = computed(() => {
  if (bmi.value === null) return null
  if (bmi.value < 18.5) return { label: 'Underweight', color: 'text-blue-600' }
  if (bmi.value < 25) return { label: 'Normal', color: 'text-green-600' }
  if (bmi.value < 30) return { label: 'Overweight', color: 'text-amber-600' }
  return { label: 'Obese', color: 'text-red-600' }
})

const tempStatus = computed(() => {
  if (props.triage.vitals?.temp === null || props.triage.vitals?.temp === undefined) return null
  if (props.triage.vitals.temp < 36) return { label: 'Hypothermia', color: 'text-blue-600', icon: AlertTriangle }
  if (props.triage.vitals.temp <= 37.5) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  if (props.triage.vitals.temp <= 38.5) return { label: 'Low-grade fever', color: 'text-amber-600', icon: AlertTriangle }
  return { label: 'High fever', color: 'text-red-600', icon: AlertTriangle }
})

const bpStatus = computed(() => {
  const parsed = parseBP(props.triage.vitals?.bp ?? null)
  if (!parsed) return null
  const { systolic, diastolic } = parsed
  if (systolic < 90 || diastolic < 60) return { label: 'Low', color: 'text-blue-600', icon: AlertTriangle }
  if (systolic <= 120 && diastolic <= 80) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  if (systolic <= 139 || diastolic <= 89) return { label: 'Elevated', color: 'text-amber-600', icon: AlertTriangle }
  return { label: 'High', color: 'text-red-600', icon: AlertTriangle }
})

const hrStatus = computed(() => {
  if (props.triage.vitals?.hr === null || props.triage.vitals?.hr === undefined) return null
  if (props.triage.vitals.hr < 60) return { label: 'Bradycardia', color: 'text-blue-600', icon: AlertTriangle }
  if (props.triage.vitals.hr <= 100) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  return { label: 'Tachycardia', color: 'text-red-600', icon: AlertTriangle }
})

const spo2Status = computed(() => {
  if (props.triage.vitals?.spo2 === null || props.triage.vitals?.spo2 === undefined) return null
  if (props.triage.vitals.spo2 >= 95) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  if (props.triage.vitals.spo2 >= 90) return { label: 'Low', color: 'text-amber-600', icon: AlertTriangle }
  return { label: 'Critical', color: 'text-red-600', icon: AlertTriangle }
})

const rrStatus = computed(() => {
  if (props.triage.vitals?.rr === null || props.triage.vitals?.rr === undefined) return null
  if (props.triage.vitals.rr < 12) return { label: 'Low', color: 'text-blue-600', icon: AlertTriangle }
  if (props.triage.vitals.rr <= 20) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  return { label: 'Elevated', color: 'text-red-600', icon: AlertTriangle }
})

const hasAnyVital = computed(() =>
  bmi.value !== null || tempStatus.value !== null || bpStatus.value !== null ||
  hrStatus.value !== null || spo2Status.value !== null || rrStatus.value !== null
)
</script>

<template>
  <TooltipProvider v-if="hasAnyVital" :delay-duration="200">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs [&>span.sep]:h-3 [&>span.sep]:w-px [&>span.sep]:bg-border">
      <span class="font-medium text-muted-foreground">Summary</span>
      <span class="sep" />

      <Tooltip v-if="bmi !== null">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            BMI {{ bmi }} <span :class="bmiCategory?.color" class="font-medium">{{ bmiCategory?.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">BMI Reference</p>
          <p>&lt;18.5 Underweight</p>
          <p>18.5–24.9 Normal</p>
          <p>25–29.9 Overweight</p>
          <p>≥30 Obese</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="bpStatus" class="sep" />
      <Tooltip v-if="bpStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="bpStatus.icon" :class="bpStatus.color" class="size-3" />
            BP <span :class="bpStatus.color" class="font-medium">{{ bpStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Blood Pressure (mmHg)</p>
          <p>&lt;90/60 Low</p>
          <p>90/60–120/80 Normal</p>
          <p>121/81–139/89 Elevated</p>
          <p>≥140/90 High</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="tempStatus" class="sep" />
      <Tooltip v-if="tempStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="tempStatus.icon" :class="tempStatus.color" class="size-3" />
            Temp <span :class="tempStatus.color" class="font-medium">{{ tempStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Temperature (°C)</p>
          <p>&lt;36 Hypothermia</p>
          <p>36–37.5 Normal</p>
          <p>37.6–38.5 Low-grade fever</p>
          <p>&gt;38.5 High fever</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="hrStatus" class="sep" />
      <Tooltip v-if="hrStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="hrStatus.icon" :class="hrStatus.color" class="size-3" />
            HR <span :class="hrStatus.color" class="font-medium">{{ hrStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Heart Rate (bpm)</p>
          <p>&lt;60 Bradycardia</p>
          <p>60–100 Normal</p>
          <p>&gt;100 Tachycardia</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="spo2Status" class="sep" />
      <Tooltip v-if="spo2Status">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="spo2Status.icon" :class="spo2Status.color" class="size-3" />
            SpO2 <span :class="spo2Status.color" class="font-medium">{{ spo2Status.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Oxygen Saturation (%)</p>
          <p>95–100 Normal</p>
          <p>90–94 Low</p>
          <p>&lt;90 Critical</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="rrStatus" class="sep" />
      <Tooltip v-if="rrStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="rrStatus.icon" :class="rrStatus.color" class="size-3" />
            RR <span :class="rrStatus.color" class="font-medium">{{ rrStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Respiratory Rate (breaths/min)</p>
          <p>&lt;12 Low</p>
          <p>12–20 Normal</p>
          <p>&gt;20 Elevated</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
