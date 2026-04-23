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
  vitals?: Record<string, string | number | null>
  patientAgeDays?: number
  disabled?: boolean
  error?: string
}>()

// For paired fields: read the two values from the paired_storage_keys (fallback: parse from single field key)
const pairedStorageKeys = computed(() => (props.fieldConfig as unknown as { paired_storage_keys?: string[] | null }).paired_storage_keys ?? null)
const pairedLabels = computed(() => (props.fieldConfig as unknown as { paired_labels?: string[] | null }).paired_labels ?? ['', ''])

const pairedPart1 = computed<string>(() => {
  const keys = pairedStorageKeys.value
  if (!keys || !props.vitals) return ''
  const v = props.vitals[keys[0] ?? '']
  return v != null && v !== '' ? String(v) : ''
})

const pairedPart2 = computed<string>(() => {
  const keys = pairedStorageKeys.value
  if (!keys || !props.vitals) return ''
  const v = props.vitals[keys[1] ?? '']
  return v != null && v !== '' ? String(v) : ''
})

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
  'update:paired': [updates: Record<string, number | null>]
  blur: []
}>()

function onPairedChange(partIndex: 0 | 1, val: string | number) {
  const keys = pairedStorageKeys.value
  if (!keys) return
  const key = keys[partIndex]
  if (!key) return
  const num = val === '' || val == null ? null : Number(val)
  const safe = num != null && isNaN(num) ? null : num
  emit('update:paired', { [key]: safe })
}

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

const placeholderText = computed(() => {
  const c = props.fieldConfig
  const r = resolvedAgeRange.value
  // Prefer age-based normal, then static normal range, then min/max bounds
  if (r?.min != null && r?.max != null) return `${r.min}–${r.max}`
  if (c.normal_min != null && c.normal_max != null) return `${c.normal_min}–${c.normal_max}`
  if (c.normal_min != null) return `e.g. ${c.normal_min}`
  if (c.min != null && c.max != null) return `${c.min}–${c.max}`
  return ''
})

// ── Number input ─────────────────────────────────────────────────────────────
function onNumberUpdate(val: string | number) {
  const num = Number(val)
  emit('update:modelValue', isNaN(num) || String(val) === '' ? null : num)
}

function clampToBounds(val: number | null): number | null {
  if (val === null) return null
  const c = props.fieldConfig
  let result = val
  if (c.min != null && result < c.min) result = c.min
  if (c.max != null && result > c.max) result = c.max
  return result
}

function onNumberBlur() {
  // Clamp out-of-range values to the field's min/max bounds before saving.
  const raw = props.modelValue
  const num = raw == null || raw === '' ? null : Number(raw)
  if (num != null && !isNaN(num)) {
    const clamped = clampToBounds(num)
    if (clamped !== num) {
      emit('update:modelValue', clamped)
    }
  }
  emit('blur')
}

function onPairedBlur(partIndex: 0 | 1) {
  const keys = pairedStorageKeys.value
  if (!keys || !props.vitals) {
    emit('blur')
    return
  }
  const key = keys[partIndex]
  if (!key) {
    emit('blur')
    return
  }
  const raw = props.vitals[key]
  const num = raw == null || raw === '' ? null : Number(raw)
  if (num != null && !isNaN(num)) {
    const c = props.fieldConfig
    let result = num
    // For paired fields, use overall min/max as a rough bound (per-part bounds aren't in config)
    if (c.min != null && result < c.min) result = c.min
    if (c.max != null && result > c.max) result = c.max
    if (result !== num) {
      emit('update:paired', { [key]: result })
    }
  }
  emit('blur')
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

    <!-- Paired numbers (e.g. BP): two separate inputs with a slash between -->
    <template v-if="fieldConfig.input_type === 'paired_number' || fieldConfig.input_type === 'paired_text'">
      <div class="flex items-center gap-1">
        <Input
          :id="fieldId"
          :model-value="pairedPart1"
          :type="fieldConfig.input_type === 'paired_number' ? 'number' : 'text'"
          :placeholder="pairedLabels[0] ?? 'Sys'"
          :min="fieldConfig.min ?? undefined"
          :max="fieldConfig.max ?? undefined"
          :disabled="disabled"
          :aria-invalid="!!error"
          :class="error ? 'border-destructive focus-visible:ring-destructive' : ''"
          @update:model-value="(v) => onPairedChange(0, v)"
          @blur="onPairedBlur(0)"
        />
        <span class="text-muted-foreground">/</span>
        <Input
          :model-value="pairedPart2"
          :type="fieldConfig.input_type === 'paired_number' ? 'number' : 'text'"
          :placeholder="pairedLabels[1] ?? 'Dia'"
          :min="fieldConfig.min ?? undefined"
          :max="fieldConfig.max ?? undefined"
          :disabled="disabled"
          :aria-invalid="!!error"
          :class="error ? 'border-destructive focus-visible:ring-destructive' : ''"
          @update:model-value="(v) => onPairedChange(1, v)"
          @blur="onPairedBlur(1)"
        />
      </div>
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
        :placeholder="placeholderText"
        :disabled="disabled"
        :aria-invalid="!!error"
        :class="error ? 'border-destructive focus-visible:ring-destructive' : ''"
        @update:model-value="onNumberUpdate"
        @blur="onNumberBlur"
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
