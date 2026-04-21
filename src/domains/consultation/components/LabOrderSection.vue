<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { http, getAuthToken } from '@/lib/http'
import {
  Plus,
  Pencil,
  X,
  Upload,
  FileDown,
  FileText,
  Printer,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Search,
  EllipsisVertical,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { labOrderApi } from '../api/labOrderApi'
import { labServiceApi } from '@/domains/labService/api/labServiceApi'
import { cacheLabOrder, getCachedLabOrder } from '@/lib/offlineDb'
import type { LabOrderResponse, LabOrderItem, SystemLabItem } from '../types/labOrder.types'
import { documentApi, type GeneratedDocumentResponse } from '../api/documentApi'
import { openNewTab, printPdf } from '@/lib/utils'
import LabRequestDialog from './LabRequestDialog.vue'

const props = defineProps<{
  encounterId: string
  disabled: boolean
  realtimeUpdate?: LabOrderResponse | null
  documentUpdate?: GeneratedDocumentResponse | null
}>()

const emit = defineEmits<{
  'lab-updated': []
}>()

// --- State ---
const labOrder = ref<LabOrderResponse | null>(null)
const isLoading = ref(false)

watch(() => props.realtimeUpdate, (update) => {
  if (update) {
    labOrder.value = update
  }
})
const isCreating = ref(false)
const uploadingItemId = ref<string | null>(null)

// --- Create flow ---
const showCreateForm = ref(false)

// --- Add item form ---
const addItemInstruction = ref('')
const isAddingItem = ref(false)

// --- Edit item inline ---
const editingItemId = ref<string | null>(null)
const editDescription = ref('')
const editInstruction = ref('')
const isSavingEdit = ref(false)

// --- Search (shared for create form + add item form) ---
const searchQuery = ref('')
const suggestions = ref<SystemLabItem[]>([])
const showSuggestions = ref(false)
const highlightedIndex = ref(-1)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

// --- File input ref ---
const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingUploadItemId = ref<string | null>(null)

// --- Create form items list ---
const createFormItems = ref<{ description: string; instruction: string }[]>([
  { description: '', instruction: '' },
])

// --- Active row reference for keyboard selection ---
let activeRow: { description: string; instruction: string } | null = null

// --- Cache helper ---
async function cacheCurrentLabOrder() {
  if (labOrder.value) {
    await cacheLabOrder(props.encounterId, labOrder.value as unknown as Record<string, unknown>)
  }
}

// --- Load ---
async function loadLabOrder() {
  isLoading.value = true
  try {
    const res = await labOrderApi.getForEncounter(props.encounterId)
    labOrder.value = res.data ?? null
    if (res.data) await cacheCurrentLabOrder()
  } catch {
    // Offline fallback
    const cached = await getCachedLabOrder(props.encounterId)
    if (cached) {
      labOrder.value = cached as unknown as LabOrderResponse
      toast.info('Lab orders loaded from offline cache')
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadLabOrder()
  loadLabRequestDoc()
})

// --- Search ---
function onSearchInput(val: string | number, row: { description: string; instruction: string } | null) {
  const str = String(val)
  activeRow = row
  if (row) {
    row.description = str
  }
  searchQuery.value = str

  if (searchDebounce) clearTimeout(searchDebounce)
  const q = str.trim()
  if (!q) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  searchDebounce = setTimeout(async () => {
    try {
      const [clinicRes, systemRes] = await Promise.all([
        labServiceApi.list(1, 20, q),
        labOrderApi.searchSystemItems(q),
      ])

      // Clinic items first
      const clinicItems: SystemLabItem[] = clinicRes.data.map((s) => ({
        name: s.name,
        category: s.category || 'Clinic',
        source: 'clinic' as const,
      }))

      // System items, excluding ones already in clinic (by normalized name)
      const clinicNames = new Set(clinicItems.map((i) => i.name.toLowerCase()))
      const systemItems: SystemLabItem[] = systemRes.data
        .filter((s) => !clinicNames.has(s.name.toLowerCase()))
        .map((s) => ({ ...s, source: 'system' as const }))

      const merged = [...clinicItems, ...systemItems]
      suggestions.value = merged
      highlightedIndex.value = merged.length > 0 ? 0 : -1
      showSuggestions.value = merged.length > 0
    } catch {
      suggestions.value = []
    }
  }, 300)
}

function selectSuggestion(item: SystemLabItem) {
  if (activeRow) {
    activeRow.description = item.name
  } else {
    searchQuery.value = item.name
  }
  suggestions.value = []
  showSuggestions.value = false
  highlightedIndex.value = -1

  // Auto-add to clinic lab services only for system items (clinic items already exist)
  if (item.source !== 'clinic') {
    labServiceApi.findOrCreate({ name: item.name, category: item.category }).catch(() => {
      // silent — clinic lab service creation is best-effort
    })
  }
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (showSuggestions.value && suggestions.value.length > 0) {
      highlightedIndex.value = (highlightedIndex.value + 1) % suggestions.value.length
      scrollToHighlighted()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (showSuggestions.value && suggestions.value.length > 0) {
      highlightedIndex.value = highlightedIndex.value <= 0
        ? suggestions.value.length - 1
        : highlightedIndex.value - 1
      scrollToHighlighted()
    }
  } else if (e.key === 'Enter') {
    if (showSuggestions.value && highlightedIndex.value >= 0 && highlightedIndex.value < suggestions.value.length) {
      e.preventDefault()
      selectSuggestion(suggestions.value[highlightedIndex.value])
    }
  } else if (e.key === 'Escape') {
    showSuggestions.value = false
    highlightedIndex.value = -1
  }
}

function scrollToHighlighted() {
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-lab-highlighted="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onSearchBlur() {
  setTimeout(() => {
    showSuggestions.value = false
    highlightedIndex.value = -1
  }, 200)
}

// --- Grouped suggestions ---
const groupedSuggestions = computed(() => {
  const groups: Record<string, SystemLabItem[]> = {}
  for (const item of suggestions.value) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }
  return groups
})

function flatIndexOf(item: SystemLabItem): number {
  return suggestions.value.indexOf(item)
}

// --- Create lab order ---
async function handleCreate() {
  const validItems = createFormItems.value
    .filter((i) => i.description.trim())
    .map((i) => ({
      description: i.description.trim(),
      instruction: i.instruction.trim() || undefined,
    }))

  if (!validItems.length) return

  isCreating.value = true
  try {
    const res = await labOrderApi.create(props.encounterId, validItems)
    labOrder.value = res.data
    await cacheCurrentLabOrder()
    showCreateForm.value = false
    createFormItems.value = [{ description: '', instruction: '' }]
    emit('lab-updated')

    // Auto-save lab tests to clinic lab services (fire-and-forget, idempotent)
    for (const item of validItems) {
      labServiceApi.findOrCreate({ name: item.description }).catch(() => {
        // silent — clinic lab service creation is best-effort
      })
    }
  } finally {
    isCreating.value = false
  }
}

function cancelCreate() {
  showCreateForm.value = false
  createFormItems.value = [{ description: '', instruction: '' }]
  searchQuery.value = ''
  suggestions.value = []
  showSuggestions.value = false
}

function addCreateFormRow() {
  createFormItems.value.push({ description: '', instruction: '' })
}

function removeCreateFormRow(index: number) {
  if (createFormItems.value.length === 1) return
  createFormItems.value.splice(index, 1)
}

function onCreateRowKeydown(e: KeyboardEvent) {
  // Arrow/Enter/Escape handled by search when dropdown visible
  if (showSuggestions.value && suggestions.value.length > 0) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
      onSearchKeydown(e)
      return
    }
    if (e.key === 'Enter' && highlightedIndex.value >= 0) {
      onSearchKeydown(e)
      return
    }
  }
  // Enter submits the form if any row has content
  if (e.key === 'Enter') {
    e.preventDefault()
    if (createFormItems.value.some((r) => r.description.trim())) {
      handleCreate()
    }
  }
}

