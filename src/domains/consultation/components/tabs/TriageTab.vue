<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { toast } from 'vue-sonner'
import {
  Thermometer, Weight, Activity, Ruler, MessageSquare, HeartPulse,
  Wind, Droplets, X, ShieldAlert, Heart,
} from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import VitalsSummary from '../VitalsSummary.vue'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { ConsultationTriage } from '../../types/consultation.types'
import LabOrderSection from '../LabOrderSection.vue'

const props = defineProps<{
  triage: ConsultationTriage
  patientId: string
  patientAllergies: string[]
  patientConditions: string[]
  consultationId: string
  disabled: boolean
}>()

const emit = defineEmits<{
  save: [payload: { triage: ConsultationTriage }]
  'patient-updated': []
  'lab-updated': []
}>()

const authStore = useAuthStore()
const hasLabOrders = computed(() => authStore.hasFeature('lab_orders'))

const local = reactive<ConsultationTriage>({
  chief_complaint: props.triage.chief_complaint,
  vitals: {
    bp: props.triage.vitals?.bp ?? null,
    hr: props.triage.vitals?.hr ?? null,
    rr: props.triage.vitals?.rr ?? null,
    temp: props.triage.vitals?.temp ?? null,
    spo2: props.triage.vitals?.spo2 ?? null,
    blood_sugar: props.triage.vitals?.blood_sugar ?? null,
  },
  weight: props.triage.weight,
  height: props.triage.height,
  pain_score: props.triage.pain_score,
  notes: props.triage.notes,
})

watch(
  () => props.triage,
  (t) => {
    local.chief_complaint = t.chief_complaint
    local.vitals.bp = t.vitals?.bp ?? null
    local.vitals.hr = t.vitals?.hr ?? null
    local.vitals.rr = t.vitals?.rr ?? null
    local.vitals.temp = t.vitals?.temp ?? null
    local.vitals.spo2 = t.vitals?.spo2 ?? null
    local.vitals.blood_sugar = t.vitals?.blood_sugar ?? null
    local.weight = t.weight
    local.height = t.height
    local.pain_score = t.pain_score
    local.notes = t.notes
  },
  { deep: true },
)

// --- Allergy management (saves to patient record) ---
const allergyInput = ref('')
const allergySuggestions = ref<string[]>([])
const showAllergySuggestions = ref(false)
let allergyDebounce: ReturnType<typeof setTimeout> | null = null

function onAllergyInput(val: string | number) {
  allergyInput.value = String(val)
  if (allergyDebounce) clearTimeout(allergyDebounce)
  const q = allergyInput.value.trim()
  if (!q) {
    allergySuggestions.value = []
    showAllergySuggestions.value = false
    return
  }
  allergyDebounce = setTimeout(async () => {
    try {
      const res = await patientApi.searchAllergies(q)
      allergySuggestions.value = res.data.filter((s) => !props.patientAllergies.includes(s))
      showAllergySuggestions.value = allergySuggestions.value.length > 0
    } catch {
      allergySuggestions.value = []
    }
  }, 300)
}

async function addAllergy(val: string) {
  const normalized = val.trim().toLowerCase()
  if (!normalized || props.patientAllergies.includes(normalized)) return
  allergyInput.value = ''
  allergySuggestions.value = []
  showAllergySuggestions.value = false
  await patientApi.update(props.patientId, { allergies: [...props.patientAllergies, normalized] })
  emit('patient-updated')
}

async function removeAllergy(index: number) {
  const updated = props.patientAllergies.filter((_, i) => i !== index)
  try {
    await patientApi.update(props.patientId, { allergies: updated })
    emit('patient-updated')
  } catch {
    toast.error('Failed to update allergies. Please try again.')
  }
}

function onAllergyKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (allergyInput.value.trim()) {
      e.preventDefault()
      addAllergy(allergyInput.value)
    }
  }
}

function onAllergyBlur() {
  setTimeout(() => { showAllergySuggestions.value = false }, 200)
}

