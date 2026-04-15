<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle, ArrowUp, ArrowDown } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  classifyBpAsStatus,
  classifyHr,
  classifyTemp,
  classifySpo2,
  classifyRr,
  classifyBloodSugar,
  classifyPain,
  classifyBmi,
  type VitalStatus,
} from '@/lib/vitals'
import { useVitalsConfigStore } from '@/stores/vitalsConfigStore'
import type { EncounterResponse } from '@/domains/encounter/types/encounter.types'

const props = withDefaults(defineProps<{
  open: boolean
  consultation: EncounterResponse
  isSaving: boolean
  previewOnly?: boolean
}>(), {
  previewOnly: false,
})

// Adapter: extract consultation-level data from EncounterResponse
const triage = computed(() => props.consultation.consultation?.triage ?? { chief_complaint: null, vitals: {}, notes: null })
const assessment = computed(() => props.consultation.consultation?.assessment ?? { diagnoses: [], notes: null })
const treatmentPlan = computed(() => props.consultation.consultation?.treatment_plan ?? { advice: null, follow_up: null })

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const vitalsConfig = useVitalsConfigStore()

function formatValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}

// Vital classifications
const vitals = computed(() => triage.value.vitals)

function vitalIndicator(status: VitalStatus | null): { icon: typeof ArrowUp | typeof ArrowDown | null; class: string } | null {
  if (!status || status.severity === 'normal') return null
  if (status.severity === 'low') return { icon: ArrowDown, class: 'text-blue-600 dark:text-blue-400' }
  return { icon: ArrowUp, class: 'text-red-600 dark:text-red-400' }
}

const bpInd = computed(() => vitalIndicator(classifyBpAsStatus(vitals.value?.bp, vitalsConfig.config)))
const hrInd = computed(() => vitalIndicator(classifyHr(vitals.value?.hr, vitalsConfig.config)))
const rrInd = computed(() => vitalIndicator(classifyRr(vitals.value?.rr, vitalsConfig.config)))
const tempInd = computed(() => vitalIndicator(classifyTemp(vitals.value?.temp, vitalsConfig.config)))
const spo2Ind = computed(() => vitalIndicator(classifySpo2(vitals.value?.spo2, vitalsConfig.config)))
const bsInd = computed(() => vitalIndicator(classifyBloodSugar(vitals.value?.blood_sugar, vitalsConfig.config)))
const painInd = computed(() => vitalIndicator(classifyPain(vitals.value?.pain_score as number | null, vitalsConfig.config)))

const bmi = computed(() => {
  const w = vitals.value?.weight as number | null
  const h = vitals.value?.height as number | null
  if (!w || !h) return null
  return +(w / ((h / 100) ** 2)).toFixed(1)
})

const bmiCategory = computed(() => {
  const result = classifyBmi(bmi.value, vitalsConfig.config)
  if (!result) return null
  return { label: result.label, color: result.color }
})
</script>