// --- Add item to existing lab order ---
async function handleAddItem() {
  const desc = searchQuery.value.trim()
  if (!labOrder.value || !desc) return
  isAddingItem.value = true
  try {
    const res = await labOrderApi.addItem(labOrder.value.id, {
      description: desc,
      instruction: addItemInstruction.value.trim() || undefined,
    })
    labOrder.value = res.data
    await cacheCurrentLabOrder()
    cancelAddForm()
    emit('lab-updated')

    // Auto-save lab test to clinic lab services (fire-and-forget, idempotent)
    labServiceApi.findOrCreate({ name: desc }).catch(() => {
      // silent — clinic lab service creation is best-effort
    })
  } finally {
    isAddingItem.value = false
  }
}

function onAddItemKeydown(e: KeyboardEvent) {
  if (showSuggestions.value && suggestions.value.length > 0) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
      onSearchKeydown(e)
      return
    }
    if (e.key === 'Enter' && highlightedIndex.value >= 0) {
      onSearchKeydown(e)
      return
    }
  }
  if (e.key === 'Enter' && searchQuery.value.trim()) {
    e.preventDefault()
    handleAddItem()
  }
}

// --- Edit item ---
function startEdit(item: LabOrderItem) {
  editingItemId.value = item.id
  editDescription.value = item.description
  editInstruction.value = item.instruction ?? ''
}

