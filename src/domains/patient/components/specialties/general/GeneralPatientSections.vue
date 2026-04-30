<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { toast } from 'vue-sonner'
import {
  ListChecks,
  Plus,
  ChevronRight,
  Pencil,
  CheckCircle,
  Search,
  X,
  LoaderCircle,
  ShieldAlert,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import PatientSectionWidget from '../PatientSectionWidget.vue'
import { consultationApi } from '@/domains/consultation/api/consultationApi'
import type { Problem, ProblemStatus, CreateProblemPayload } from '@/domains/patient/types/patient.types'
import type { DiagnosisSearchResult } from '@/domains/consultation/api/consultationApi'
import type { StructuredAllergy, StoreAllergyPayload } from '@/domains/patient/api/patientApi'
import { usePatientDetailStore } from '@/stores/patientDetailStore'

const pdStore = usePatientDetailStore()

// ── Modal state ───────────────────────────────────────────────────────────
const showProblemsModal = ref<boolean>(false)
const showAllergiesModal = ref<boolean>(false)

// ── Problem List (from store) ─────────────────────────────────────────────
const problems = computed(() => pdStore.problems)
const isLoading = computed(() => pdStore.isLoadingCore)

const activeProblems = computed(() =>
  problems.value.filter((p) => p.status !== 'resolved'),
)
const resolvedProblems = computed(() =>
  problems.value.filter((p) => p.status === 'resolved'),
)

const resolvedOpen = ref(false)
const showAddForm = ref(false)
const isSaving = ref(false)

const newProblem = ref<CreateProblemPayload>({
  description: '',
  icd_code: null,
  status: 'active',
  onset_date: null,
})

const icdQuery = ref('')
const icdResults = ref<DiagnosisSearchResult[]>([])
const isSearchingIcd = ref(false)
const showIcdDropdown = ref(false)
let icdDebounce: ReturnType<typeof setTimeout> | null = null

function onIcdInput(val: string | number) {
  icdQuery.value = String(val)
  if (icdDebounce) clearTimeout(icdDebounce)
  const q = icdQuery.value.trim()
  if (q.length < 2) {
    icdResults.value = []
    showIcdDropdown.value = false
    return
  }
  icdDebounce = setTimeout(async () => {
    isSearchingIcd.value = true
    try {
      const res = await consultationApi.searchDiagnoses(q)
      icdResults.value = res.data
      showIcdDropdown.value = icdResults.value.length > 0
    } finally {
      isSearchingIcd.value = false
    }
  }, 300)
}

function selectIcd(result: DiagnosisSearchResult) {
  newProblem.value.description = result.description
  newProblem.value.icd_code = result.code
  icdQuery.value = result.description
  showIcdDropdown.value = false
}

function onIcdBlur() {
  setTimeout(() => { showIcdDropdown.value = false }, 200)
}

async function submitAdd() {
  const desc = newProblem.value.description.trim() || icdQuery.value.trim()
  if (!desc) return
  isSaving.value = true
  try {
    await pdStore.addProblem({
      description: desc,
      icd_code: newProblem.value.icd_code,
      status: newProblem.value.status,
      onset_date: newProblem.value.onset_date || null,
    })
    resetAddForm()
    showAddForm.value = false
  } catch {
    toast.error('Failed to add problem')
  } finally {
    isSaving.value = false
  }
}

function resetAddForm() {
  newProblem.value = { description: '', icd_code: null, status: 'active', onset_date: null }
  icdQuery.value = ''
  icdResults.value = []
  showIcdDropdown.value = false
}

const editingId = ref<string | null>(null)
const editForm = ref<{ description: string; icd_code: string | null; status: ProblemStatus; onset_date: string | null }>({
  description: '',
  icd_code: null,
  status: 'active',
  onset_date: null,
})
const isUpdating = ref(false)

const editIcdQuery = ref('')
const editIcdResults = ref<DiagnosisSearchResult[]>([])
const showEditIcdDropdown = ref(false)
let editIcdDebounce: ReturnType<typeof setTimeout> | null = null

function onEditIcdInput(val: string | number) {
  editIcdQuery.value = String(val)
  if (editIcdDebounce) clearTimeout(editIcdDebounce)
  const q = editIcdQuery.value.trim()
  if (q.length < 2) {
    editIcdResults.value = []
    showEditIcdDropdown.value = false
    return
  }
  editIcdDebounce = setTimeout(async () => {
    try {
      const res = await consultationApi.searchDiagnoses(q)
      editIcdResults.value = res.data
      showEditIcdDropdown.value = editIcdResults.value.length > 0
    } catch { /* ignore */ }
  }, 300)
}

function selectEditIcd(result: DiagnosisSearchResult) {
  editForm.value.description = result.description
  editForm.value.icd_code = result.code
  editIcdQuery.value = result.description
  showEditIcdDropdown.value = false
}

function onEditIcdBlur() {
  setTimeout(() => { showEditIcdDropdown.value = false }, 200)
}

function startEdit(p: Problem) {
  editingId.value = p.uuid
  editForm.value = {
    description: p.description,
    icd_code: p.icd_code,
    status: p.status,
    onset_date: p.onset_date,
  }
  editIcdQuery.value = p.description
}

function cancelEdit() {
  editingId.value = null
}

async function submitEdit(p: Problem) {
  isUpdating.value = true
  try {
    await pdStore.updateProblem(p.uuid, {
      description: editForm.value.description,
      icd_code: editForm.value.icd_code,
      status: editForm.value.status,
      onset_date: editForm.value.onset_date || null,
    })
    editingId.value = null
  } catch {
    toast.error('Failed to update problem')
  } finally {
    isUpdating.value = false
  }
}

async function resolveProblem(p: Problem) {
  try {
    await pdStore.updateProblem(p.uuid, { status: 'resolved' })
  } catch {
    toast.error('Failed to resolve problem')
  }
}

// Delete-confirm targets — keep the full entity in state so the dialog
// can render description / ICD / allergen for verification.
const problemToDelete = ref<Problem | null>(null)
const isDeletingProblem = ref(false)

function requestDeleteProblem(p: Problem) {
  problemToDelete.value = p
}

async function confirmDeleteProblem() {
  if (!problemToDelete.value) return
  isDeletingProblem.value = true
  try {
    await pdStore.deleteProblem(problemToDelete.value.uuid)
    problemToDelete.value = null
  } catch {
    toast.error('Failed to delete problem')
  } finally {
    isDeletingProblem.value = false
  }
}

async function reactivateProblem(p: Problem) {
  try {
    await pdStore.updateProblem(p.uuid, { status: 'active' })
  } catch {
    toast.error('Failed to reactivate problem')
  }
}

function statusVariant(status: ProblemStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active': return 'destructive'
    case 'uncontrolled': return 'destructive'
    case 'controlled': return 'secondary'
    case 'resolved': return 'outline'
    default: return 'outline'
  }
}

