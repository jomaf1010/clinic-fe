<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { X, Search, Stethoscope, ClipboardList } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { consultationApi } from '../../../api/consultationApi'
import type { DiagnosisSearchResult } from '../../../api/consultationApi'
import type { ConsultationAssessment, AssessmentDiagnosis } from '../../../types/consultation.types'

const props = defineProps<{
  assessment: ConsultationAssessment
  disabled: boolean
}>()

const emit = defineEmits<{
  save: [payload: { assessment: ConsultationAssessment; specialty_assessment?: Record<string, unknown> }]
}>()

// ── Local state ───────────────────────────────────────────────────────────
const local = reactive<ConsultationAssessment>({
  diagnoses: [...(props.assessment?.diagnoses ?? [])],
  notes: props.assessment?.notes ?? null,
})

// Load GYN exam data from specialty_assessment on the consultation
import { useConsultationStore } from '../../../stores/consultationStore'
const consultationStore = useConsultationStore()

const gynNotes = reactive({
  pelvic_exam: (consultationStore.current?.specialty_assessment as Record<string, string | null> | null)?.pelvic_exam ?? null,
  breast_exam: (consultationStore.current?.specialty_assessment as Record<string, string | null> | null)?.breast_exam ?? null,
})

watch(
  () => props.assessment,
  (val) => {
    local.diagnoses = [...(val?.diagnoses ?? [])]
    local.notes = val?.notes ?? null
    const sa = consultationStore.current?.specialty_assessment as Record<string, string | null> | null
    gynNotes.pelvic_exam = sa?.pelvic_exam ?? null
    gynNotes.breast_exam = sa?.breast_exam ?? null
  },
  { deep: true },
)

// ── Diagnosis search ──────────────────────────────────────────────────────
const searchQuery = ref('')
const searchResults = ref<DiagnosisSearchResult[]>([])
const isSearching = ref(false)
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput(val: string | number) {
  searchQuery.value = String(val)
  if (debounceTimer) clearTimeout(debounceTimer)

  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchResults.value = []
    showDropdown.value = false
    return
  }

  debounceTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const response = await consultationApi.searchDiagnoses(q)
      searchResults.value = response.data.filter(
        (r) => !local.diagnoses.some((d) => d.description === r.description && d.source === r.source),
      )
      highlightedIndex.value = searchResults.value.length > 0 ? 0 : -1
      showDropdown.value = searchResults.value.length > 0
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectDiagnosis(result: DiagnosisSearchResult) {
  const diagnosis: AssessmentDiagnosis = {
    description: result.description,
    code: result.code,
    diagnosis_id: result.id,
    source: result.source,
  }
  local.diagnoses.push(diagnosis)
  searchQuery.value = ''
  searchResults.value = []
  showDropdown.value = false
  emitSave()
}

function addManualDiagnosis() {
  const desc = searchQuery.value.trim()
  if (!desc) return
  if (local.diagnoses.some((d) => d.description.toLowerCase() === desc.toLowerCase())) return

  local.diagnoses.push({
    description: desc,
    code: null,
    diagnosis_id: null,
    source: 'manual',
  })
  searchQuery.value = ''
  searchResults.value = []
  showDropdown.value = false
  emitSave()
}