function cancelEdit() {
  editingItemId.value = null
  editDescription.value = ''
  editInstruction.value = ''
}

async function saveEdit(item: LabOrderItem) {
  if (!labOrder.value || !editDescription.value.trim()) return
  isSavingEdit.value = true
  try {
    const res = await labOrderApi.updateItem(labOrder.value.id, item.id, {
      description: editDescription.value.trim(),
      instruction: editInstruction.value.trim() || undefined,
    })
    labOrder.value = res.data
    await cacheCurrentLabOrder()
    cancelEdit()
    emit('lab-updated')
  } finally {
    isSavingEdit.value = false
  }
}

// --- Remove item ---
async function handleRemoveItem(itemId: string) {
  if (!labOrder.value) return
  try {
    const res = await labOrderApi.removeItem(labOrder.value.id, itemId)
    labOrder.value = res.data
    await cacheCurrentLabOrder()
    emit('lab-updated')
  } catch {
    // silent
  }
}

// --- Upload result ---
function triggerUpload(itemId: string) {
  pendingUploadItemId.value = itemId
  fileInputRef.value?.click()
}

async function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const fileList = Array.from(input.files ?? [])
  input.value = ''
  if (!fileList.length || !labOrder.value || !pendingUploadItemId.value) return

  const itemId = pendingUploadItemId.value
  uploadingItemId.value = itemId

  try {
    let res: { data: LabOrderResponse } | null = null
    for (const file of fileList) {
      res = await labOrderApi.uploadResult(labOrder.value!.id, itemId, file)
    }
    if (res) {
      labOrder.value = res.data
      await cacheCurrentLabOrder()
    }
    toast.success(`${fileList.length} file${fileList.length > 1 ? 's' : ''} uploaded successfully`)
    emit('lab-updated')
  } catch {
    toast.error('Failed to upload result. Please try again.')
  } finally {
    uploadingItemId.value = null
    pendingUploadItemId.value = null
  }
}

// --- View result (fetch with auth, show in modal) ---
const previewOpen = ref(false)
const previewFiles = ref<{ url: string; type: 'image' | 'pdf' }[]>([])
const previewTitle = ref('')
const previewIndex = ref(0)
const isLoadingPreview = ref(false)