function statusLabel(status: ProblemStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Structured Allergies (from store) ────────────────────────────────────
const allergies = computed(() => pdStore.allergies)
const isLoadingAllergies = computed(() => pdStore.isLoadingCore)
const showAllergyDialog = ref(false)
const editingAllergy = ref<StructuredAllergy | null>(null)
const isSavingAllergy = ref(false)

const allergyForm = reactive<{
  allergen: string
  type: 'drug' | 'food' | 'environmental' | 'other'
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis'
  reaction: string
  identified_date: string
  notes: string
}>({
  allergen: '',
  type: 'drug',
  severity: 'mild',
  reaction: '',
  identified_date: '',
  notes: '',
})

function resetAllergyForm() {
  allergyForm.allergen = ''
  allergyForm.type = 'drug'
  allergyForm.severity = 'mild'
  allergyForm.reaction = ''
  allergyForm.identified_date = ''
  allergyForm.notes = ''
}

function openAddAllergy() {
  editingAllergy.value = null
  resetAllergyForm()
  showAllergyDialog.value = true
}

function openEditAllergy(a: StructuredAllergy) {
  editingAllergy.value = a
  allergyForm.allergen = a.allergen
  allergyForm.type = a.type
  allergyForm.severity = a.severity
  allergyForm.reaction = a.reaction ?? ''
  allergyForm.identified_date = a.identified_date ?? ''
  allergyForm.notes = a.notes ?? ''
  showAllergyDialog.value = true
}

async function saveAllergy() {
  if (!allergyForm.allergen.trim()) return
  isSavingAllergy.value = true
  try {
    const payload: StoreAllergyPayload = {
      allergen: allergyForm.allergen.trim(),
      type: allergyForm.type,
      severity: allergyForm.severity,
      reaction: allergyForm.reaction.trim() || null,
      identified_date: allergyForm.identified_date || null,
      notes: allergyForm.notes.trim() || null,
    }
    if (editingAllergy.value) {
      await pdStore.updateAllergy(editingAllergy.value.uuid, payload)
    } else {
      await pdStore.addAllergy(payload)
    }
    showAllergyDialog.value = false
    resetAllergyForm()
  } catch {
    toast.error('Failed to save allergy')
  } finally {
    isSavingAllergy.value = false
  }
}

const allergyToDelete = ref<StructuredAllergy | null>(null)
const isDeletingAllergy = ref(false)

function requestDeleteAllergy(a: StructuredAllergy) {
  allergyToDelete.value = a
}

/// Life-threatening (severe / anaphylaxis) allergies get a stronger
/// warning message in the confirmation — deleting those is riskier.
const isLifeThreateningAllergyTarget = computed(() =>
  allergyToDelete.value?.severity === 'severe' ||
  allergyToDelete.value?.severity === 'anaphylaxis',
)

async function confirmDeleteAllergy() {
  if (!allergyToDelete.value) return
  isDeletingAllergy.value = true
  try {
    await pdStore.deleteAllergy(allergyToDelete.value.uuid)
    allergyToDelete.value = null
  } catch {
    toast.error('Failed to delete allergy')
  } finally {
    isDeletingAllergy.value = false
  }
}

function severityClass(severity: StructuredAllergy['severity']): string {
  switch (severity) {
    case 'mild': return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
    case 'moderate': return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'
    case 'severe': return 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100'
    case 'anaphylaxis': return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100'
  }
}

function severityLabel(severity: StructuredAllergy['severity']): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

function typeLabel(type: StructuredAllergy['type']): string {
  switch (type) {
    case 'drug': return 'Drug'
    case 'food': return 'Food'
    case 'environmental': return 'Environmental'
    case 'other': return 'Other'
  }
}

// ── Widget computed summaries ─────────────────────────────────────────────
const problemsWidgetDetail = computed(() => {
  const count = activeProblems.value.length
  return `${count} active`
})

const problemsWidgetSubDetail = computed(() => {
  const count = resolvedProblems.value.length
  return count > 0 ? `${count} resolved` : undefined
})

const allergiesWidgetDetail = computed(() => {
  const count = allergies.value.length
  return count > 0 ? `${count} recorded` : 'None recorded'
})

// Data loaded by parent via pdStore.loadCore() — no onMounted fetch needed
</script>

<template>
  <div class="contents">
    <PatientSectionWidget
        :icon="ListChecks"
        icon-color="bg-gradient-to-br from-primary to-primary/80"
        title="Problem List"
        :detail="problemsWidgetDetail"
        :sub-detail="problemsWidgetSubDetail"
        :badge-text="activeProblems.length > 0 ? String(activeProblems.length) : undefined"
        badge-variant="destructive"
        :loading="isLoading"
        @click="showProblemsModal = true"
      />
      <PatientSectionWidget
        :icon="ShieldAlert"
        icon-color="bg-gradient-to-br from-red-500 to-red-600"
        title="Allergies"
        :detail="allergiesWidgetDetail"
        :badge-text="allergies.length > 0 ? String(allergies.length) : undefined"
        badge-variant="destructive"
        :loading="isLoadingAllergies"
        @click="showAllergiesModal = true"
      />

    <!-- Problem List Modal -->
    <Dialog v-model:open="showProblemsModal">
      <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <ListChecks class="size-5" />
            Problem List
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-3">
          <!-- Loading -->
          <div v-if="isLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- Add form -->
          <div v-if="showAddForm" class="rounded-lg border bg-muted/30 p-3 flex flex-col gap-3">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Problem</p>

            <!-- ICD search / description -->
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Description / ICD-10</Label>
              <div class="relative">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search class="size-3.5 text-muted-foreground" />
                </div>
                <Input
                  :model-value="icdQuery"
                  placeholder="Search ICD-10 or type description..."
                  class="pl-9 text-sm"
                  @update:model-value="onIcdInput"
                  @blur="onIcdBlur"
                />
                <div
                  v-if="showIcdDropdown"
                  class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
                >
                  <button
                    v-for="r in icdResults"
                    :key="r.id"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    @mousedown.prevent="selectIcd(r)"
                  >
                    <Badge variant="outline" class="shrink-0 text-[10px]">ICD</Badge>
                    <span class="truncate">{{ r.description }}</span>
                    <span v-if="r.code" class="shrink-0 font-mono text-xs text-muted-foreground">{{ r.code }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <!-- Status -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Status</Label>
                <Select v-model="newProblem.status">
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="controlled">Controlled</SelectItem>
                    <SelectItem value="uncontrolled">Uncontrolled</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Onset date -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Onset Date</Label>
                <MFDatePicker
                  :model-value="newProblem.onset_date"
                  disable-future
                  class="h-8 text-xs"
                  @update:model-value="(v: string | null) => newProblem.onset_date = v"
                />
              </div>
            </div>

            <div class="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" class="h-7 text-xs" @click="showAddForm = false; resetAddForm()">
                Cancel
              </Button>
              <Button
                size="sm"
                class="h-7 text-xs"
                :disabled="isSaving || !(newProblem.description.trim() || icdQuery.trim())"
                @click="submitAdd"
              >
                <LoaderCircle v-if="isSaving" class="size-3 animate-spin mr-1" />
                Add Problem
              </Button>
            </div>
          </div>

          <!-- Active problems -->
          <div v-if="!isLoading && activeProblems.length === 0 && !showAddForm" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <ListChecks class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No active problems</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Add medical conditions with ICD-10 codes to track the patient's problem list over time.</p>
          </div>

          <div v-for="p in activeProblems" :key="p.uuid" class="rounded-lg border bg-card">
            <!-- Editing mode -->
            <div v-if="editingId === p.uuid" class="p-3 flex flex-col gap-3">
              <div class="relative">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search class="size-3.5 text-muted-foreground" />
                </div>
                <Input
                  :model-value="editIcdQuery"
                  placeholder="Search ICD-10 or type description..."
                  class="pl-9 text-sm"
                  @update:model-value="onEditIcdInput"
                  @blur="onEditIcdBlur"
                />
                <div
                  v-if="showEditIcdDropdown"
                  class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
                >
                  <button
                    v-for="r in editIcdResults"
                    :key="r.id"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    @mousedown.prevent="selectEditIcd(r)"
                  >
                    <Badge variant="outline" class="shrink-0 text-[10px]">ICD</Badge>
                    <span class="truncate">{{ r.description }}</span>
                    <span v-if="r.code" class="shrink-0 font-mono text-xs text-muted-foreground">{{ r.code }}</span>
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <Select v-model="editForm.status">
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="controlled">Controlled</SelectItem>
                    <SelectItem value="uncontrolled">Uncontrolled</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <MFDatePicker :model-value="editForm.onset_date" disable-future class="h-8 text-xs" @update:model-value="(v: string | null) => editForm.onset_date = v" />
              </div>
              <div class="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" class="h-7 text-xs" @click="cancelEdit">Cancel</Button>
                <Button
                  size="sm"
                  class="h-7 text-xs"
                  :disabled="isUpdating"
                  @click="submitEdit(p)"
                >
                  <LoaderCircle v-if="isUpdating" class="size-3 animate-spin mr-1" />
                  Save
                </Button>
              </div>
            </div>

            <!-- View mode -->
            <div v-else class="flex items-start gap-2 p-3">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-sm font-medium">{{ p.description }}</span>
                  <span v-if="p.icd_code" class="font-mono text-xs text-muted-foreground">{{ p.icd_code }}</span>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <Badge :variant="statusVariant(p.status)" class="text-[10px] px-1.5 py-0">
                    {{ statusLabel(p.status) }}
                  </Badge>
                  <span v-if="p.onset_date" class="text-xs text-muted-foreground">
                    Since {{ formatDate(p.onset_date) }}
                  </span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="Resolve"
                  @click="resolveProblem(p)"
                >
                  <CheckCircle class="size-3.5 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="Edit"
                  @click="startEdit(p)"
                >
                  <Pencil class="size-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="Delete"
                  @click="requestDeleteProblem(p)"
                >
                  <X class="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Resolved problems collapsible -->
          <Collapsible v-if="resolvedProblems.length > 0" v-model:open="resolvedOpen">
            <CollapsibleTrigger class="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
              <ChevronRight class="size-3.5 transition-transform" :class="resolvedOpen ? 'rotate-90' : ''" />
              Resolved ({{ resolvedProblems.length }})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div class="mt-2 flex flex-col gap-2">
                <div
                  v-for="p in resolvedProblems"
                  :key="p.uuid"
                  class="flex items-start gap-2 rounded-lg border bg-muted/30 p-2.5"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-sm text-muted-foreground line-through">{{ p.description }}</span>
                      <span v-if="p.icd_code" class="font-mono text-xs text-muted-foreground">{{ p.icd_code }}</span>
                    </div>
                    <span v-if="p.onset_date" class="text-xs text-muted-foreground">
                      Since {{ formatDate(p.onset_date) }}
                    </span>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-6 px-2 text-xs"
                      @click="reactivateProblem(p)"
                    >
                      Reactivate
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter v-if="!showAddForm" class="justify-end">
          <Button variant="secondary" @click="showAddForm = true">
            <Plus class="size-4 mr-1" />
            Add Problem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Allergies Modal -->
    <Dialog v-model:open="showAllergiesModal">
      <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <ShieldAlert class="size-5" />
            Allergies
          </DialogTitle>
        </DialogHeader>

        <div class="flex flex-1 flex-col gap-2">
          <!-- Loading -->
          <div v-if="isLoadingAllergies" class="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle class="size-3.5 animate-spin" />
            Loading...
          </div>

          <!-- Empty -->
          <div v-else-if="allergies.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
            <ShieldAlert class="size-10 text-muted-foreground/30" />
            <p class="text-sm font-medium text-muted-foreground">No allergies recorded</p>
            <p class="max-w-sm text-xs text-muted-foreground/70">Track drug, food, and environmental allergies with severity levels and reactions.</p>
          </div>

          <!-- Allergy rows -->
          <div
            v-for="a in allergies"
            :key="a.uuid"
            class="flex items-start gap-2 rounded-lg border bg-card p-2.5"
          >
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-sm font-semibold">{{ a.allergen }}</span>
                <span class="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {{ typeLabel(a.type) }}
                </span>
                <Badge
                  variant="outline"
                  class="text-[10px] px-1.5 py-0"
                  :class="severityClass(a.severity)"
                >
                  {{ severityLabel(a.severity) }}
                </Badge>
              </div>
              <p v-if="a.reaction" class="mt-0.5 text-xs text-muted-foreground">{{ a.reaction }}</p>
              <span v-if="a.identified_date" class="mt-0.5 block text-xs text-muted-foreground">
                Identified {{ formatDate(a.identified_date) }}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" class="size-6" title="Edit" @click="openEditAllergy(a)">
                <Pencil class="size-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" class="size-6" title="Delete" @click="requestDeleteAllergy(a)">
                <Trash2 class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter class="justify-end">
          <Button variant="secondary" @click="openAddAllergy">
            <Plus class="size-4 mr-1" />
            Add Allergy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Allergy Add/Edit Dialog (nested inside Allergies Modal) -->
    <Dialog v-model:open="showAllergyDialog">
      <DialogContent class="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ editingAllergy ? 'Edit Allergy' : 'Add Allergy' }}</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <!-- Allergen name -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Allergen <span class="text-destructive">*</span></Label>
            <Input v-model="allergyForm.allergen" placeholder="e.g. Penicillin" class="h-9 text-sm" />
          </div>
          <!-- Type + Severity -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Type</Label>
              <Select v-model="allergyForm.type">
                <SelectTrigger class="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drug">Drug</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Severity</Label>
              <Select v-model="allergyForm.severity">
                <SelectTrigger class="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                  <SelectItem value="anaphylaxis">Anaphylaxis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <!-- Reaction -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Reaction (optional)</Label>
            <Textarea v-model="allergyForm.reaction" placeholder="e.g. Anaphylaxis, hives..." class="min-h-16 text-sm resize-none" />
          </div>
          <!-- Identified date -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Date Identified (optional)</Label>
            <MFDatePicker v-model="allergyForm.identified_date" disable-future class="h-8 text-sm" />
          </div>
          <!-- Notes -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Notes (optional)</Label>
            <Textarea v-model="allergyForm.notes" placeholder="Additional notes..." class="min-h-16 text-sm resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" @click="showAllergyDialog = false">Cancel</Button>
          <Button size="sm" :disabled="isSavingAllergy || !allergyForm.allergen.trim()" @click="saveAllergy">
            <LoaderCircle v-if="isSavingAllergy" class="size-3 animate-spin mr-1" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Problem confirmation -->
    <AlertDialog
      :open="problemToDelete !== null"
      @update:open="(v) => { if (!v) problemToDelete = null }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {{ problemToDelete?.description
            }}<template v-if="problemToDelete?.icd_code"> ({{ problemToDelete.icd_code }})</template>?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This removes the problem from the patient's record permanently.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeletingProblem">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="isDeletingProblem"
            @click="confirmDeleteProblem"
          >
            <LoaderCircle v-if="isDeletingProblem" class="size-3 animate-spin mr-1.5" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Delete Allergy confirmation -->
    <AlertDialog
      :open="allergyToDelete !== null"
      @update:open="(v) => { if (!v) allergyToDelete = null }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {{ allergyToDelete?.allergen
            }}<template v-if="allergyToDelete"> · {{ typeLabel(allergyToDelete.type) }}</template>?
          </AlertDialogTitle>
          <AlertDialogDescription v-if="isLifeThreateningAllergyTarget">
            This is a life-threatening allergy. Removing it hides the warning from future clinicians — confirm you want to delete it permanently.
          </AlertDialogDescription>
          <AlertDialogDescription v-else>
            This removes the allergy from the patient's record permanently.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeletingAllergy">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="isDeletingAllergy"
            @click="confirmDeleteAllergy"
          >
            <LoaderCircle v-if="isDeletingAllergy" class="size-3 animate-spin mr-1.5" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
