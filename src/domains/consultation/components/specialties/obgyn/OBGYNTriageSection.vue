<script setup lang="ts">
import { reactive, watch, computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import { MessageSquare, CalendarDays } from 'lucide-vue-next'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pill, Pencil } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import ContraceptionDialog from '@/domains/obgyn/components/ContraceptionDialog.vue'
import { contraceptionLabel } from '@/domains/obgyn/types/obgyn.types'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import type { ContraceptiveEntry } from '@/domains/obgyn/types/obgyn.types'
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

const sd = props.triage.specialty_data as Record<string, string | null> | null | undefined
const local = reactive({
  chief_complaint: props.triage.chief_complaint,
  notes: props.triage.notes,
  lmp: sd?.lmp ?? null,
  menstrual_regularity: sd?.menstrual_regularity ?? null,
  flow_amount: sd?.flow_amount ?? null,
  dysmenorrhea: sd?.dysmenorrhea ?? null,
  last_pap_smear: sd?.last_pap_smear ?? null,
})

// Contraception — single source of truth from GynProfile
const pdStore = usePatientDetailStore()
const showContraceptionDialog = ref(false)

const activeContraception = computed<ContraceptiveEntry | null>(() => {
  const entries = pdStore.gynProfile?.contraception ?? []
  return entries.find((e: ContraceptiveEntry) => !e.end_date) ?? null
})

onMounted(() => {
  // Ensure gynProfile is loaded for OB-GYN contraception reference
  if (!pdStore.gynProfile && pdStore.patient) {
    pdStore.loadObgyn()
  }
})

watch(
  () => props.triage,
  (t) => {
    local.chief_complaint = t.chief_complaint
    local.notes = t.notes
    const s = t.specialty_data as Record<string, string | null> | null | undefined
    local.lmp = s?.lmp ?? null
    local.menstrual_regularity = s?.menstrual_regularity ?? null
    local.flow_amount = s?.flow_amount ?? null
    local.dysmenorrhea = s?.dysmenorrhea ?? null
    local.last_pap_smear = s?.last_pap_smear ?? null

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
      specialty_data: {
        ...props.triage.specialty_data,
        lmp: local.lmp,
        menstrual_regularity: local.menstrual_regularity,
        flow_amount: local.flow_amount,
        dysmenorrhea: local.dysmenorrhea,
        last_pap_smear: local.last_pap_smear,
      } as ConsultationTriage['specialty_data'],
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

    <!-- Menstrual & Reproductive History -->
    <div class="flex flex-col gap-4">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Menstrual & Reproductive History</h3>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <!-- LMP -->
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Last Menstrual Period</Label>
          <MFDatePicker
            :model-value="local.lmp"
            disable-future
            :disabled="disabled"
            @update:model-value="(v: string | null) => { local.lmp = v; onBlur() }"
          />
        </div>

        <!-- Menstrual Regularity -->
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Cycle Regularity</Label>
          <Select
            :model-value="local.menstrual_regularity ?? undefined"
            :disabled="disabled"
            @update:model-value="(v: string) => { local.menstrual_regularity = v || null; onBlur() }"
          >
            <SelectTrigger class="h-9">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="irregular">Irregular</SelectItem>
              <SelectItem value="absent">Absent (Amenorrhea)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Flow Amount -->
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Flow Amount</Label>
          <Select
            :model-value="local.flow_amount ?? undefined"
            :disabled="disabled"
            @update:model-value="(v: string) => { local.flow_amount = v || null; onBlur() }"
          >
            <SelectTrigger class="h-9">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="heavy">Heavy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Dysmenorrhea -->
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Dysmenorrhea</Label>
          <Select
            :model-value="local.dysmenorrhea ?? undefined"
            :disabled="disabled"
            @update:model-value="(v: string) => { local.dysmenorrhea = v || null; onBlur() }"
          >
            <SelectTrigger class="h-9">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="mild">Mild</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="severe">Severe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Current Contraception (sourced from GynProfile) -->
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Current Contraception</Label>
          <button
            type="button"
            class="flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="disabled"
            @click="showContraceptionDialog = true"
          >
            <div v-if="activeContraception" class="flex flex-wrap items-center gap-1 min-w-0 flex-1">
              <Badge
                v-for="m in activeContraception.method"
                :key="m"
                variant="outline"
                class="text-[10px] px-1.5 py-0 border-blue-200 bg-blue-50 text-blue-700"
              >
                {{ contraceptionLabel(m) }}
              </Badge>
            </div>
            <span v-else class="flex-1 text-left text-muted-foreground">None recorded</span>
            <Pencil v-if="activeContraception" class="size-3.5 shrink-0 text-muted-foreground" />
            <Pill v-else class="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>

        <!-- Last Pap Smear -->
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Last Pap Smear</Label>
          <Select
            :model-value="local.last_pap_smear ?? undefined"
            :disabled="disabled"
            @update:model-value="(v: string) => { local.last_pap_smear = v || null; onBlur() }"
          >
            <SelectTrigger class="h-9">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never</SelectItem>
              <SelectItem value="within_1yr">Within 1 year</SelectItem>
              <SelectItem value="1_to_3yrs">1-3 years ago</SelectItem>
              <SelectItem value="over_3yrs">3+ years ago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    <!-- Vitals (config-driven) -->
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h3>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VitalFieldRenderer
          v-for="field in vitalFields"
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
      </div>
    </div>

    <!-- Lab Orders -->
    <div v-if="hasLabOrders">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lab Orders</h3>
      <div class="mt-4">
        <LabOrderSection
          :consultation-id="consultationId"
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

    <ContraceptionDialog v-model:open="showContraceptionDialog" />
  </div>
</template>