async function viewResult(item: LabOrderItem) {
  if (!item.result_files.length) return
  isLoadingPreview.value = true
  previewTitle.value = item.description
  previewIndex.value = 0
  previewOpen.value = true

  try {
    const apiBase = (import.meta.env.VITE_API_URL as string).replace(/\/api$/, '')
    const files = await Promise.all(
      item.result_files.map(async (fileUrl) => {
        const url = `${apiBase}${fileUrl}`
        const token = getAuthToken()
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        return {
          url: URL.createObjectURL(blob),
          type: (blob.type === 'application/pdf' ? 'pdf' : 'image') as 'image' | 'pdf',
        }
      }),
    )
    previewFiles.value = files
  } catch {
    toast.error('Failed to load results')
    previewOpen.value = false
  } finally {
    isLoadingPreview.value = false
  }
}

function onPreviewClose(open: boolean) {
  if (!open) {
    for (const f of previewFiles.value) {
      URL.revokeObjectURL(f.url)
    }
    previewFiles.value = []
  }
  previewOpen.value = open
}

// --- Status badge helpers ---
const labOrderStatusClass = computed(() => {
  if (!labOrder.value) return ''
  return labOrder.value.status === 'completed'
    ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
    : 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400'
})

function itemStatusClass(status: 'pending' | 'completed') {
  return status === 'completed'
    ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
    : 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400'
}

// --- Lab Request PDF ---
const showLabRequestDialog = ref(false)
const labRequestDoc = ref<GeneratedDocumentResponse | null>(null)
const labRequestReady = computed(() => labRequestDoc.value?.status === 'completed')

async function loadLabRequestDoc() {
  try {
    const res = await documentApi.list(props.encounterId)
    labRequestDoc.value = res.data.find((d) => d.type === 'lab-request') ?? null
  } catch {
    // ignore
  }
}

watch(() => props.documentUpdate, (update) => {
  if (update && update.type === 'lab-request') {
    if (labRequestDoc.value) {
      labRequestDoc.value = { ...labRequestDoc.value, status: update.status }
    } else {
      labRequestDoc.value = update as GeneratedDocumentResponse
    }
  }
})

async function downloadLabRequest() {
  if (!labRequestDoc.value?.id) return
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(labRequestDoc.value.id)
    tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get download link')
  }
}

async function printLabRequest() {
  if (!labRequestDoc.value?.id) return
  try {
    const url = await documentApi.getSignedUrl(labRequestDoc.value.id)
    printPdf(url)
  } catch {
    toast.error('Failed to get download link')
  }
}

// --- Show add form toggle ---
const showAddForm = ref(false)

function openAddForm() {
  showAddForm.value = true
  searchQuery.value = ''
  addItemInstruction.value = ''
}

