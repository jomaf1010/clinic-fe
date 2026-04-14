<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import { MessageSquare } from 'lucide-vue-next'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import VitalsSummary from '../../VitalsSummary.vue'
import VitalFieldRenderer from '../../VitalFieldRenderer.vue'
import LabOrderSection from '../../LabOrderSection.vue'
import type { ConsultationTriage } from '../../../types/consultation.types'
import type { LabOrderResponse } from '../../../types/labOrder.types'

const props = defineProps<{
  triage: ConsultationTriage
  patientId: string
  consultationId: string
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
  <div class="flex flex-col gap-6">
    <!-- Quick Assessment Summary -->
    <VitalsSummary :triage="{ chief_complaint: local.chief_complaint, vitals: { ...allVitals }, notes: local.notes }" />

    <!-- Chief Complaint -->
    <div class="flex flex-col gap-2">
      <Label for="chief_complaint" class="flex items-center gap-1.5">
        <MessageSquare class="size-3.5 text-muted-foreground" />
        Chief Complaint
      </Label>
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
      <h2 class="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">Vitals</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <VitalFieldRenderer
          v-for="field in vitalFields"
          :key="field.key"
          :field-config="field"
          :model-value="allVitals[field.key] ?? null"
          :disabled="disabled"
          :error="errors[field.key]"
          @update:model-value="(v) => { allVitals[field.key] = v }"
          @blur="onBlur"
        />
      </div>
    </div>

    <!-- Lab Orders -->
    <LabOrderSection
      v-if="hasLabOrders"
      :consultation-id="consultationId"
      :disabled="disabled"
      :realtime-update="labOrderUpdate"
      @lab-updated="emit('lab-updated')"
    />

    <!-- Triage Notes -->
    <div class="flex flex-col gap-2">
      <Label for="triage_notes" class="flex items-center gap-1.5">
        <MessageSquare class="size-3.5 text-muted-foreground" />
        Triage Notes
      </Label>
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