function removeDiagnosis(index: number) {
  local.diagnoses.splice(index, 1)
  emitSave()
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (showDropdown.value && searchResults.value.length > 0) {
      highlightedIndex.value = (highlightedIndex.value + 1) % searchResults.value.length
      scrollToHighlighted()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (showDropdown.value && searchResults.value.length > 0) {
      highlightedIndex.value = highlightedIndex.value <= 0
        ? searchResults.value.length - 1
        : highlightedIndex.value - 1
      scrollToHighlighted()
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (showDropdown.value && highlightedIndex.value >= 0 && highlightedIndex.value < searchResults.value.length) {
      const result = searchResults.value[highlightedIndex.value]
      if (result) selectDiagnosis(result)
    } else if (searchQuery.value.trim()) {
      addManualDiagnosis()
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
    highlightedIndex.value = -1
  }
}

function scrollToHighlighted() {
  const el = document.querySelector('[data-diagnosis-highlighted="true"]')
  el?.scrollIntoView({ block: 'nearest' })
}

function onSearchBlur() {
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

// ── Save ──────────────────────────────────────────────────────────────────
function emitSave() {
  emit('save', {
    assessment: {
      diagnoses: [...local.diagnoses],
      notes: local.notes,
    },
    specialty_assessment: {
      pelvic_exam: gynNotes.pelvic_exam,
      breast_exam: gynNotes.breast_exam,
    },
  })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Assessment Notes -->
    <div class="flex flex-col gap-2">
      <Label for="assessment-notes" class="flex items-center gap-1.5">
        <Stethoscope class="size-3.5 text-muted-foreground" />
        Assessment Notes
      </Label>
      <Textarea
        id="assessment-notes"
        :model-value="local.notes ?? undefined"
        placeholder="Additional assessment notes..."
        :disabled="disabled"
        :rows="4"
        @update:model-value="(v: string | number) => { local.notes = String(v) || null }"
        @blur="emitSave"
      />
    </div>

    <!-- Diagnoses -->
    <div class="flex flex-col gap-2">
      <Label class="flex items-center gap-1.5">
        <Stethoscope class="size-3.5 text-muted-foreground" />
        Diagnoses
      </Label>

      <!-- Selected diagnoses -->
      <div v-if="local.diagnoses.length > 0" class="flex flex-wrap gap-2">
        <Badge
          v-for="(diagnosis, index) in local.diagnoses"
          :key="index"
          variant="secondary"
          class="flex items-center gap-1.5 py-1 pl-2.5 pr-1.5"
        >
          <span class="text-sm">
            {{ diagnosis.description }}
            <span v-if="diagnosis.code" class="ml-1 font-mono text-xs text-muted-foreground">
              {{ diagnosis.code }}
            </span>
          </span>
          <Button
            v-if="!disabled"
            variant="ghost"
            size="icon"
            class="size-4 rounded-full hover:bg-destructive/20"
            @click="removeDiagnosis(index)"
          >
            <X class="size-3" />
          </Button>
        </Badge>
      </div>

      <!-- Search input -->
      <div v-if="!disabled" class="relative">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search v-if="!isSearching" class="size-3.5 text-muted-foreground" />
          <span v-else class="size-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
        <Input
          :model-value="searchQuery"
          placeholder="Search ICD-10 codes or type a custom diagnosis..."
          class="pl-9"
          @update:model-value="onSearchInput"
          @keydown="onSearchKeydown"
          @blur="onSearchBlur"
        />

        <!-- Dropdown results -->
        <div
          v-if="showDropdown"
          class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          <button
            v-for="(result, rIdx) in searchResults"
            :key="`${result.source}-${result.id}`"
            :data-diagnosis-highlighted="rIdx === highlightedIndex"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            :class="rIdx === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
            @mousedown.prevent="selectDiagnosis(result)"
            @mouseenter="highlightedIndex = rIdx"
          >
            <Badge variant="outline" class="shrink-0 text-[10px]">
              {{ result.source === 'icd' ? 'ICD' : 'Custom' }}
            </Badge>
            <span class="truncate">{{ result.description }}</span>
            <span v-if="result.code" class="shrink-0 font-mono text-xs text-muted-foreground">
              {{ result.code }}
            </span>
          </button>
        </div>
      </div>
      <p v-if="!disabled" class="text-xs text-muted-foreground">
        Type to search or press Enter to add a custom diagnosis
      </p>
    </div>

    <!-- GYN Exam Findings -->
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <ClipboardList class="size-3.5" />
        GYN Exam Findings
      </h2>

      <!-- Pelvic Exam -->
      <div class="flex flex-col gap-2">
        <Label for="pelvic-exam" class="text-xs">Pelvic Exam Findings</Label>
        <Textarea
          id="pelvic-exam"
          :model-value="gynNotes.pelvic_exam ?? undefined"
          placeholder="External genitalia, vagina, cervix, uterus, adnexa..."
          :disabled="disabled"
          :rows="3"
          class="text-sm"
          @update:model-value="(v: string | number) => { gynNotes.pelvic_exam = String(v) || null }"
          @blur="emitSave"
        />
      </div>

      <!-- Breast Exam -->
      <div class="flex flex-col gap-2">
        <Label for="breast-exam" class="text-xs">Breast Exam Findings</Label>
        <Textarea
          id="breast-exam"
          :model-value="gynNotes.breast_exam ?? undefined"
          placeholder="Symmetry, masses, nipple discharge, lymph nodes..."
          :disabled="disabled"
          :rows="3"
          class="text-sm"
          @update:model-value="(v: string | number) => { gynNotes.breast_exam = String(v) || null }"
          @blur="emitSave"
        />
      </div>
    </div>
  </div>
</template>