function cancelAddForm() {
  showAddForm.value = false
  searchQuery.value = ''
  addItemInstruction.value = ''
  suggestions.value = []
  showSuggestions.value = false
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Actions -->
    <div class="flex items-center justify-between gap-2">
      <Badge
        v-if="labOrder"
        variant="outline"
        class="capitalize"
        :class="labOrderStatusClass"
      >
        <CheckCircle2 v-if="labOrder.status === 'completed'" class="size-3" />
        <Clock v-else class="size-3" />
        {{ labOrder.status }}
      </Badge>
      <div v-else />

      <div class="flex items-center gap-1.5">
        <template v-if="labOrder && labOrder.items.some(i => i.status === 'pending')">
          <Button
            v-if="labRequestReady"
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 text-xs"
            @click="printLabRequest"
          >
            <Printer class="size-3" />
            Print
          </Button>
          <Button
            v-if="labRequestReady"
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 text-xs"
            @click="downloadLabRequest"
          >
            <FileDown class="size-3" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-7 gap-1.5 text-xs"
            @click="showLabRequestDialog = true"
          >
            <FileText class="size-3" />
            {{ labRequestReady ? 'Regenerate' : 'Lab Request PDF' }}
          </Button>
        </template>
        <Button
          v-if="labOrder && !disabled && !showAddForm"
          variant="outline"
          size="sm"
          class="h-7 gap-1.5 text-xs"
          @click="openAddForm"
        >
          <Plus class="size-3.5" />
          Add Item
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center gap-2 py-2 text-sm text-muted-foreground">
      <LoaderCircle class="size-4 animate-spin" />
      Loading...
    </div>

    <!-- No lab order: create button or create form -->
    <template v-else-if="!labOrder">
      <div v-if="!showCreateForm && !disabled">
        <Button
          variant="outline"
          size="sm"
          class="gap-1.5"
          @click="showCreateForm = true"
        >
          <Plus class="size-3.5" />
          Create Lab Order
        </Button>
      </div>

      <div
        v-else-if="!showCreateForm && disabled"
        class="rounded-md border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground"
      >
        No lab order for this consultation.
      </div>

      <!-- Create form -->
      <div v-if="showCreateForm" class="flex flex-col gap-3 rounded-md border bg-muted/10 p-4">
        <p class="text-sm font-medium">Add lab tests</p>

        <div
          v-for="(row, index) in createFormItems"
          :key="index"
          class="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0"
        >
          <div class="flex items-start gap-2">
            <div class="relative flex-1">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search class="size-3.5 text-muted-foreground" />
              </div>
              <Input
                :model-value="row.description"
                placeholder="Search lab test or type custom..."
                class="pl-9"
                @update:model-value="(v) => onSearchInput(v, row)"
                @keydown="onCreateRowKeydown"
                @blur="onSearchBlur"
              />
              <!-- Suggestions dropdown -->
              <div
                v-if="showSuggestions && suggestions.length > 0 && row === activeRow"
                class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
              >
                <template v-for="(items, category) in groupedSuggestions" :key="category">
                  <p class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {{ category }}
                  </p>
                  <button
                    v-for="item in items"
                    :key="item.name"
                    type="button"
                    :data-lab-highlighted="flatIndexOf(item) === highlightedIndex"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    :class="flatIndexOf(item) === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
                    @mouseenter="highlightedIndex = flatIndexOf(item)"
                    @mousedown.prevent="selectSuggestion(item)"
                  >
                    <span
                      v-if="item.source === 'clinic'"
                      class="shrink-0 rounded-full border border-green-300 bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
                    >
                      Clinic
                    </span>
                    {{ item.name }}
                  </button>
                </template>
              </div>
            </div>

            <button
              v-if="createFormItems.length > 1"
              type="button"
              class="mt-1.5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              @click="removeCreateFormRow(index)"
            >
              <X class="size-4" />
            </button>
          </div>

          <Textarea
            :model-value="row.instruction"
            placeholder="Special instruction (optional)..."
            rows="2"
            class="text-sm"
            @update:model-value="(v) => row.instruction = String(v)"
          />
        </div>

        <button
          type="button"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          @click="addCreateFormRow"
        >
          <Plus class="size-3.5" />
          Add another test
        </button>

        <div class="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            :disabled="isCreating || !createFormItems.some((r) => r.description.trim())"
            @click="handleCreate"
          >
            <LoaderCircle v-if="isCreating" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            Create Lab Order
          </Button>
          <Button variant="ghost" size="sm" @click="cancelCreate">
            Cancel
          </Button>
        </div>
      </div>
    </template>

    <!-- Lab order exists: items list -->
    <template v-else>
      <!-- Add item form (inline) -->
      <div v-if="showAddForm && !disabled" class="flex flex-col gap-2 rounded-md border bg-muted/10 p-3">
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search class="size-3.5 text-muted-foreground" />
          </div>
          <Input
            :model-value="searchQuery"
            placeholder="Search lab test or type custom..."
            class="pl-9"
            @update:model-value="(v) => onSearchInput(v, null)"
            @keydown="onAddItemKeydown"
            @blur="onSearchBlur"
          />
          <div
            v-if="showSuggestions && suggestions.length > 0"
            class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
          >
            <template v-for="(items, category) in groupedSuggestions" :key="category">
              <p class="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {{ category }}
              </p>
              <button
                v-for="item in items"
                :key="item.name"
                type="button"
                :data-lab-highlighted="flatIndexOf(item) === highlightedIndex"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                :class="flatIndexOf(item) === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
                @mouseenter="highlightedIndex = flatIndexOf(item)"
                @mousedown.prevent="selectSuggestion(item)"
              >
                <span
                  v-if="item.source === 'clinic'"
                  class="shrink-0 rounded-full border border-green-300 bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
                >
                  Clinic
                </span>
                {{ item.name }}
              </button>
            </template>
          </div>
        </div>

        <Textarea
          :model-value="addItemInstruction"
          placeholder="Special instruction (optional)..."
          rows="2"
          class="text-sm"
          @update:model-value="(v) => addItemInstruction = String(v)"
        />

        <div class="flex items-center gap-2">
          <Button
            size="sm"
            :disabled="isAddingItem || !searchQuery.trim()"
            @click="handleAddItem"
          >
            <LoaderCircle v-if="isAddingItem" class="size-3.5 animate-spin" />
            <Plus v-else class="size-3.5" />
            Add
          </Button>
          <Button variant="ghost" size="sm" @click="cancelAddForm">
            Cancel
          </Button>
        </div>
      </div>

      <!-- Items list -->
      <div
        v-if="labOrder.items.length === 0"
        class="rounded-md border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground"
      >
        No tests added yet.
      </div>

      <div v-else class="flex flex-col divide-y rounded-md border">
        <div
          v-for="item in labOrder.items"
          :key="item.id"
          class="flex flex-col gap-2 p-3"
        >
          <!-- Edit mode -->
          <template v-if="editingItemId === item.id">
            <Input
              :model-value="editDescription"
              placeholder="Test description..."
              @update:model-value="(v) => editDescription = String(v)"
            />
            <Textarea
              :model-value="editInstruction"
              placeholder="Special instruction (optional)..."
              rows="2"
              class="text-sm"
              @update:model-value="(v) => editInstruction = String(v)"
            />
            <div class="flex items-center gap-2">
              <Button
                size="sm"
                :disabled="isSavingEdit || !editDescription.trim()"
                @click="saveEdit(item)"
              >
                <LoaderCircle v-if="isSavingEdit" class="size-3.5 animate-spin" />
                <CheckCircle2 v-else class="size-3.5" />
                Save
              </Button>
              <Button variant="ghost" size="sm" @click="cancelEdit">
                Cancel
              </Button>
            </div>
          </template>

          <!-- Display mode -->
          <template v-else>
            <div class="flex items-start justify-between gap-2">
              <button
                v-if="item.status === 'completed' && item.result_files.length"
                type="button"
                class="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left hover:opacity-70"
                @click="viewResult(item)"
              >
                <span class="text-sm font-medium underline-offset-4 hover:underline">{{ item.description }}</span>
                <span
                  v-if="item.instruction"
                  class="text-xs text-muted-foreground"
                >
                  {{ item.instruction }}
                </span>
              </button>
              <div v-else class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="text-sm font-medium">{{ item.description }}</span>
                <span
                  v-if="item.instruction"
                  class="text-xs text-muted-foreground"
                >
                  {{ item.instruction }}
                </span>
              </div>

              <div class="flex shrink-0 items-center gap-1.5">
                <Badge
                  variant="outline"
                  class="capitalize"
                  :class="itemStatusClass(item.status)"
                >
                  <CheckCircle2 v-if="item.status === 'completed'" class="size-3" />
                  <Clock v-else class="size-3" />
                  {{ item.status }}
                </Badge>
                <span v-if="item.result_files.length" class="text-[11px] text-muted-foreground">
                  {{ item.result_files.length }} {{ item.result_files.length === 1 ? 'file' : 'files' }}
                </span>

                <!-- Actions -->
                <TooltipProvider :delay-duration="300">
                  <template v-if="!disabled">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button
                          type="button"
                          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          @click="startEdit(item)"
                        >
                          <Pencil class="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Edit</p></TooltipContent>
                    </Tooltip>

                    <Tooltip v-if="item.status === 'pending'">
                      <TooltipTrigger as-child>
                        <button
                          type="button"
                          class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          @click="handleRemoveItem(item.id)"
                        >
                          <X class="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Remove</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button
                          type="button"
                          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          :disabled="uploadingItemId === item.id"
                          @click="triggerUpload(item.id)"
                        >
                          <LoaderCircle v-if="uploadingItemId === item.id" class="size-3.5 animate-spin" />
                          <Plus v-else-if="item.result_files.length" class="size-3.5" />
                          <Upload v-else class="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{{ item.result_files.length ? 'Add more files' : 'Upload result' }}</p>
                      </TooltipContent>
                    </Tooltip>
                  </template>

                  <Tooltip v-if="item.result_files.length">
                    <TooltipTrigger as-child>
                      <button
                        type="button"
                        class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        @click="viewResult(item)"
                      >
                        <FileDown class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>View results</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <EllipsisVertical class="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-40">
                    <DropdownMenuItem v-if="!disabled" @click="startEdit(item)">
                      <Pencil class="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem v-if="!disabled" @click="triggerUpload(item.id)">
                      <Upload class="size-3.5" />
                      {{ item.result_files.length ? 'Add more files' : 'Upload result' }}
                    </DropdownMenuItem>
                    <DropdownMenuItem v-if="item.result_files.length" @click="viewResult(item)">
                      <FileDown class="size-3.5" />
                      View results
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="!disabled && item.status === 'pending'"
                      class="text-destructive focus:text-destructive"
                      @click="handleRemoveItem(item.id)"
                    >
                      <X class="size-3.5" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Hidden file input for uploads -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*,.pdf"
      multiple
      class="hidden"
      @change="onFilesSelected"
    />

    <!-- Result preview modal -->
    <Dialog :open="previewOpen" @update:open="onPreviewClose">
      <DialogScrollContent class="sm:max-w-[66vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader class="border-b px-6 py-4">
          <DialogTitle>{{ previewTitle }}</DialogTitle>
          <DialogDescription class="sr-only">Lab result preview</DialogDescription>
        </DialogHeader>

        <!-- Carousel nav bar -->
        <div
          v-if="previewFiles.length > 1"
          class="flex items-center justify-between border-b bg-muted/30 px-6 py-2"
        >
          <button
            type="button"
            class="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            :disabled="previewIndex === 0"
            @click="previewIndex--"
          >
            <ChevronLeft class="size-4" />
            Previous
          </button>
          <span class="text-sm text-muted-foreground">
            {{ previewIndex + 1 }} / {{ previewFiles.length }}
          </span>
          <button
            type="button"
            class="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            :disabled="previewIndex === previewFiles.length - 1"
            @click="previewIndex++"
          >
            Next
            <ChevronRight class="size-4" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-6">
          <div v-if="isLoadingPreview" class="flex items-center justify-center py-12">
            <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
          </div>
          <template v-else-if="previewFiles.length">
            <iframe
              v-if="previewFiles[previewIndex].type === 'pdf'"
              :src="previewFiles[previewIndex].url"
              class="h-[80vh] w-full rounded border"
            />
            <img
              v-else
              :src="previewFiles[previewIndex].url"
              :alt="`${previewTitle} - ${previewIndex + 1} of ${previewFiles.length}`"
              class="w-full rounded"
            />
          </template>
        </div>
      </DialogScrollContent>
    </Dialog>

    <!-- Lab Request PDF Dialog -->
    <LabRequestDialog
      v-if="labOrder && labOrder.items.some(i => i.status === 'pending')"
      :open="showLabRequestDialog"
      :encounter-id="encounterId"
      :document-update="documentUpdate"
      @update:open="showLabRequestDialog = $event"
      @generated="labRequestDoc = $event"
    />
  </div>
</template>
