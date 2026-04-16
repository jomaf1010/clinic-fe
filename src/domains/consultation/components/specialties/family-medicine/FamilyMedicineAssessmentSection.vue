<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { X, Search, Stethoscope, ChevronRight, ClipboardList, LoaderCircle } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { consultationApi } from '../../../api/consultationApi'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import AscvdCalculator from './AscvdCalculator.vue'
import type { DiagnosisSearchResult } from '../../../api/consultationApi'
import type { ConsultationAssessment, AssessmentDiagnosis, ProblemSoapNote } from '../../../types/consultation.types'
import type { Problem } from '@/domains/patient/types/patient.types'

const props = defineProps<{
  assessment: ConsultationAssessment
  disabled: boolean
}>()

const emit = defineEmits<{
  save: [payload: { assessment: ConsultationAssessment }]
}>()

const route = useRoute()
const store = useEncounterStore()
const pdStore = usePatientDetailStore()

// patientId available from route param (patients/:patientId/consultations/:id)
const patientId = computed(() => (route.params.patientId as string) || store.current?.patient_id || '')

const local = reactive<ConsultationAssessment>({
  diagnoses: [...(props.assessment?.diagnoses ?? [])],
  notes: props.assessment?.notes ?? null,
})

watch(
  () => props.assessment,
  (val) => {
    local.diagnoses = [...(val?.diagnoses ?? [])]
    local.notes = val?.notes ?? null
  },
  { deep: true },
)

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
      selectDiagnosis(searchResults.value[highlightedIndex.value])
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

function onNotesUpdate(val: string | number) {
  local.notes = String(val) || null
}

function onNotesBlur() {
  emitSave()
}

function emitSave() {
  emit('save', {
    assessment: {
      diagnoses: [...local.diagnoses],
      notes: local.notes,
    },
  })
}

// ── Per-problem SOAP Notes ────────────────────────────────────────────────
const activeProblems = ref<Problem[]>([])
const isLoadingProblems = ref(false)
const expandedProblems = ref<Set<string>>(new Set())

// Local SOAP notes keyed by problem_id
const soapNotes = reactive<Record<string, ProblemSoapNote>>({})
const savingNotes = ref<Set<string>>(new Set())

function toggleProblem(id: string) {
  if (expandedProblems.value.has(id)) {
    expandedProblems.value.delete(id)
  } else {
    expandedProblems.value.add(id)
  }
}

function initSoapNote(p: Problem) {
  if (!soapNotes[p.uuid]) {
    const existing = (store.current?.consultation?.specialty_assessment?.problem_notes ?? [])
      .find((n) => n.problem_id === p.uuid)
    soapNotes[p.uuid] = {
      problem_id: p.uuid,
      condition: p.description,
      subjective: existing?.subjective ?? null,
      objective: existing?.objective ?? null,
      assessment: existing?.assessment ?? null,
      plan: existing?.plan ?? null,
    }
  }
}

async function saveSoapNote(problemId: string) {
  const note = soapNotes[problemId]
  if (!note) return

  savingNotes.value.add(problemId)
  try {
    const allNotes = activeProblems.value.map((p) => {
      if (p.uuid === problemId) return note
      return soapNotes[p.uuid] ?? {
        problem_id: p.uuid,
        condition: p.description,
        subjective: null,
        objective: null,
        assessment: null,
        plan: null,
      }
    })
    await store.saveSection({ specialty_assessment: { problem_notes: allNotes } })
  } finally {
    savingNotes.value.delete(problemId)
  }
}

// Sync notes when store updates from realtime
watch(
  () => store.current?.consultation?.specialty_assessment?.problem_notes,
  (newNotes) => {
    if (!newNotes) return
    for (const note of newNotes) {
      if (soapNotes[note.problem_id]) {
        Object.assign(soapNotes[note.problem_id], note)
      }
    }
  },
  { deep: true },
)

onMounted(() => {
  // Read from patientDetailStore — already loaded by parent
  activeProblems.value = pdStore.problems.filter((p) => p.status !== 'resolved')
  for (const p of activeProblems.value) {
    initSoapNote(p)
  }
  ascvdPatientAge.value = pdStore.patientAge
  ascvdSmokingStatus.value = pdStore.lifestyle?.smoking ?? null
})

