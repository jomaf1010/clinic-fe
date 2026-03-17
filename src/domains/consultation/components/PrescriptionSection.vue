<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import {
  Pill,
  Plus,
  Pencil,
  X,
  LoaderCircle,
  CheckCircle2,
  EllipsisVertical,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { prescriptionApi } from '../api/prescriptionApi'
import type { PrescriptionResponse, PrescriptionItem } from '../types/prescription.types'
import MedicineAutocomplete from '@/domains/medicine/components/MedicineAutocomplete.vue'
import { medicineApi } from '@/domains/medicine/api/medicineApi'
import { FREQUENCIES, ROUTES } from '@/domains/medicine/constants'
import type { MedicineSearchResult } from '@/domains/medicine/types/medicine.types'

const props = defineProps<{
  consultationId: string
  disabled: boolean
  realtimeUpdate?: PrescriptionResponse | null
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

// --- Modal state ---
const showModal = ref(false)
const modalMode = ref<'create' | 'add' | 'edit'>('create')
const editingItemId = ref<string | null>(null)
const isSaving = ref(false)
const durationWarning = ref(false)

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
  }
}

async function handleMedicineSelect(result: MedicineSearchResult, target: ReturnType<typeof emptyItem>) {
  target.drug_name = result.name
  if (result.default_dose) target.dose = result.default_dose
  if (result.default_frequency) target.frequency = result.default_frequency
  if (result.default_route) target.route = result.default_route
  if (result.default_instructions) target.instructions = result.default_instructions
  if (result.default_price != null) target.unit_price = result.default_price

  if (result.source === 'clinic') {
    target.medicine_id = result.id
  } else if (result.source === 'system') {
    try {
      const res = await medicineApi.create({
        name: result.name,
        generic_name: result.generic_name,
        strength: result.strength,
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
    const res = await medicineApi.create({ name })
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
    const res = await prescriptionApi.getForConsultation(props.consultationId)
    prescription.value = res.data ?? null
  } catch {
    // silent
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPrescription)

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

// --- Duration check ---
function hasMissingDuration(items: ReturnType<typeof emptyItem>[]): boolean {
  return items.some((i) => i.drug_name.trim() && i.dose.trim() && !i.duration_value)
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
    const res = await prescriptionApi.addItem(prescription.value.id, {
      drug_name: modalForm.value.drug_name.trim(),
      dose: modalForm.value.dose.trim(),
      frequency: modalForm.value.frequency,
      duration: formatDuration(modalForm.value) || undefined,
      route: modalForm.value.route,
      instructions: modalForm.value.instructions.trim() || undefined,
      medicine_id: modalForm.value.medicine_id || undefined,
      unit_price: modalForm.value.unit_price ?? undefined,
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
    const res = await prescriptionApi.updateItem(prescription.value.id, editingItemId.value, {
      drug_name: modalForm.value.drug_name.trim(),
      dose: modalForm.value.dose.trim(),
      frequency: modalForm.value.frequency,
      duration: formatDuration(modalForm.value) || undefined,
      route: modalForm.value.route,
      instructions: modalForm.value.instructions.trim() || undefined,
      medicine_id: modalForm.value.medicine_id || undefined,
      unit_price: modalForm.value.unit_price ?? undefined,
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
    <!-- Header -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Label class="flex items-center gap-1.5">
          <Pill class="size-3.5 text-muted-foreground" />
          Prescription
        </Label>
        <Badge
          v-if="prescription"
          variant="outline"
          class="border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400"
        >
          {{ prescription.items.length }} {{ prescription.items.length === 1 ? 'medicine' : 'medicines' }}
        </Badge>
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
              <span v-if="item.route !== 'Oral'" class="before:mr-2 before:content-['·']">{{ item.route }}</span>
            </div>
            <span v-if="item.instructions" class="text-xs italic text-muted-foreground">
              {{ item.instructions }}
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
                <div class="flex flex-col gap-1">
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
              <div class="flex flex-col gap-1">
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
            <span>{{ modalMode === 'create' ? 'Some medicines have no duration.' : 'No duration specified.' }} Save anyway?</span>
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
