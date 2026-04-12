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
import type { VitalFieldConfig } from '@/domains/specialty/types/specialty.types'

const props = defineProps<{
  fieldConfig: VitalFieldConfig
  modelValue: string | number | null
  patientAgeDays?: number
  disabled?: boolean
  error?: string
}>()

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
function onSelectChange(val: string) {
  emit('update:modelValue', val || null)
}
</script>

<template>
  <div v-if="isVisible" class="flex flex-col gap-2">
    <Label :for="fieldId">{{ labelText }}</Label>

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

    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
  </div>
</template>
