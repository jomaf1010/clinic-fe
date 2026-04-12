<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ListChecks,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  CheckCircle,
  Search,
  X,
  LoaderCircle,
  Activity,
} from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
import { patientApi } from '@/domains/patient/api/patientApi'
import { consultationApi } from '@/domains/consultation/api/consultationApi'
import type { Problem, ProblemStatus, CreateProblemPayload } from '@/domains/patient/types/patient.types'
import type { DiagnosisSearchResult } from '@/domains/consultation/api/consultationApi'

const route = useRoute()
const patientId = computed(() => route.params.id as string)

const problems = ref<Problem[]>([])
const isLoading = ref(false)

const activeProblems = computed(() =>
  problems.value.filter((p) => p.status !== 'resolved'),
)
const resolvedProblems = computed(() =>
  problems.value.filter((p) => p.status === 'resolved'),
)

const resolvedOpen = ref(false)

// ── Add form ──────────────────────────────────────────────────────────────
const showAddForm = ref(false)
const isSaving = ref(false)

const newProblem = ref<CreateProblemPayload>({
  description: '',
  icd_code: null,
  status: 'active',
  onset_date: null,
})

// ── ICD search ────────────────────────────────────────────────────────────
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
  const desc = newProblem.value.description.trim()
  if (!desc) return
  isSaving.value = true
  try {
    const res = await patientApi.addProblem(patientId.value, {
      description: desc,
      icd_code: newProblem.value.icd_code,
      status: newProblem.value.status,
      onset_date: newProblem.value.onset_date || null,
    })
    problems.value.unshift(res.data)
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

// ── Edit ──────────────────────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editForm = ref<{ description: string; icd_code: string | null; status: ProblemStatus; onset_date: string | null }>({
  description: '',
  icd_code: null,
  status: 'active',
  onset_date: null,
})
const isUpdating = ref(false)

// ICD search for edit form
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
    const res = await patientApi.updateProblem(p.uuid, {
      description: editForm.value.description,
      icd_code: editForm.value.icd_code,
      status: editForm.value.status,
      onset_date: editForm.value.onset_date || null,
    })
    const idx = problems.value.findIndex((x) => x.uuid === p.uuid)
    if (idx >= 0) problems.value[idx] = res.data
    editingId.value = null
  } catch {
    toast.error('Failed to update problem')
  } finally {
    isUpdating.value = false
  }
}

async function resolveProblem(p: Problem) {
  try {
    const res = await patientApi.updateProblem(p.uuid, { status: 'resolved' })
    const idx = problems.value.findIndex((x) => x.uuid === p.uuid)
    if (idx >= 0) problems.value[idx] = res.data
  } catch {
    toast.error('Failed to resolve problem')
  }
}

async function deleteProblem(p: Problem) {
  try {
    await patientApi.deleteProblem(p.uuid)
    problems.value = problems.value.filter((x) => x.uuid !== p.uuid)
  } catch {
    toast.error('Failed to delete problem')
  }
}

async function reactivateProblem(p: Problem) {
  try {
    const res = await patientApi.updateProblem(p.uuid, { status: 'active' })
    const idx = problems.value.findIndex((x) => x.uuid === p.uuid)
    if (idx >= 0) problems.value[idx] = res.data
  } catch {
    toast.error('Failed to reactivate problem')
  }
}

// ── Status helpers ────────────────────────────────────────────────────────
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

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!patientId.value) return
  isLoading.value = true
  try {
    const res = await patientApi.getProblems(patientId.value)
    problems.value = res.data
  } catch {
    // silently fail — not critical
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Problem List -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center justify-between gap-2 text-sm font-medium">
          <span class="flex items-center gap-2">
            <ListChecks class="size-4 text-muted-foreground" />
            Problem List
            <span v-if="activeProblems.length" class="rounded-md bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
              {{ activeProblems.length }}
            </span>
          </span>
          <Button
            v-if="!showAddForm"
            variant="ghost"
            size="sm"
            class="h-7 gap-1.5 px-2 text-xs"
            @click="showAddForm = true"
          >
            <Plus class="size-3.5" />
            Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
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
              <Input
                v-model="newProblem.onset_date"
                type="date"
                class="h-8 text-xs"
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
              :disabled="isSaving || !newProblem.description.trim()"
              @click="submitAdd"
            >
              <LoaderCircle v-if="isSaving" class="size-3 animate-spin mr-1" />
              Add Problem
            </Button>
          </div>
        </div>

        <!-- Active problems -->
        <div v-if="!isLoading && activeProblems.length === 0 && !showAddForm" class="text-sm text-muted-foreground">
          No active problems
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
              <Input v-model="editForm.onset_date" type="date" class="h-8 text-xs" />
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
                @click="deleteProblem(p)"
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
      </CardContent>
    </Card>

    <!-- Chronic Disease Trends — placeholder here (rendered in triage in consultation context) -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <Activity class="size-4 text-muted-foreground" />
          Chronic Disease Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">Trends are visible during a consultation in the Triage tab.</p>
      </CardContent>
    </Card>
  </div>
</template>