<template>
  <Dialog :open="props.open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-h-[85vh] w-[66vw] sm:max-w-[66vw] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ previewOnly ? 'Consultation Preview' : 'Finalize Consultation' }}</DialogTitle>
        <DialogDescription>
          <template v-if="previewOnly">
            <span v-if="consultation.patient_name" class="font-medium text-foreground">{{ consultation.patient_name }}</span>
            <span v-if="consultation.doctor_name"> &middot; Dr. {{ consultation.doctor_name }}</span>
            <span v-if="consultation.finalized_at"> &middot; {{ new Date(consultation.finalized_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
            <span v-else-if="consultation.created_at"> &middot; {{ new Date(consultation.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
          </template>
          <template v-else>
            Review the consultation before finalizing. This action cannot be undone.
          </template>
        </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-1 gap-5 py-2 md:grid-cols-2">
        <!-- Left Column: Triage -->
        <div class="flex flex-col gap-3">
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Triage
          </h3>
          <div v-if="triage.chief_complaint" class="rounded-md border bg-muted/30 p-3">
            <p class="mb-1 text-xs text-muted-foreground">Chief Complaint</p>
            <p class="text-sm">{{ triage.chief_complaint }}</p>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border bg-muted/30 p-3 text-sm">
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">BP</span>
              <span class="flex items-center gap-1 font-medium">
                <component :is="bpInd.icon" v-if="bpInd" class="size-3" :class="bpInd.class" />
                {{ formatValue(triage.vitals?.bp) }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">HR</span>
              <span class="flex items-center gap-1 font-medium">
                <component :is="hrInd.icon" v-if="hrInd" class="size-3" :class="hrInd.class" />
                {{ triage.vitals?.hr != null ? `${triage.vitals.hr} bpm` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">RR</span>
              <span class="flex items-center gap-1 font-medium">
                <component :is="rrInd.icon" v-if="rrInd" class="size-3" :class="rrInd.class" />
                {{ triage.vitals?.rr != null ? `${triage.vitals.rr} /min` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Temp</span>
              <span class="flex items-center gap-1 font-medium">
                <component :is="tempInd.icon" v-if="tempInd" class="size-3" :class="tempInd.class" />
                {{ triage.vitals?.temp != null ? `${triage.vitals.temp} °C` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">SpO2</span>
              <span class="flex items-center gap-1 font-medium">
                <component :is="spo2Ind.icon" v-if="spo2Ind" class="size-3" :class="spo2Ind.class" />
                {{ triage.vitals?.spo2 != null ? `${triage.vitals.spo2}%` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">BS</span>
              <span class="flex items-center gap-1 font-medium">
                <component :is="bsInd.icon" v-if="bsInd" class="size-3" :class="bsInd.class" />
                {{ triage.vitals?.blood_sugar != null ? `${triage.vitals.blood_sugar} mg/dL` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Weight</span>
              <span class="font-medium">
                {{ vitals?.weight != null ? `${vitals.weight} kg` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Height</span>
              <span class="font-medium">
                {{ vitals?.height != null ? `${vitals.height} cm` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Pain</span>
              <span class="flex items-center gap-1 font-medium">
                <component :is="painInd.icon" v-if="painInd" class="size-3" :class="painInd.class" />
                {{ vitals?.pain_score != null ? `${vitals.pain_score}/10` : '—' }}
              </span>
            </div>
            <div v-if="bmi" class="flex justify-between gap-2">
              <span class="text-muted-foreground">BMI</span>
              <span class="font-medium" :class="bmiCategory?.color">
                {{ bmi }} <span class="text-xs font-normal">{{ bmiCategory?.label }}</span>
              </span>
            </div>
          </div>
          <div v-if="triage.notes" class="rounded-md border bg-muted/30 p-3">
            <p class="mb-1 text-xs text-muted-foreground">Notes</p>
            <p class="text-sm whitespace-pre-wrap">{{ triage.notes }}</p>
          </div>

          <!-- Lab Orders Summary -->
          <div v-if="consultation.lab_order_summary && consultation.lab_order_summary.total > 0">
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lab Orders
            </h3>
            <div class="rounded-md border bg-muted/30 p-3">
              <div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{{ consultation.lab_order_summary.total }} test{{ consultation.lab_order_summary.total > 1 ? 's' : '' }}</span>
                <span>&middot;</span>
                <span v-if="consultation.lab_order_summary.pending > 0" class="text-amber-600 dark:text-amber-400">{{ consultation.lab_order_summary.pending }} pending</span>
                <span v-if="consultation.lab_order_summary.pending > 0 && consultation.lab_order_summary.completed > 0">&middot;</span>
                <span v-if="consultation.lab_order_summary.completed > 0" class="text-green-600 dark:text-green-400">{{ consultation.lab_order_summary.completed }} completed</span>
              </div>
              <div class="flex flex-col gap-1">
                <div
                  v-for="(item, idx) in [...consultation.lab_order_summary.pending_items, ...consultation.lab_order_summary.completed_items]"
                  :key="idx"
                  class="flex items-center gap-2 text-sm"
                >
                  <Badge
                    variant="outline"
                    class="text-[10px] px-1.5 py-0"
                    :class="idx < consultation.lab_order_summary.pending_items.length
                      ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      : 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'"
                  >
                    {{ idx < consultation.lab_order_summary.pending_items.length ? 'pending' : 'done' }}
                  </Badge>
                  <span>{{ item }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Assessment, Prescription, Payment -->
        <div class="flex flex-col gap-5">
          <!-- Diagnosis -->
          <div v-if="assessment?.diagnoses?.length">
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {{ assessment.diagnoses.length > 1 ? 'Diagnoses' : 'Diagnosis' }}
            </h3>
            <div class="rounded-md border bg-muted/30 p-3">
              <!-- Single diagnosis -->
              <div v-if="assessment.diagnoses.length === 1" class="flex items-baseline gap-2 text-sm">
                <span class="font-medium">{{ assessment.diagnoses[0].description }}</span>
                <span v-if="assessment.diagnoses[0].code" class="text-xs font-mono text-muted-foreground">{{ assessment.diagnoses[0].code }}</span>
              </div>
              <!-- Multiple diagnoses -->
              <ul v-else class="flex flex-col gap-1.5 pl-4 list-disc">
                <li
                  v-for="(diagnosis, index) in assessment.diagnoses"
                  :key="index"
                  class="text-sm"
                >
                  <span class="font-medium">{{ diagnosis.description }}</span>
                  <span v-if="diagnosis.code" class="ml-1 text-xs font-mono text-muted-foreground">{{ diagnosis.code }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Assessment Notes -->
          <div>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assessment
            </h3>
            <div class="rounded-md border bg-muted/30 p-3">
              <p v-if="assessment?.notes" class="text-sm whitespace-pre-wrap">
                {{ assessment.notes }}
              </p>
              <p v-else class="text-sm text-muted-foreground">—</p>
            </div>
          </div>

          <!-- Prescription Summary -->
          <div v-if="consultation.prescription_summary?.items?.length">
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Prescription
            </h3>
            <div class="rounded-md border bg-muted/30 p-3">
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="(med, idx) in consultation.prescription_summary.items"
                  :key="idx"
                  class="flex flex-wrap items-baseline gap-x-2 text-sm"
                >
                  <span class="font-medium">{{ med.drug_name }}</span>
                  <span class="text-muted-foreground">{{ med.dose }}</span>
                  <span class="text-xs text-muted-foreground">{{ med.frequency }}</span>
                  <span v-if="med.duration" class="text-xs text-muted-foreground">· {{ med.duration }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Treatment Plan Summary -->
          <div>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Treatment Plan
            </h3>
            <div class="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
              <div>
                <p class="mb-0.5 text-xs text-muted-foreground">Advice / Instructions</p>
                <p v-if="treatmentPlan?.advice" class="text-sm whitespace-pre-wrap">
                  {{ treatmentPlan.advice }}
                </p>
                <p v-else class="text-sm text-muted-foreground">—</p>
              </div>
              <div>
                <p class="mb-0.5 text-xs text-muted-foreground">Follow-up</p>
                <p v-if="treatmentPlan?.follow_up" class="text-sm">
                  {{ new Date(treatmentPlan.follow_up).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) }}
                </p>
                <p v-else class="text-sm text-muted-foreground">—</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isSaving"
          @click="emit('update:open', false)"
        >
          {{ previewOnly ? 'Close' : 'Cancel' }}
        </Button>
        <Button v-if="!previewOnly" :disabled="isSaving" @click="emit('confirm')">
          <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
          {{ isSaving ? 'Finalizing...' : 'Confirm Finalize' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