// --- Condition management (saves to patient record) ---
const conditionInput = ref('')
const conditionSuggestions = ref<string[]>([])
const showConditionSuggestions = ref(false)
let conditionDebounce: ReturnType<typeof setTimeout> | null = null

function onConditionInput(val: string | number) {
  conditionInput.value = String(val)
  if (conditionDebounce) clearTimeout(conditionDebounce)
  const q = conditionInput.value.trim()
  if (!q) {
    conditionSuggestions.value = []
    showConditionSuggestions.value = false
    return
  }
  conditionDebounce = setTimeout(async () => {
    try {
      const res = await patientApi.searchConditions(q)
      conditionSuggestions.value = res.data.filter((s) => !props.patientConditions.includes(s))
      showConditionSuggestions.value = conditionSuggestions.value.length > 0
    } catch {
      conditionSuggestions.value = []
    }
  }, 300)
}

async function addCondition(val: string) {
  const normalized = val.trim().toLowerCase()
  if (!normalized || props.patientConditions.includes(normalized)) return
  conditionInput.value = ''
  conditionSuggestions.value = []
  showConditionSuggestions.value = false
  await patientApi.update(props.patientId, { chronic_conditions: [...props.patientConditions, normalized] })
  emit('patient-updated')
}

async function removeCondition(index: number) {
  const updated = props.patientConditions.filter((_, i) => i !== index)
  try {
    await patientApi.update(props.patientId, { chronic_conditions: updated })
    emit('patient-updated')
  } catch {
    toast.error('Failed to update conditions. Please try again.')
  }
}

function onConditionKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (conditionInput.value.trim()) {
      e.preventDefault()
      addCondition(conditionInput.value)
    }
  }
}

function onConditionBlur() {
  setTimeout(() => { showConditionSuggestions.value = false }, 200)
}

// --- Blood pressure auto-slash ---
let bpSlashDeleted = false

function onBpInput(e: Event) {
  const input = e.target as HTMLInputElement
  let val = input.value.replace(/[^0-9/]/g, '')

  // Only allow one slash
  const parts = val.split('/')
  if (parts.length > 2) val = parts[0] + '/' + parts.slice(1).join('')

  // Auto-insert slash after 3 digits, but not if user just deleted it
  if (!bpSlashDeleted && !val.includes('/') && /^\d{3,}$/.test(val)) {
    val = val.slice(0, 3) + '/' + val.slice(3)
  }
  bpSlashDeleted = false

  input.value = val
  local.vitals.bp = val || null
}

function onBpKeydown(e: KeyboardEvent) {
  const input = e.target as HTMLInputElement
  if (e.key === ' ') {
    e.preventDefault()
    const val = input.value
    if (val && !val.includes('/')) {
      input.value = val + '/'
      local.vitals.bp = input.value
    }
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.includes('/')) {
    const pos = input.selectionStart ?? 0
    const slashIdx = input.value.indexOf('/')
    if ((e.key === 'Backspace' && pos === slashIdx + 1) || (e.key === 'Delete' && pos === slashIdx)) {
      bpSlashDeleted = true
    }
  }
}

// --- Height unit toggle ---
const heightUnit = ref<'cm' | 'ft'>('cm')
const heightFeet = ref<number | null>(null)
const heightInches = ref<number | null>(null)

function ftInToCm(feet: number | null, inches: number | null): number | null {
  if (feet === null && inches === null) return null
  const totalInches = (feet ?? 0) * 12 + (inches ?? 0)
  return Math.round(totalInches * 2.54 * 10) / 10
}

function cmToFtIn(cm: number | null): { feet: number; inches: number } | null {
  if (cm === null) return null
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return { feet, inches }
}

function toggleHeightUnit() {
  if (heightUnit.value === 'cm') {
    const converted = cmToFtIn(local.height)
    heightFeet.value = converted?.feet ?? null
    heightInches.value = converted?.inches ?? null
    heightUnit.value = 'ft'
  } else {
    heightUnit.value = 'cm'
  }
}

