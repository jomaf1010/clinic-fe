<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { HttpError } from '@/lib/http'
import {
  AlertTriangle,
  Calculator,
  Plus,
  Pencil,
  X,
  LoaderCircle,
  CheckCircle2,
  EllipsisVertical,
  FileDown,
  FileText,
  Printer,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { openNewTab, printPdf } from '@/lib/utils'
import { prescriptionApi } from '../api/prescriptionApi'
import { documentApi, type GeneratedDocumentResponse } from '../api/documentApi'
import type { PrescriptionResponse, PrescriptionItem } from '../types/prescription.types'
import MedicineAutocomplete from '@/domains/medicine/components/MedicineAutocomplete.vue'
import { medicineApi } from '@/domains/medicine/api/medicineApi'
import { FREQUENCIES, FREQUENCY_DOSES_PER_DAY, ROUTES } from '@/domains/medicine/constants'
import type { MedicineSearchResult } from '@/domains/medicine/types/medicine.types'

const props = defineProps<{
  consultationId: string
  disabled: boolean
  realtimeUpdate?: PrescriptionResponse | null
  documentUpdate?: GeneratedDocumentResponse | null
}>()

// --- Constants ---
const DURATION_UNITS = ['days', 'weeks', 'months'] as const

const INSTRUCTION_PRESETS = ['Before meal', 'After meal'] as const

// --- State ---
const prescription = ref<PrescriptionResponse | null>(null)
const isLoading = ref(false)

watch(() => props.realtimeUpdate, (update) => {
  if (update) {
    prescription.value = update
  }
})

// --- PDF generation ---
const pdfDoc = ref<GeneratedDocumentResponse | null>(null)
const isGeneratingPdf = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadDocuments() {
  try {
    const res = await documentApi.list(props.consultationId)
    pdfDoc.value = res.data.find((d) => d.type === 'prescription') ?? null
  } catch {
    // ignore
  }
}

async function generatePdf() {
  isGeneratingPdf.value = true
  try {
    const res = await documentApi.generate(props.consultationId, 'prescription')
    pdfDoc.value = res.data
    startPolling()
  } catch (err: unknown) {
    const msg = err instanceof HttpError && (err.data as { message?: string })?.message
      ? (err.data as { message: string }).message
      : 'Failed to generate prescription PDF'
    toast.error(msg)
    isGeneratingPdf.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await loadDocuments()
    if (pdfDoc.value?.status === 'completed' || pdfDoc.value?.status === 'failed') {
      stopPolling()
      isGeneratingPdf.value = false
      if (pdfDoc.value.status === 'completed') {
        toast.success('Prescription PDF is ready')
      } else {
        toast.error('PDF generation failed')
      }
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function downloadPdf() {
  if (!pdfDoc.value?.id) return
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(pdfDoc.value.id)
    tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get download link')
  }
}

async function printPrescription() {
  if (!pdfDoc.value?.id) return
  try {
    const url = await documentApi.getSignedUrl(pdfDoc.value.id)
    printPdf(url)
  } catch {
    toast.error('Failed to get download link')
  }
}

watch(() => props.documentUpdate, (update) => {
  if (update && update.type === 'prescription') {
    if (pdfDoc.value) {
      pdfDoc.value = { ...pdfDoc.value, status: update.status }
    } else {
      pdfDoc.value = update
    }
    if (update.status === 'completed' || update.status === 'failed') {
      stopPolling()
      isGeneratingPdf.value = false
      if (update.status === 'completed') {
        toast.success('Prescription PDF is ready')
      }
    }
  }
})

onUnmounted(stopPolling)

// --- Modal state ---
const showModal = ref(false)
const modalMode = ref<'create' | 'add' | 'edit'>('create')
const editingItemId = ref<string | null>(null)
const isSaving = ref(false)
const durationWarning = ref(false)

// --- Calculator state ---
const showCalc = ref<Record<string, boolean>>({})
const calcDisplay = ref<Record<string, string>>({})

function toggleCalc(key: string) {
  showCalc.value[key] = !showCalc.value[key]
  if (showCalc.value[key] && !calcDisplay.value[key]) {
    calcDisplay.value[key] = ''
  }
}

function calcInput(key: string, val: string) {
  const current = calcDisplay.value[key] ?? ''
  if (val === 'C') {
    calcDisplay.value[key] = ''
  } else if (val === '⌫') {
    calcDisplay.value[key] = current.slice(0, -1)
  } else if (val === '=') {
    try {
      // Safe eval: only allow numbers and basic operators
      const sanitized = current.replace(/[^0-9+\-*/.()]/g, '')
      if (sanitized) {
        const result = Function('"use strict"; return (' + sanitized + ')')() as number
        calcDisplay.value[key] = String(Math.round(result * 100) / 100)
      }
    } catch {
      // ignore invalid expression
    }
  } else {
    calcDisplay.value[key] = current + val
  }
}

function evalCalcExpression(expr: string): number | null {
  try {
    const sanitized = expr.replace(/[^0-9+\-*/.()]/g, '')
    if (!sanitized) return null
    const result = Function('"use strict"; return (' + sanitized + ')')() as number
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

function applyCalcResult(key: string, target: ReturnType<typeof emptyItem>) {
  const expr = calcDisplay.value[key] ?? ''
  const result = evalCalcExpression(expr)
  if (result !== null && result > 0) {
    target.doses_per_unit = Math.ceil(result)
    calcDisplay.value[key] = String(Math.round(result * 100) / 100)
    showCalc.value[key] = false
  }
}

const calcButtons = ['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','C','+','⌫','(',')','='] as const

function calcButtonToOp(btn: string): string {
  if (btn === '÷') return '/'
  if (btn === '×') return '*'
  return btn
}

// --- Modal form (single item) ---
const modalForm = ref(emptyItem())

// --- Create form: multiple items ---
const createFormItems = ref<ReturnType<typeof emptyItem>[]>([emptyItem()])

watch(createFormItems, () => {
  if (durationWarning.value && !hasMissingDuration(
    createFormItems.value.filter((i) => i.drug_name.trim() && i.dose.trim()),
  )) {
    durationWarning.value = false
  }
}, { deep: true })

watch(modalForm, () => {
  if (durationWarning.value && modalForm.value.duration_value) {
    durationWarning.value = false
  }
}, { deep: true })

function emptyItem() {
  return {
    drug_name: '',
    dose: '',
    frequency: 'TID',
    duration_value: '',
    duration_unit: 'days' as string,
    route: 'Oral',
    instructions: '',
    medicine_id: null as string | null,
    unit_price: null as number | null,
    quantity: null as number | null,
    is_multi_dose: false,
    doses_per_unit: null as number | null,
    out_of_stock: false,
  }
}

function isManualQtyFrequency(freq: string): boolean {
  return FREQUENCY_DOSES_PER_DAY[freq] === null || FREQUENCY_DOSES_PER_DAY[freq] === undefined
}

function durationToDays(value: string, unit: string): number {
  const v = parseFloat(value) || 0
  if (unit === 'weeks') return v * 7
  if (unit === 'months') return v * 30
  return v
}

function computeQuantity(item: ReturnType<typeof emptyItem>): number | null {
  if (isManualQtyFrequency(item.frequency)) return item.quantity
  const dosesPerDay = FREQUENCY_DOSES_PER_DAY[item.frequency]
  if (dosesPerDay == null || !item.duration_value) return null
  const days = durationToDays(item.duration_value, item.duration_unit)
  return Math.ceil(dosesPerDay * days)
}

async function handleMedicineSelect(result: MedicineSearchResult, target: ReturnType<typeof emptyItem>) {
  target.drug_name = result.display_name
  target.out_of_stock = result.inventory_enabled && result.stock_quantity <= 0
  if (result.dosage_strength) target.dose = result.dosage_strength
  if (result.default_frequency) target.frequency = result.default_frequency
  if (result.default_route) target.route = result.default_route
  if (result.default_instructions) target.instructions = result.default_instructions
  if (result.price_per_piece != null) target.unit_price = result.price_per_piece
  target.is_multi_dose = result.is_multi_dose ?? false

  if (result.source === 'clinic') {
    target.medicine_id = result.id
  } else if (result.source === 'system') {
    try {
      const res = await medicineApi.create({
        generic_name: result.generic_name ?? result.display_name,
        brand_name: result.brand_name,
        dosage_strength: result.dosage_strength,
        dosage_form: result.dosage_form,
        system_medicine_id: result.id,
      })
      target.medicine_id = res.data.id
    } catch {
      // fallback: save without medicine_id
    }
  }
}

async function handleMedicineCreateNew(name: string, target: ReturnType<typeof emptyItem>) {
  target.drug_name = name
  target.medicine_id = null
  try {
    const res = await medicineApi.create({ generic_name: name })
    target.medicine_id = res.data.id
  } catch {
    // fallback: save without medicine_id
  }
}

function formatDuration(item: ReturnType<typeof emptyItem>): string {
  if (!item.duration_value) return ''
  return `${item.duration_value} ${item.duration_unit}`
}

function parseDuration(duration: string): { value: string; unit: string } {
  const match = duration.match(/^(\d+)\s*(days?|weeks?|months?)$/i)
  if (!match) return { value: duration, unit: 'days' }
  const unit = match[2]!.toLowerCase().replace(/s$/, '') + 's'
  return { value: match[1]!, unit }
}

// --- Load ---
async function loadPrescription() {
  isLoading.value = true
  try {
    const res = await prescriptionApi.getForEncounter(props.consultationId)
    prescription.value = res.data ?? null
  } catch {
    // silent
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadPrescription()
  loadDocuments()
})

// --- Modal open helpers ---
function openCreateModal() {
  modalMode.value = 'create'
  createFormItems.value = [emptyItem()]
  durationWarning.value = false
  showModal.value = true
}

function openAddModal() {
  modalMode.value = 'add'
  modalForm.value = emptyItem()
  durationWarning.value = false
  showModal.value = true
}

function openEditModal(item: PrescriptionItem) {
  modalMode.value = 'edit'
  editingItemId.value = item.id
  const dur = item.duration ? parseDuration(item.duration) : { value: '', unit: 'days' }
  modalForm.value = {
    drug_name: item.drug_name,
    dose: item.dose,
    frequency: item.frequency,
    duration_value: dur.value,
    duration_unit: dur.unit,
    route: item.route,
    instructions: item.instructions ?? '',
    medicine_id: item.medicine_id ?? null,
    unit_price: item.unit_price ?? null,
    quantity: item.quantity ?? null,
    is_multi_dose: item.is_multi_dose ?? false,
    doses_per_unit: item.doses_per_unit ?? null,
  }
  durationWarning.value = false
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingItemId.value = null
  durationWarning.value = false
}

// --- Create form helpers ---
function addCreateFormRow() {
  createFormItems.value.push(emptyItem())
}

function removeCreateFormRow(index: number) {
  if (createFormItems.value.length === 1) return
  createFormItems.value.splice(index, 1)
}

// --- Duration/quantity check ---
function hasMissingDuration(items: ReturnType<typeof emptyItem>[]): boolean {
  return items.some((i) => {
    if (!i.drug_name.trim() || !i.dose.trim()) return false
    if (isManualQtyFrequency(i.frequency)) return !i.quantity
    return !i.duration_value
  })
}

// --- Save handler ---
function handleSave(force = false) {
  if (modalMode.value === 'create') {
    const valid = createFormItems.value.filter((i) => i.drug_name.trim() && i.dose.trim())
    if (!valid.length) return
    if (!force && hasMissingDuration(valid)) {
      durationWarning.value = true
      return
    }
    durationWarning.value = false
    doCreate()
  } else if (modalMode.value === 'add') {
    if (!modalForm.value.drug_name.trim() || !modalForm.value.dose.trim()) return
    if (!force && !modalForm.value.duration_value) {
      durationWarning.value = true
      return
    }
    durationWarning.value = false
    doAddItem()
  } else {
    if (!modalForm.value.drug_name.trim() || !modalForm.value.dose.trim()) return
    if (!force && !modalForm.value.duration_value) {
      durationWarning.value = true
      return
    }
    durationWarning.value = false
    doEditItem()
  }
}

async function doCreate() {
  const validItems = createFormItems.value
    .filter((i) => i.drug_name.trim() && i.dose.trim())
    .map((i) => ({
      drug_name: i.drug_name.trim(),
      dose: i.dose.trim(),
      frequency: i.frequency,
      duration: formatDuration(i) || undefined,
      route: i.route,
      instructions: i.instructions.trim() || undefined,
      medicine_id: i.medicine_id || undefined,
      unit_price: i.unit_price ?? undefined,
      quantity: (isManualQtyFrequency(i.frequency) ? i.quantity : computeQuantity(i)) ?? undefined,
      is_multi_dose: i.is_multi_dose || undefined,
      doses_per_unit: i.is_multi_dose ? (i.doses_per_unit ?? undefined) : undefined,
    }))

  if (!validItems.length) return

  isSaving.value = true
  try {
    const res = await prescriptionApi.create(props.consultationId, validItems)
    prescription.value = res.data
    closeModal()
    toast.success('Prescription created')
  } catch {
    toast.error('Failed to create prescription')
  } finally {
    isSaving.value = false
  }
}

async function doAddItem() {
  if (!prescription.value) return
  isSaving.value = true
  try {
    const qty = isManualQtyFrequency(modalForm.value.frequency) ? modalForm.value.quantity : computeQuantity(modalForm.value)
    const res = await prescriptionApi.addItem(prescription.value.id, {
      drug_name: modalForm.value.drug_name.trim(),
      dose: modalForm.value.dose.trim(),
      frequency: modalForm.value.frequency,
      duration: formatDuration(modalForm.value) || undefined,
      route: modalForm.value.route,
      instructions: modalForm.value.instructions.trim() || undefined,
      medicine_id: modalForm.value.medicine_id || undefined,
      unit_price: modalForm.value.unit_price ?? undefined,
      quantity: qty ?? undefined,
      is_multi_dose: modalForm.value.is_multi_dose || undefined,
      doses_per_unit: modalForm.value.is_multi_dose ? (modalForm.value.doses_per_unit ?? undefined) : undefined,
    })
    prescription.value = res.data
    closeModal()
    toast.success('Medicine added')
  } catch {
    toast.error('Failed to add medicine')
  } finally {
    isSaving.value = false
  }
}

async function doEditItem() {
  if (!prescription.value || !editingItemId.value) return
  isSaving.value = true
  try {
    const qty = isManualQtyFrequency(modalForm.value.frequency) ? modalForm.value.quantity : computeQuantity(modalForm.value)
    const res = await prescriptionApi.updateItem(prescription.value.id, editingItemId.value, {
      drug_name: modalForm.value.drug_name.trim(),
      dose: modalForm.value.dose.trim(),
      frequency: modalForm.value.frequency,
      duration: formatDuration(modalForm.value) || undefined,
      route: modalForm.value.route,
      instructions: modalForm.value.instructions.trim() || undefined,
      medicine_id: modalForm.value.medicine_id || undefined,
      unit_price: modalForm.value.unit_price ?? undefined,
      quantity: qty ?? undefined,
      is_multi_dose: modalForm.value.is_multi_dose || undefined,
      doses_per_unit: modalForm.value.is_multi_dose ? (modalForm.value.doses_per_unit ?? undefined) : undefined,
    })
    prescription.value = res.data
    closeModal()
    toast.success('Medicine updated')
  } catch {
    toast.error('Failed to update medicine')
  } finally {
    isSaving.value = false
  }
}

// --- Remove item ---
async function handleRemoveItem(itemId: string) {
  if (!prescription.value) return
  try {
    const res = await prescriptionApi.removeItem(prescription.value.id, itemId)
    prescription.value = res.data
    toast.success('Medicine removed')
  } catch {
    toast.error('Failed to remove medicine')
  }
}

function frequencyShortDesc(value: string): string | null {
  const match = FREQUENCIES.find((f) => f.value === value)
  if (!match) return null
  const desc = match.label.replace(/^[A-Za-z0-9]+ - /, '')
  return desc !== match.label ? desc : null
}

const modalTitle = {
  create: 'Add Prescription',
  add: 'Add Medicine',
  edit: 'Edit Medicine',
}

const modalDescription = {
  create: 'Add one or more medicines to the prescription.',
  add: 'Add a new medicine to the prescription.',
  edit: 'Update the medicine details.',
}

const saveLabel = {
  create: 'Save Prescription',
  add: 'Add Medicine',
  edit: 'Save Changes',
}

const canSave = () => {
  if (modalMode.value === 'create') {
    return createFormItems.value.some((r) => r.drug_name.trim() && r.dose.trim())
  }
  return modalForm.value.drug_name.trim() && modalForm.value.dose.trim()
}

</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Actions -->
    <div class="flex items-center justify-between gap-2">
      <Badge
        v-if="prescription"
        variant="outline"
        class="border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400"
      >
        {{ prescription.items.length }} {{ prescription.items.length === 1 ? 'medicine' : 'medicines' }}
      </Badge>
      <div v-else />

      <!-- PDF actions -->
      <div v-if="prescription && prescription.items.length > 0" class="flex items-center gap-1.5">
        <Button
          v-if="pdfDoc?.status === 'completed'"
          variant="outline"
          size="sm"
          class="h-7 gap-1.5 text-xs"
          @click="printPrescription"
        >
          <Printer class="size-3" />
          Print
        </Button>
        <Button
          v-if="pdfDoc?.status === 'completed'"
          variant="outline"
          size="sm"
          class="h-7 gap-1.5 text-xs"
          @click="downloadPdf"
        >
          <FileDown class="size-3" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-7 gap-1.5 text-xs"
          :disabled="isGeneratingPdf"
          @click="generatePdf"
        >
          <LoaderCircle v-if="isGeneratingPdf" class="size-3 animate-spin" />
          <FileText v-else class="size-3" />
          {{ isGeneratingPdf ? 'Generating...' : pdfDoc ? 'Regenerate' : 'Generate PDF' }}
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center gap-2 py-2 text-sm text-muted-foreground">
      <LoaderCircle class="size-4 animate-spin" />
      Loading...
    </div>

    <!-- No prescription -->
    <template v-else-if="!prescription">
      <div v-if="!disabled">
        <Button
          variant="outline"
          size="sm"
          class="gap-1.5"
          @click="openCreateModal"
        >
          <Plus class="size-3.5" />
          Add Prescription
        </Button>
      </div>
      <div
        v-else
        class="rounded-md border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground"
      >
        No prescription for this consultation.
      </div>
    </template>

    <!-- Prescription exists: items list -->
    <template v-else>
      <div
        v-if="prescription.items.length === 0"
        class="rounded-md border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground"
      >
        No medicines added yet.
      </div>

      <div v-else class="flex flex-col divide-y rounded-md border">
        <div
          v-for="item in prescription.items"
          :key="item.id"
          class="flex items-start justify-between gap-2 p-3"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span class="text-sm font-semibold">{{ item.drug_name }}</span>
              <span class="text-sm text-muted-foreground">{{ item.dose }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                <span class="font-medium text-foreground/70">{{ item.frequency }}</span>
                <span v-if="frequencyShortDesc(item.frequency)"> ({{ frequencyShortDesc(item.frequency) }})</span>
              </span>
              <span v-if="item.duration" class="before:mr-2 before:content-['·']">{{ item.duration }}</span>
              <span v-if="item.is_multi_dose && item.doses_per_unit && item.quantity" class="before:mr-2 before:content-['·']">
                {{ item.quantity }} doses ({{ Math.ceil(item.quantity / item.doses_per_unit) }} {{ Math.ceil(item.quantity / item.doses_per_unit) === 1 ? 'unit' : 'units' }})
              </span>
              <span v-else-if="item.quantity" class="before:mr-2 before:content-['·']">{{ item.quantity }} pcs</span>
              <span
                v-if="item.dispensed_quantity != null && item.quantity && item.dispensed_quantity < item.quantity"
                class="before:mr-2 before:content-['·'] text-amber-600 dark:text-amber-400"
              >{{ item.dispensed_quantity }}/{{ item.quantity }} dispensed</span>
              <span
                v-else-if="item.dispensed_quantity != null && item.quantity && item.dispensed_quantity >= item.quantity"
                class="before:mr-2 before:content-['·'] text-green-600 dark:text-green-400"
              >fully dispensed</span>
              <span v-if="item.route !== 'Oral'" class="before:mr-2 before:content-['·']">{{ item.route }}</span>
            </div>
            <span v-if="item.instructions" class="text-xs italic text-muted-foreground">
              {{ item.instructions }}
            </span>
            <span v-if="item.out_of_stock" class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle class="size-3 shrink-0" />
              Out of stock
            </span>
          </div>

          <div v-if="!disabled" class="flex shrink-0 items-center gap-1">
            <TooltipProvider :delay-duration="300">
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    @click="openEditModal(item)"
                  >
                    <Pencil class="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Edit</p></TooltipContent>
              </Tooltip>

              <Tooltip>
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
              <DropdownMenuContent align="end" class="w-36">
                <DropdownMenuItem @click="openEditModal(item)">
                  <Pencil class="size-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
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
      </div>

      <Button
        v-if="!disabled"
        variant="outline"
        size="sm"
        class="gap-1.5 self-start"
        @click="openAddModal"
      >
        <Plus class="size-3.5" />
        Add More
      </Button>

    </template>

    <!-- Medicine Modal -->
    <Dialog :open="showModal" @update:open="(val) => { if (!val) closeModal() }">
      <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ modalTitle[modalMode] }}</DialogTitle>
          <DialogDescription>{{ modalDescription[modalMode] }}</DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-4" @submit.prevent="handleSave()">
          <!-- Create mode: multiple items -->
          <template v-if="modalMode === 'create'">
            <div
              v-for="(row, index) in createFormItems"
              :key="index"
              class="flex flex-col gap-3 rounded-md border bg-muted/10 p-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-muted-foreground">Medicine {{ index + 1 }}</span>
                <button
                  v-if="createFormItems.length > 1"
                  type="button"
                  class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  @click="removeCreateFormRow(index)"
                >
                  <X class="size-3.5" />
                </button>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Drug name *</label>
                  <MedicineAutocomplete
                    :model-value="row.drug_name"
                    @update:model-value="row.drug_name = $event"
                    @select="(result: MedicineSearchResult) => handleMedicineSelect(result, row)"
                    @create-new="(name: string) => handleMedicineCreateNew(name, row)"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Dose *</label>
                  <Input v-model="row.dose" placeholder="e.g. 500mg" />
                </div>
              </div>
              <div v-if="row.out_of_stock" class="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle class="size-3.5 shrink-0" />
                This medicine is currently out of stock.
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Frequency</label>
                  <Select v-model="row.frequency">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="f in FREQUENCIES" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <!-- Duration: shown for computable frequencies -->
                <div v-if="!isManualQtyFrequency(row.frequency)" class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Duration</label>
                  <div class="flex gap-1.5">
                    <Input v-model="row.duration_value" type="number" placeholder="7" min="1" class="w-16" />
                    <Select v-model="row.duration_unit">
                      <SelectTrigger class="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="u in DURATION_UNITS" :key="u" :value="u">{{ u }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <!-- Manual qty for PRN/STAT -->
                <div v-if="isManualQtyFrequency(row.frequency)" class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Total Qty (pcs) *</label>
                  <Input
                    :model-value="row.quantity ?? ''"
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    @update:model-value="row.quantity = $event ? Number($event) : null"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Route</label>
                  <Select v-model="row.route">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="r in ROUTES" :key="r" :value="r">{{ r }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <!-- Multi-dose: doses per unit input -->
              <div v-if="row.is_multi_dose" class="flex flex-col gap-2">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-1.5">
                      <label class="text-xs text-muted-foreground">Doses per unit *</label>
                      <button
                        type="button"
                        class="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Dosage calculator"
                        @click="toggleCalc('create-' + index)"
                      >
                        <Calculator class="size-3.5" />
                      </button>
                    </div>
                    <Input
                      :model-value="row.doses_per_unit ?? ''"
                      type="number"
                      min="1"
                      placeholder="e.g. 12"
                      @update:model-value="row.doses_per_unit = $event ? Number($event) : null"
                    />
                  </div>
                  <div v-if="computeQuantity(row) && row.doses_per_unit" class="flex flex-col gap-1">
                    <label class="text-xs text-muted-foreground">Units needed</label>
                    <div class="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm tabular-nums">
                      {{ Math.ceil(computeQuantity(row)! / row.doses_per_unit) }}
                      {{ Math.ceil(computeQuantity(row)! / row.doses_per_unit) === 1 ? 'unit' : 'units' }}
                      <span class="ml-1 text-xs text-muted-foreground">({{ computeQuantity(row) }} doses)</span>
                    </div>
                  </div>
                </div>
                <!-- Calculator panel -->
                <div v-if="showCalc['create-' + index]" class="rounded-md border bg-muted/30 p-3">
                  <p class="mb-2 text-xs text-muted-foreground">e.g. bottle 60ml ÷ 5ml per dose = 12 doses/unit</p>
                  <div class="mb-2 flex h-9 items-center rounded-md border bg-background px-3 text-sm font-mono tabular-nums">
                    {{ calcDisplay['create-' + index] || '0' }}
                  </div>
                  <div class="grid grid-cols-4 gap-1">
                    <button
                      v-for="btn in calcButtons"
                      :key="btn"
                      type="button"
                      class="flex h-8 items-center justify-center rounded-md border text-sm transition-colors hover:bg-accent"
                      :class="btn === '=' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''"
                      @click="calcInput('create-' + index, calcButtonToOp(btn))"
                    >
                      {{ btn }}
                    </button>
                  </div>
                  <button
                    type="button"
                    class="mt-2 w-full rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    :disabled="!calcDisplay['create-' + index]"
                    @click="applyCalcResult('create-' + index, row)"
                  >
                    Apply as doses per unit
                  </button>
                </div>
              </div>

              <!-- Computed qty display for regular frequencies (non-multi-dose) -->
              <div v-else-if="!isManualQtyFrequency(row.frequency) && computeQuantity(row)" class="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                Total: <span class="font-medium tabular-nums text-foreground">{{ computeQuantity(row) }} pcs</span>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Instructions</label>
                <Input v-model="row.instructions" placeholder="e.g. after meals, with water" />
                <div class="flex gap-1.5">
                  <button
                    v-for="preset in INSTRUCTION_PRESETS"
                    :key="preset"
                    type="button"
                    class="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    @click="row.instructions = preset"
                  >
                    {{ preset }}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              @click="addCreateFormRow"
            >
              <Plus class="size-3.5" />
              Add another medicine
            </button>
          </template>

          <!-- Add / Edit mode: single item -->
          <template v-else>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Drug name *</label>
                <MedicineAutocomplete
                  :model-value="modalForm.drug_name"
                  @update:model-value="modalForm.drug_name = $event"
                  @select="(result: MedicineSearchResult) => handleMedicineSelect(result, modalForm)"
                  @create-new="(name: string) => handleMedicineCreateNew(name, modalForm)"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Dose *</label>
                <Input v-model="modalForm.dose" placeholder="e.g. 500mg" />
              </div>
            </div>
            <div v-if="modalForm.out_of_stock" class="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle class="size-3.5 shrink-0" />
              This medicine is currently out of stock.
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Frequency</label>
                <Select v-model="modalForm.frequency">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="f in FREQUENCIES" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <!-- Duration: shown for computable frequencies -->
              <div v-if="!isManualQtyFrequency(modalForm.frequency)" class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Duration</label>
                <div class="flex gap-1.5">
                  <Input v-model="modalForm.duration_value" type="number" placeholder="7" min="1" class="w-16" />
                  <Select v-model="modalForm.duration_unit">
                    <SelectTrigger class="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="u in DURATION_UNITS" :key="u" :value="u">{{ u }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <!-- Manual qty for PRN/STAT -->
              <div v-if="isManualQtyFrequency(modalForm.frequency)" class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Total Qty (pcs) *</label>
                <Input
                  :model-value="modalForm.quantity ?? ''"
                  type="number"
                  min="1"
                  placeholder="e.g. 10"
                  @update:model-value="modalForm.quantity = $event ? Number($event) : null"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Route</label>
                <Select v-model="modalForm.route">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="r in ROUTES" :key="r" :value="r">{{ r }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <!-- Multi-dose: doses per unit input -->
            <div v-if="modalForm.is_multi_dose" class="flex flex-col gap-2">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1.5">
                    <label class="text-xs text-muted-foreground">Doses per unit *</label>
                    <button
                      type="button"
                      class="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Dosage calculator"
                      @click="toggleCalc('modal')"
                    >
                      <Calculator class="size-3.5" />
                    </button>
                  </div>
                  <Input
                    :model-value="modalForm.doses_per_unit ?? ''"
                    type="number"
                    min="1"
                    placeholder="e.g. 12"
                    @update:model-value="modalForm.doses_per_unit = $event ? Number($event) : null"
                  />
                </div>
                <div v-if="computeQuantity(modalForm) && modalForm.doses_per_unit" class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Units needed</label>
                  <div class="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm tabular-nums">
                    {{ Math.ceil(computeQuantity(modalForm)! / modalForm.doses_per_unit) }}
                    {{ Math.ceil(computeQuantity(modalForm)! / modalForm.doses_per_unit) === 1 ? 'unit' : 'units' }}
                    <span class="ml-1 text-xs text-muted-foreground">({{ computeQuantity(modalForm) }} doses)</span>
                  </div>
                </div>
              </div>
              <!-- Calculator panel -->
              <div v-if="showCalc['modal']" class="rounded-md border bg-muted/30 p-3">
                <p class="mb-2 text-xs text-muted-foreground">e.g. bottle 60ml ÷ 5ml per dose = 12 doses/unit</p>
                <div class="mb-2 flex h-9 items-center rounded-md border bg-background px-3 text-sm font-mono tabular-nums">
                  {{ calcDisplay['modal'] || '0' }}
                </div>
                <div class="grid grid-cols-4 gap-1">
                  <button
                    v-for="btn in calcButtons"
                    :key="btn"
                    type="button"
                    class="flex h-8 items-center justify-center rounded-md border text-sm transition-colors hover:bg-accent"
                    :class="btn === '=' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''"
                    @click="calcInput('modal', calcButtonToOp(btn))"
                  >
                    {{ btn }}
                  </button>
                </div>
                <button
                  type="button"
                  class="mt-2 w-full rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  :disabled="!calcDisplay['modal']"
                  @click="applyCalcResult('modal', modalForm)"
                >
                  Apply as doses per unit
                </button>
              </div>
            </div>

            <!-- Computed qty display for regular frequencies (non-multi-dose) -->
            <div v-else-if="!isManualQtyFrequency(modalForm.frequency) && computeQuantity(modalForm)" class="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
              Total: <span class="font-medium tabular-nums text-foreground">{{ computeQuantity(modalForm) }} pcs</span>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted-foreground">Instructions</label>
              <Input v-model="modalForm.instructions" placeholder="e.g. after meals, with water" />
              <div class="flex gap-1.5">
                <button
                  v-for="preset in INSTRUCTION_PRESETS"
                  :key="preset"
                  type="button"
                  class="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  @click="modalForm.instructions = preset"
                >
                  {{ preset }}
                </button>
              </div>
            </div>
          </template>

          <!-- Duration warning -->
          <div v-if="durationWarning" class="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">
            <span>{{ modalMode === 'create' ? 'Some medicines have no duration/quantity.' : 'No duration or quantity specified.' }} Save anyway?</span>
            <Button type="button" size="sm" variant="outline" class="h-7 text-xs" @click="handleSave(true)">
              Yes, save
            </Button>
            <button type="button" class="text-xs underline" @click="durationWarning = false">Cancel</button>
          </div>

          <DialogFooter v-else>
            <Button type="button" variant="outline" :disabled="isSaving" @click="closeModal">
              Cancel
            </Button>
            <Button :disabled="isSaving || !canSave()">
              <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
              <CheckCircle2 v-else class="size-3.5" />
              {{ saveLabel[modalMode] }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
