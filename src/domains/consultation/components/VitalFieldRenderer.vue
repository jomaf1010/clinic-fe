<script setup lang="ts">
import { computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VitalFieldConfig, VitalAgeRange } from '@/domains/specialty/types/specialty.types'

const props = defineProps<{
  fieldConfig: VitalFieldConfig
  modelValue: string | number | null
  patientAgeDays?: number
  disabled?: boolean
  error?: string
}>()

// ── Age-based range resolution ────────────────────────────────────────────────

const resolvedAgeRange = computed<VitalAgeRange | null>(() => {
  const ranges = props.fieldConfig.age_ranges
  if (!ranges?.length || props.patientAgeDays === undefined) return null
  return (
    ranges.find(
      (r) => props.patientAgeDays! >= r.days_min && (r.days_max === null || props.patientAgeDays! <= r.days_max),
    ) ?? null
  )
})

const ageRangeHint = computed<string | null>(() => {
  const r = resolvedAgeRange.value
  if (!r) return null
  const unit = props.fieldConfig.unit
  if (r.min !== null && r.max !== null) return `Normal: ${r.min}–${r.max}${unit ? ' ' + unit : ''}`
  if (r.min !== null) return `Normal: ≥${r.min}${unit ? ' ' + unit : ''}`
  if (r.max !== null) return `Normal: ≤${r.max}${unit ? ' ' + unit : ''}`
  return null
})

const valueStatus = computed<{ label: string; cls: string } | null>(() => {
  const r = resolvedAgeRange.value
  if (!r || props.modelValue === null || props.modelValue === undefined || String(props.modelValue) === '') return null
  const val = Number(props.modelValue)
  if (isNaN(val)) return null
  if (r.min !== null && val < r.min) return { label: 'Low', cls: 'text-blue-600 dark:text-blue-400' }
  if (r.max !== null && val > r.max) return { label: 'High', cls: 'text-red-600 dark:text-red-400' }
  return { label: 'Normal', cls: 'text-green-600 dark:text-green-400' }
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  blur: []
}>()

const isVisible = computed(() => {
  const si = props.fieldConfig.show_if
  if (!si) return true
  if (si.patient_age_days_max !== undefined && props.patientAgeDays !== undefined) {
    return props.patientAgeDays <= si.patient_age_days_max
  }
  return true
})

const labelText = computed(() => {
  if (props.fieldConfig.unit) return `${props.fieldConfig.label} (${props.fieldConfig.unit})`
  return props.fieldConfig.label
})

const fieldId = computed(() => `vital-${props.fieldConfig.key}`)

// ── BP input logic (auto-slash, space-to-slash) ──────────────────────────────
let bpSlashDeleted = false

function onBpInput(e: Event) {
  const input = e.target as HTMLInputElement
  let val = input.value.replace(/[^0-9/]/g, '')
  const parts = val.split('/')
  if (parts.length > 2) val = parts[0] + '/' + parts.slice(1).join('')
  if (!bpSlashDeleted && !val.includes('/') && /^\d{3,}$/.test(val)) {
    val = val.slice(0, 3) + '/' + val.slice(3)
  }
  bpSlashDeleted = false
  input.value = val
  emit('update:modelValue', val || null)
}

function onBpKeydown(e: KeyboardEvent) {
  const input = e.target as HTMLInputElement
  if (e.key === ' ') {
    e.preventDefault()
    const val = input.value
    if (val && !val.includes('/')) {
      input.value = val + '/'
      emit('update:modelValue', input.value)
    }
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && input.value.includes('/')) {
    const pos = input.selectionStart ?? 0
    const slashIdx = input.value.indexOf('/')
    if ((e.key === 'Backspace' && pos === slashIdx + 1) || (e.key === 'Delete' && pos === slashIdx)) {
      bpSlashDeleted = true
    }
  }
}

// ── Number input ─────────────────────────────────────────────────────────────
function onNumberUpdate(val: string | number) {
  const num = Number(val)
  emit('update:modelValue', isNaN(num) || String(val) === '' ? null : num)
}

// ── Select ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onSelectChange(val: any) {
  emit('update:modelValue', val ? String(val) : null)
}
</script>

<template>
  <div v-if="isVisible" class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between gap-2">
      <Label :for="fieldId">{{ labelText }}</Label>
      <span v-if="ageRangeHint" class="text-xs text-muted-foreground">{{ ageRangeHint }}</span>
    </div>

    <!-- Blood pressure: single text input with auto-slash formatting -->
    <template v-if="fieldConfig.input_type === 'paired_number' || fieldConfig.input_type === 'paired_text'">
      <Input
        :id="fieldId"
        :model-value="(modelValue as string) ?? undefined"
        type="text"
        inputmode="numeric"
        placeholder="120/80"
        :disabled="disabled"
        @input="onBpInput"
        @keydown="onBpKeydown"
        @blur="emit('blur')"
      />
    </template>

    <!-- Numeric / Integer: number input with optional min/max -->
    <template v-else-if="fieldConfig.input_type === 'number' || fieldConfig.input_type === 'text'">
      <Input
        :id="fieldId"
        :model-value="(modelValue as number) ?? undefined"
        :type="fieldConfig.input_type === 'number' ? 'number' : 'text'"
        :step="fieldConfig.type === 'numeric' ? '0.1' : '1'"
        :min="fieldConfig.min ?? undefined"
        :max="fieldConfig.max ?? undefined"
        :disabled="disabled"
        @update:model-value="onNumberUpdate"
        @blur="emit('blur')"
      />
    </template>

    <!-- Enum: select dropdown -->
    <template v-else-if="fieldConfig.input_type === 'select' && fieldConfig.options">
      <Select
        :model-value="(modelValue as string) ?? undefined"
        :disabled="disabled"
        @update:model-value="onSelectChange"
      >
        <SelectTrigger :id="fieldId">
          <SelectValue :placeholder="`Select ${fieldConfig.label}`" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in fieldConfig.options"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </template>

    <div v-if="valueStatus || error" class="flex items-center gap-2">
      <span v-if="valueStatus" class="text-xs font-medium" :class="valueStatus.cls">{{ valueStatus.label }}</span>
      <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
    </div>
  </div>
</template>