// ── ASCVD Calculator context ──────────────────────────────────────────────
const ascvdPatientAge = ref<number | null>(null)
const ascvdPatientSex = computed(() => store.current?.patient_sex ?? null)

const ascvdTriageBp = computed(() => {
  const vitals = store.current?.consultation?.triage?.vitals
  return vitals?.bp ?? null
})

const ascvdSmokingStatus = ref<string | null>(null)

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
        @update:model-value="onNotesUpdate"
        @blur="onNotesBlur"
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
          <Search class="size-3.5 text-muted-foreground" />
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

    <!-- Per-problem SOAP Notes -->
    <div class="flex flex-col gap-3">
      <h2 class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <ClipboardList class="size-3.5" />
        Per-Problem SOAP Notes
      </h2>

      <div v-if="isLoadingProblems" class="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle class="size-3.5 animate-spin" />
        Loading problems...
      </div>

      <div v-else-if="activeProblems.length === 0" class="text-sm text-muted-foreground">
        No active problems found. Add problems in the patient's profile.
      </div>

      <div v-for="p in activeProblems" :key="p.uuid" class="rounded-lg border">
        <Collapsible :open="expandedProblems.has(p.uuid)">
          <CollapsibleTrigger
            class="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
            @click="toggleProblem(p.uuid)"
          >
            <div class="flex items-center gap-2">
              <ChevronRight
                class="size-3.5 shrink-0 text-muted-foreground transition-transform"
                :class="expandedProblems.has(p.uuid) ? 'rotate-90' : ''"
              />
              <span class="text-sm font-medium">{{ p.description }}</span>
              <span v-if="p.icd_code" class="font-mono text-xs text-muted-foreground">{{ p.icd_code }}</span>
            </div>
            <LoaderCircle v-if="savingNotes.has(p.uuid)" class="size-3.5 animate-spin text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div v-if="soapNotes[p.uuid]" class="border-t p-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <!-- Subjective -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">S — Subjective</Label>
                <Textarea
                  :model-value="soapNotes[p.uuid].subjective ?? undefined"
                  placeholder="Patient's symptoms, concerns, history..."
                  :disabled="disabled"
                  :rows="3"
                  class="text-sm"
                  @update:model-value="(v) => soapNotes[p.uuid].subjective = String(v) || null"
                  @blur="saveSoapNote(p.uuid)"
                />
              </div>
              <!-- Objective -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O — Objective</Label>
                <Textarea
                  :model-value="soapNotes[p.uuid].objective ?? undefined"
                  placeholder="Exam findings, lab results, vitals..."
                  :disabled="disabled"
                  :rows="3"
                  class="text-sm"
                  @update:model-value="(v) => soapNotes[p.uuid].objective = String(v) || null"
                  @blur="saveSoapNote(p.uuid)"
                />
              </div>
              <!-- Assessment -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">A — Assessment</Label>
                <Textarea
                  :model-value="soapNotes[p.uuid].assessment ?? undefined"
                  placeholder="Clinical impression, diagnosis status..."
                  :disabled="disabled"
                  :rows="3"
                  class="text-sm"
                  @update:model-value="(v) => soapNotes[p.uuid].assessment = String(v) || null"
                  @blur="saveSoapNote(p.uuid)"
                />
              </div>
              <!-- Plan -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">P — Plan</Label>
                <Textarea
                  :model-value="soapNotes[p.uuid].plan ?? undefined"
                  placeholder="Treatment plan, medications, follow-up..."
                  :disabled="disabled"
                  :rows="3"
                  class="text-sm"
                  @update:model-value="(v) => soapNotes[p.uuid].plan = String(v) || null"
                  @blur="saveSoapNote(p.uuid)"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>

    <!-- ASCVD 10-Year Risk Calculator -->
    <AscvdCalculator
      :patient-age="ascvdPatientAge"
      :patient-sex="ascvdPatientSex"
      :triage-bp="ascvdTriageBp"
      :smoking-status="ascvdSmokingStatus"
    />
  </div>
</template>
