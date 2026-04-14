<script setup lang="ts">
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

interface DangerSign {
  key: string
  label: string
  description: string
}

const dangerSigns: DangerSign[] = [
  { key: 'severe_headache', label: 'Severe Headache', description: 'Persistent or worsening headache' },
  { key: 'visual_changes', label: 'Visual Changes', description: 'Blurred vision, spots, or flashes' },
  { key: 'epigastric_pain', label: 'Epigastric Pain', description: 'Pain in the upper abdomen' },
  { key: 'vaginal_bleeding', label: 'Vaginal Bleeding', description: 'Any vaginal bleeding' },
  { key: 'decreased_fetal_movement', label: 'Decreased Fetal Movement', description: 'Less than usual fetal activity' },
  { key: 'fluid_leakage', label: 'Fluid Leakage', description: 'Leaking amniotic fluid' },
  { key: 'persistent_vomiting', label: 'Persistent Vomiting', description: 'Inability to keep fluids down' },
  { key: 'fever', label: 'Fever', description: 'Temperature above 38°C' },
  { key: 'dysuria', label: 'Dysuria', description: 'Pain or burning on urination' },
]

function isChecked(key: string): boolean {
  return props.modelValue.includes(key)
}

function toggle(key: string): void {
  const current = [...props.modelValue]
  const idx = current.indexOf(key)
  if (idx === -1) {
    current.push(key)
  } else {
    current.splice(idx, 1)
  }
  emit('update:modelValue', current)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <div
      v-for="sign in dangerSigns"
      :key="sign.key"
      class="flex items-start gap-2 rounded-md border p-2.5 transition-colors"
      :class="isChecked(sign.key) ? 'border-destructive/40 bg-destructive/5' : 'bg-card'"
    >
      <Checkbox
        :id="`danger-sign-${sign.key}`"
        :checked="isChecked(sign.key)"
        class="mt-0.5 shrink-0"
        @update:checked="toggle(sign.key)"
      />
      <div class="flex flex-col gap-0.5">
        <Label
          :for="`danger-sign-${sign.key}`"
          class="cursor-pointer text-sm font-medium leading-none"
        >
          {{ sign.label }}
        </Label>
        <p class="text-xs text-muted-foreground">{{ sign.description }}</p>
      </div>
    </div>
  </div>
</template>
