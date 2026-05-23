<script setup lang="ts">
import { ref, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PatientName } from '@/domains/patient/types/patient.types'

const props = withDefaults(defineProps<{
  modelValue: PatientName | null
  disabled?: boolean
  firstNameError?: string
  lastNameError?: string
}>(), {
  disabled: false,
  firstNameError: '',
  lastNameError: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: PatientName | null]
}>()

const firstName = ref(props.modelValue?.first_name ?? '')
const middleName = ref(props.modelValue?.middle_name ?? '')
const lastName = ref(props.modelValue?.last_name ?? '')
const suffix = ref(props.modelValue?.suffix ?? '')

// Watch for external modelValue changes (edit mode population)
watch(() => props.modelValue, (val) => {
  if (val) {
    firstName.value = val.first_name ?? ''
    middleName.value = val.middle_name ?? ''
    lastName.value = val.last_name ?? ''
    suffix.value = val.suffix ?? ''
  }
})

function emitValue() {
  if (!firstName.value && !lastName.value) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', {
    first_name: firstName.value,
    middle_name: middleName.value || null,
    last_name: lastName.value,
    suffix: suffix.value || null,
  })
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">First Name</Label>
      <Input
        v-model="firstName"
        type="text"
        placeholder="Juan"
        :disabled="disabled"
        :aria-invalid="!!props.firstNameError"
        @input="emitValue"
      />
      <p v-if="props.firstNameError" data-field-error="first_name" class="text-xs text-destructive">{{ props.firstNameError }}</p>
    </div>

    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">Last Name</Label>
      <Input
        v-model="lastName"
        type="text"
        placeholder="Dela Cruz"
        :disabled="disabled"
        :aria-invalid="!!props.lastNameError"
        @input="emitValue"
      />
      <p v-if="props.lastNameError" data-field-error="last_name" class="text-xs text-destructive">{{ props.lastNameError }}</p>
    </div>

    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">Middle Name <span class="text-muted-foreground">(optional)</span></Label>
      <Input
        v-model="middleName"
        type="text"
        placeholder="Miguel"
        :disabled="disabled"
        @input="emitValue"
      />
    </div>

    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">Suffix <span class="text-muted-foreground">(optional)</span></Label>
      <Select :model-value="suffix || undefined" :disabled="disabled" @update:model-value="(val) => { const v = val as string; suffix = v === 'none' ? '' : v; emitValue() }">
        <SelectTrigger>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="Jr">Jr</SelectItem>
          <SelectItem value="Sr">Sr</SelectItem>
          <SelectItem value="II">II</SelectItem>
          <SelectItem value="III">III</SelectItem>
          <SelectItem value="IV">IV</SelectItem>
          <SelectItem value="V">V</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
