<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search, User } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { PatientSearchResult } from '@/domains/patient/types/patient.types'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  select: [patient: PatientSearchResult]
}>()

const query = ref('')
const results = ref<PatientSearchResult[]>([])
const isSearching = ref(false)
const showResults = ref(false)
const selectedName = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onInput(value: string | number) {
  query.value = String(value)
  if (searchTimer) clearTimeout(searchTimer)
  if (!query.value || query.value.length < 2) {
    results.value = []
    showResults.value = false
    return
  }
  searchTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const response = await patientApi.search(query.value)
      results.value = response.data
      showResults.value = true
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectPatient(patient: PatientSearchResult) {
  selectedName.value = patient.full_name
  query.value = patient.full_name
  showResults.value = false
  emit('update:modelValue', patient.id)
  emit('select', patient)
}

function clear() {
  query.value = ''
  selectedName.value = ''
  results.value = []
  showResults.value = false
  emit('update:modelValue', null)
}

watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      query.value = ''
      selectedName.value = ''
    }
  },
)
</script>

<template>
  <div class="relative">
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        :model-value="query"
        placeholder="Search patients..."
        class="pl-8"
        @update:model-value="onInput"
        @focus="showResults = results.length > 0"
      />
      <button
        v-if="selectedName"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
        @click="clear"
      >
        Clear
      </button>
    </div>
    <div
      v-if="showResults && results.length > 0"
      class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
    >
      <button
        v-for="patient in results"
        :key="patient.id"
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
        @click="selectPatient(patient)"
      >
        <User class="size-3.5 text-muted-foreground" />
        <div class="min-w-0">
          <p class="truncate font-medium">{{ patient.full_name }}</p>
          <p class="truncate text-xs text-muted-foreground">{{ patient.address }}</p>
        </div>
      </button>
    </div>
    <div
      v-else-if="showResults && query.length >= 2 && !isSearching"
      class="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-center text-sm text-muted-foreground shadow-md"
    >
      No patients found
    </div>
  </div>
</template>