function onFtInUpdate() {
  local.height = ftInToCm(heightFeet.value, heightInches.value)
  onBlur()
}

// --- Pain score ---
const painLabel = computed(() => {
  if (local.pain_score === null || local.pain_score === 0) return null
  if (local.pain_score <= 3) return { label: 'Mild', color: 'text-green-600' }
  if (local.pain_score <= 6) return { label: 'Moderate', color: 'text-amber-600' }
  return { label: 'Severe', color: 'text-red-600' }
})

// --- Validation ---
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (local.vitals.temp !== null && (local.vitals.temp < 30 || local.vitals.temp > 45))
    e.temp = 'Must be between 30 and 45 °C'
  if (local.vitals.hr !== null && (local.vitals.hr < 20 || local.vitals.hr > 300))
    e.hr = 'Must be between 20 and 300 bpm'
  if (local.vitals.rr !== null && (local.vitals.rr < 4 || local.vitals.rr > 60))
    e.rr = 'Must be between 4 and 60 breaths/min'
  if (local.vitals.spo2 !== null && (local.vitals.spo2 < 50 || local.vitals.spo2 > 100))
    e.spo2 = 'Must be between 50 and 100%'
  if (local.vitals.blood_sugar !== null && (local.vitals.blood_sugar < 20 || local.vitals.blood_sugar > 600))
    e.blood_sugar = 'Must be between 20 and 600 mg/dL'
  if (local.weight !== null && (local.weight < 0.5 || local.weight > 500))
    e.weight = 'Must be between 0.5 and 500 kg'
  if (local.height !== null && (local.height < 30 || local.height > 300))
    e.height = 'Must be between 30 and 300 cm'
  errors.value = e
  return Object.keys(e).length === 0
}

function onBlur(): void {
  if (!validate()) return
  emitSave()
}

function onPainScoreChange(val: number[]) {
  local.pain_score = val[0]
  emitSave()
}

function emitSave() {
  emit('save', {
    triage: {
      chief_complaint: local.chief_complaint,
      vitals: { ...local.vitals },
      weight: local.weight,
      height: local.height,
      pain_score: local.pain_score,
      notes: local.notes,
    },
  })
}

