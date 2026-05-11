<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import VitalFieldRenderer from '../../VitalFieldRenderer.vue'
import LabOrderSection from '../../LabOrderSection.vue'
import type { ConsultationTriage } from '../../../types/consultation.types'
import type { LabOrderResponse } from '../../../types/labOrder.types'

const props = defineProps<{
  triage: ConsultationTriage
  patientId: string
  encounterId: string
  disabled: boolean
  labOrderUpdate?: LabOrderResponse | null
}>()

const emit = defineEmits<{
  save: [payload: { triage: ConsultationTriage }]
  'lab-updated': []
}>()

const authStore = useAuthStore()
const specialtyConfigStore = useSpecialtyConfigStore()
const hasLabOrders = computed(() => authStore.hasFeature('lab_orders'))

const vitalFields = computed(() => specialtyConfigStore.config?.vitals ?? [])
const renderedVitalFields = computed(() => vitalFields.value.filter((field) => field.key !== 'blood_sugar'))
const BLOOD_GLUCOSE_TIMING_OPTIONS = [
  { value: 'fasting', label: 'Fasting' },
  { value: 'random', label: 'Random' },
  { value: 'postprandial', label: 'Post-prandial' },
  { value: 'pre_meal', label: 'Pre-meal' },
  { value: 'post_meal', label: 'Post-meal' },
  { value: 'bedtime', label: 'Bedtime' },
] as const
type BloodGlucoseTiming = typeof BLOOD_GLUCOSE_TIMING_OPTIONS[number]['value']

// ── Local state ───────────────────────────────────────────────────────────
const allVitals = reactive<Record<string, string | number | null>>({
  ...(props.triage.vitals ?? {}),
})

const local = reactive({
  chief_complaint: props.triage.chief_complaint,
  notes: props.triage.notes,
})

watch(
  () => props.triage,
  (t) => {
    local.chief_complaint = t.chief_complaint
    local.notes = t.notes

    for (const key of Object.keys(allVitals)) delete allVitals[key]
    Object.assign(allVitals, { ...(t.vitals ?? {}) })
  },
  { deep: true },
)

// ── Validation ────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}

  for (const field of vitalFields.value) {
    if (field.type === 'bp' || field.type === 'enum') continue
    const val = allVitals[field.key]
    if (val === null || val === undefined || String(val) === '') continue
    const num = Number(val)
    if (field.min !== null && num < field.min) {
      e[field.key] = `Must be at least ${field.min}${field.unit ? ' ' + field.unit : ''}`
    } else if (field.max !== null && num > field.max) {
      e[field.key] = `Must be at most ${field.max}${field.unit ? ' ' + field.unit : ''}`
    }
  }

  errors.value = e
  return Object.keys(e).length === 0
}

function onBlur(): void {
  if (!validate()) return
  emitSave()
}

function onBloodSugarUpdate(val: string | number) {
  const num = Number(val)
  allVitals['blood_sugar'] = isNaN(num) || String(val) === '' ? null : num
  if (allVitals['blood_sugar'] !== null && !allVitals['blood_glucose_timing']) {
    allVitals['blood_glucose_timing'] = 'random'
  }
}

function onBloodGlucoseTimingUpdate(val: BloodGlucoseTiming) {
  allVitals['blood_glucose_timing'] = val
  onBlur()
}

function emitSave() {
  emit('save', {
    triage: {
      chief_complaint: local.chief_complaint,
      vitals: { ...allVitals },
      notes: local.notes,
    },
  })
}

</script>

<template>
  <div class="flex flex-col divide-y divide-dashed divide-border [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
    <!-- Chief Complaint -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chief Complaint</h3>
      <Textarea
        id="chief_complaint"
        :model-value="local.chief_complaint ?? undefined"
        placeholder="Patient's main concern..."
        :disabled="disabled"
        rows="3"
        @update:model-value="(v: string | number) => local.chief_complaint = String(v) || null"
        @blur="onBlur"
      />
    </div>

    <!-- Vitals (config-driven) -->
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h3>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VitalFieldRenderer
          v-for="field in renderedVitalFields"
          :key="field.key"
          :field-config="field"
          :model-value="allVitals[field.key] ?? null"
          :vitals="allVitals"
          :disabled="disabled"
          :error="errors[field.key]"
          @update:model-value="(v) => { allVitals[field.key] = v }"
          @update:paired="(updates) => Object.assign(allVitals, updates)"
          @blur="onBlur"
        />

        <div class="flex flex-col gap-2">
          <Label for="blood_sugar">Blood Sugar (mg/dL)</Label>
          <div class="flex items-center gap-1">
            <Input
              id="blood_sugar"
              :model-value="(allVitals['blood_sugar'] as number | null) ?? undefined"
              type="number"
              min="20"
              max="600"
              step="1"
              placeholder="70-200"
              :disabled="disabled"
              :aria-invalid="!!errors.blood_sugar"
              class="min-w-0 flex-1"
              :class="errors.blood_sugar ? 'border-destructive focus-visible:ring-destructive' : ''"
              @update:model-value="onBloodSugarUpdate"
              @blur="onBlur"
            />
            <Select
              :model-value="(allVitals['blood_glucose_timing'] as string | null) ?? undefined"
              :disabled="disabled"
              @update:model-value="(v) => onBloodGlucoseTimingUpdate(v as BloodGlucoseTiming)"
            >
              <SelectTrigger class="min-w-0 flex-1" aria-label="Blood glucose timing">
                <SelectValue placeholder="Timing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in BLOOD_GLUCOSE_TIMING_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="errors.blood_sugar" class="text-xs text-destructive">{{ errors.blood_sugar }}</p>
        </div>
      </div>
    </div>

    <!-- Lab Orders -->
    <div v-if="hasLabOrders">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lab Orders</h3>
      <div class="mt-4">
        <LabOrderSection
          :encounter-id="encounterId"
          :disabled="disabled"
          :realtime-update="labOrderUpdate"
          @lab-updated="emit('lab-updated')"
        />
      </div>
    </div>

    <!-- Triage Notes -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Triage Notes</h3>
      <Textarea
        id="triage_notes"
        :model-value="local.notes ?? undefined"
        placeholder="Additional triage notes..."
        :disabled="disabled"
        rows="3"
        @update:model-value="(v: string | number) => local.notes = String(v) || null"
        @blur="onBlur"
      />
    </div>

  </div>
</template>
