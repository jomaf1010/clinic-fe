<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { X, ShieldAlert, Heart, HeartPulse } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { patientApi } from '@/domains/patient/api/patientApi'

const props = defineProps<{
  patientId: string
  patientAllergies: string[]
  patientConditions: string[]
  disabled: boolean
}>()

const emit = defineEmits<{
  'patient-updated': []
}>()

// ── Allergy management ────────────────────────────────────────────────────
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

// ── Condition management ──────────────────────────────────────────────────
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
</script>

<template>
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
</template>