function onUpdateNumber(field: 'hr' | 'rr' | 'temp' | 'spo2' | 'blood_sugar', val: string | number) {
  const num = Number(val)
  local.vitals[field] = isNaN(num) ? null : num
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Quick Assessment Summary -->
    <VitalsSummary :triage="local" />

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

    <!-- Vitals -->
    <div>
      <h2 class="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">Vitals</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="flex flex-col gap-2">
          <Label for="bp" class="flex items-center gap-1.5">
            <Activity class="size-3.5 text-muted-foreground" />
            Blood Pressure
          </Label>
          <Input
            id="bp"
            :model-value="local.vitals.bp ?? undefined"
            type="text"
            inputmode="numeric"
            placeholder="120/80"
            :disabled="disabled"
            @input="onBpInput"
            @keydown="onBpKeydown"
            @blur="onBlur"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="hr" class="flex items-center gap-1.5">
            <HeartPulse class="size-3.5 text-muted-foreground" />
            Heart Rate (bpm)
          </Label>
          <Input
            id="hr"
            :model-value="local.vitals.hr ?? undefined"
            type="number"
            placeholder="72"
            :disabled="disabled"
            @update:model-value="(v: string | number) => onUpdateNumber('hr', v)"
            @blur="onBlur"
          />
          <p v-if="errors.hr" class="text-xs text-destructive">{{ errors.hr }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="rr" class="flex items-center gap-1.5">
            <Wind class="size-3.5 text-muted-foreground" />
            Respiratory Rate (breaths/min)
          </Label>
          <Input
            id="rr"
            :model-value="local.vitals.rr ?? undefined"
            type="number"
            placeholder="18"
            :disabled="disabled"
            @update:model-value="(v: string | number) => onUpdateNumber('rr', v)"
            @blur="onBlur"
          />
          <p v-if="errors.rr" class="text-xs text-destructive">{{ errors.rr }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="temp" class="flex items-center gap-1.5">
            <Thermometer class="size-3.5 text-muted-foreground" />
            Temperature (°C)
          </Label>
          <Input
            id="temp"
            :model-value="local.vitals.temp ?? undefined"
            type="number"
            placeholder="36.6"
            step="0.1"
            :disabled="disabled"
            @update:model-value="(v: string | number) => onUpdateNumber('temp', v)"
            @blur="onBlur"
          />
          <p v-if="errors.temp" class="text-xs text-destructive">{{ errors.temp }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="spo2" class="flex items-center gap-1.5">
            <Droplets class="size-3.5 text-muted-foreground" />
            SpO2 (%)
          </Label>
          <Input
            id="spo2"
            :model-value="local.vitals.spo2 ?? undefined"
            type="number"
            placeholder="98"
            :disabled="disabled"
            @update:model-value="(v: string | number) => onUpdateNumber('spo2', v)"
            @blur="onBlur"
          />
          <p v-if="errors.spo2" class="text-xs text-destructive">{{ errors.spo2}}</p>
        </div>

        <!-- Blood Sugar -->
        <div class="flex flex-col gap-1.5">
          <Label for="blood_sugar" class="flex items-center gap-1.5">
            <Droplets class="size-3.5 text-muted-foreground" />
            Blood Sugar (mg/dL)
          </Label>
          <Input
            id="blood_sugar"
            :model-value="local.vitals.blood_sugar ?? undefined"
            type="number"
            placeholder="100"
            :disabled="disabled"
            @update:model-value="(v: string | number) => onUpdateNumber('blood_sugar', v)"
            @blur="onBlur"
          />
          <p v-if="errors.blood_sugar" class="text-xs text-destructive">{{ errors.blood_sugar }}</p>
        </div>
      </div>
    </div>

    <!-- Weight, Height & Pain Score -->
    <div>
      <h2 class="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">Measurements</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label for="weight" class="flex items-center gap-1.5">
              <Weight class="size-3.5 text-muted-foreground" />
              Weight (kg)
            </Label>
          </div>
          <Input
            id="weight"
            :model-value="local.weight ?? undefined"
            type="number"
            placeholder="70"
            step="0.1"
            :disabled="disabled"
            @update:model-value="(v: string | number) => { const n = Number(v); local.weight = isNaN(n) ? null : n }"
            @blur="onBlur"
          />
          <p v-if="errors.weight" class="text-xs text-destructive">{{ errors.weight }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label class="flex items-center gap-1.5">
              <Ruler class="size-3.5 text-muted-foreground" />
              Height ({{ heightUnit === 'cm' ? 'cm' : 'ft/in' }})
            </Label>
            <button
              type="button"
              class="ml-2 rounded-md border px-1.5 py-px text-[11px] font-medium leading-tight text-primary hover:bg-primary/10"
              :disabled="disabled"
              @click="toggleHeightUnit"
            >
              {{ heightUnit === 'cm' ? 'ft/in' : 'cm' }}
            </button>
          </div>
          <Input
            v-if="heightUnit === 'cm'"
            id="height"
            :model-value="local.height ?? undefined"
            type="number"
            placeholder="170"
            :disabled="disabled"
            @update:model-value="(v: string | number) => { const n = Number(v); local.height = isNaN(n) ? null : n }"
            @blur="onBlur"
          />
          <div v-else class="flex items-center gap-2">
            <Input
              :model-value="heightFeet ?? undefined"
              type="number"
              placeholder="5"
              :disabled="disabled"
              class="w-20"
              @update:model-value="(v: string | number) => { const n = Number(v); heightFeet = isNaN(n) ? null : n }"
              @blur="onFtInUpdate"
            />
            <span class="text-xs text-muted-foreground">ft</span>
            <Input
              :model-value="heightInches ?? undefined"
              type="number"
              placeholder="7"
              :disabled="disabled"
              class="w-20"
              @update:model-value="(v: string | number) => { const n = Number(v); heightInches = isNaN(n) ? null : n }"
              @blur="onFtInUpdate"
            />
            <span class="text-xs text-muted-foreground">in</span>
          </div>
          <p v-if="errors.height" class="text-xs text-destructive">{{ errors.height }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label class="flex items-center gap-1.5">
              <Activity class="size-3.5 text-muted-foreground" />
              Pain Score
            <span v-if="local.pain_score !== null" class="ml-1 font-mono text-base font-semibold">
              {{ local.pain_score }}/10
            </span>
            <span v-if="painLabel" :class="painLabel.color" class="text-xs font-medium">
              ({{ painLabel.label }})
            </span>
          </Label>
          </div>
          <Slider
            :model-value="[local.pain_score ?? 0]"
            :min="0"
            :max="10"
            :step="1"
            :disabled="disabled"
            class="mt-2.5 w-full"
            @update:model-value="onPainScoreChange"
          />
          <div class="flex justify-between text-[10px] text-muted-foreground">
            <span>0 - No pain</span>
            <span>10 - Worst pain</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Lab Orders -->
    <LabOrderSection v-if="hasLabOrders" :consultation-id="consultationId" :disabled="disabled" @lab-updated="emit('lab-updated')" />

    <!-- Notes -->
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

    <!-- Allergies & Chronic Conditions -->
    <div>
      <h2 class="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">Patient History</h2>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Allergies -->
        <div class="flex flex-col gap-2">
          <Label class="flex items-center gap-1.5">
            <ShieldAlert class="size-3.5 text-muted-foreground" />
            Allergies
          </Label>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(allergy, i) in patientAllergies"
              :key="i"
              class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600"
            >
              <ShieldAlert class="size-3" />
              {{ allergy }}
              <button
                v-if="!disabled"
                class="ml-0.5 rounded-full p-0.5 hover:bg-red-600 dark:hover:bg-red-700"
                @click="removeAllergy(i)"
              >
                <X class="size-3" />
              </button>
            </span>
            <span v-if="!patientAllergies.length" class="text-xs text-muted-foreground">No known allergies</span>
          </div>
          <div v-if="!disabled" class="relative">
            <Input
              :model-value="allergyInput"
              type="text"
              placeholder="Type to search or add allergy..."
              @update:model-value="onAllergyInput"
              @keydown="onAllergyKeydown"
              @blur="onAllergyBlur"
            />
            <div
              v-if="showAllergySuggestions && allergySuggestions.length"
              class="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md"
            >
              <button
                v-for="s in allergySuggestions"
                :key="s"
                class="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                @mousedown.prevent="addAllergy(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>
        </div>

        <!-- Chronic Conditions -->
        <div class="flex flex-col gap-2">
          <Label class="flex items-center gap-1.5">
            <Heart class="size-3.5 text-muted-foreground" />
            Chronic Conditions
          </Label>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(condition, i) in patientConditions"
              :key="i"
              class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600"
            >
              <HeartPulse class="size-3" />
              {{ condition }}
              <button
                v-if="!disabled"
                class="ml-0.5 rounded-full p-0.5 hover:bg-amber-600 dark:hover:bg-amber-700"
                @click="removeCondition(i)"
              >
                <X class="size-3" />
              </button>
            </span>
            <span v-if="!patientConditions.length" class="text-xs text-muted-foreground">No known conditions</span>
          </div>
          <div v-if="!disabled" class="relative">
            <Input
              :model-value="conditionInput"
              type="text"
              placeholder="Type to search or add condition..."
              @update:model-value="onConditionInput"
              @keydown="onConditionKeydown"
              @blur="onConditionBlur"
            />
            <div
              v-if="showConditionSuggestions && conditionSuggestions.length"
              class="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md"
            >
              <button
                v-for="s in conditionSuggestions"
                :key="s"
                class="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                @mousedown.prevent="addCondition(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
