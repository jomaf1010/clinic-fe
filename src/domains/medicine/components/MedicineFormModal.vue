<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { LoaderCircle, CheckCircle2, Search, CornerDownLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FREQUENCIES, ROUTES } from '../constants'
import { medicineApi } from '../api/medicineApi'
import type { ClinicMedicine, CreateMedicinePayload, UpdateMedicinePayload, SystemMedicine } from '../types/medicine.types'

const props = defineProps<{
  open: boolean
  medicine: ClinicMedicine | null // null = create mode
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: CreateMedicinePayload | UpdateMedicinePayload]
}>()

const isSaving = ref(false)

const form = ref(emptyForm())
const systemMedicineId = ref<string | null>(null)

// System medicine search state
const systemResults = ref<SystemMedicine[]>([])
const showSystemDropdown = ref(false)
const highlightedIndex = ref(-1)
const isSearching = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

function scrollToHighlighted() {
  nextTick(() => {
    const container = dropdownRef.value
    if (!container) return
    const el = container.children[highlightedIndex.value] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function emptyForm() {
  return {
    generic_name: '',
    brand_name: '',
    dosage_strength: '',
    dosage_form: '',
    classification: '',
    pharmacologic_category: '',
    manufacturer: '',
    country_of_origin: '',
    registration_number: '',
    default_frequency: '',
    default_route: 'Oral',
    default_instructions: '',
    price_per_piece: '',
    price_per_pack: '',
    quantity_per_pack: '',
    is_multi_dose: false,
    inventory_enabled: true,
    stock_quantity: '0',
  }
}

function onGenericNameInput(val: string | number) {
  form.value.generic_name = String(val)
  systemMedicineId.value = null

  if (searchTimer) clearTimeout(searchTimer)
  const q = form.value.generic_name.trim()
  if (q.length < 2 || props.medicine) {
    systemResults.value = []
    showSystemDropdown.value = false
    return
  }

  showSystemDropdown.value = true
  highlightedIndex.value = 0

  searchTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const res = await medicineApi.searchSystem(q)
      systemResults.value = res.data
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectSystemMedicine(sm: SystemMedicine) {
  form.value.generic_name = sm.generic_name ?? ''
  form.value.brand_name = sm.brand_name ?? ''
  form.value.dosage_strength = sm.dosage_strength ?? ''
  form.value.dosage_form = sm.dosage_form ?? ''
  form.value.classification = sm.classification ?? ''
  form.value.pharmacologic_category = sm.pharmacologic_category ?? ''
  form.value.manufacturer = sm.manufacturer ?? ''
  form.value.country_of_origin = sm.country_of_origin ?? ''
  form.value.registration_number = sm.registration_number ?? ''
  systemMedicineId.value = sm.id
  systemResults.value = []
  showSystemDropdown.value = false
}

function selectCustomName() {
  systemMedicineId.value = null
  systemResults.value = []
  showSystemDropdown.value = false
}

function onNameKeydown(e: KeyboardEvent) {
  if (!showSystemDropdown.value) return
  const totalItems = systemResults.value.length + 1 // +1 for "Add new" item
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % totalItems
    scrollToHighlighted()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = highlightedIndex.value <= 0
      ? totalItems - 1
      : highlightedIndex.value - 1
    scrollToHighlighted()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedIndex.value === 0) {
      selectCustomName()
    } else {
      const result = systemResults.value[highlightedIndex.value - 1]
      if (result) selectSystemMedicine(result)
    }
  } else if (e.key === 'Escape') {
    showSystemDropdown.value = false
  }
}

function onNameBlur() {
  setTimeout(() => { showSystemDropdown.value = false }, 200)
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.medicine) {
      form.value = {
        generic_name: props.medicine.generic_name ?? '',
        brand_name: props.medicine.brand_name ?? '',
        dosage_strength: props.medicine.dosage_strength ?? '',
        dosage_form: props.medicine.dosage_form ?? '',
        classification: props.medicine.classification ?? '',
        pharmacologic_category: props.medicine.pharmacologic_category ?? '',
        manufacturer: props.medicine.manufacturer ?? '',
        country_of_origin: props.medicine.country_of_origin ?? '',
        registration_number: props.medicine.registration_number ?? '',
        default_frequency: props.medicine.default_frequency ?? '',
        default_route: props.medicine.default_route ?? 'Oral',
        default_instructions: props.medicine.default_instructions ?? '',
        price_per_piece: props.medicine.price_per_piece != null ? String(props.medicine.price_per_piece) : '',
        price_per_pack: props.medicine.price_per_pack != null ? String(props.medicine.price_per_pack) : '',
        quantity_per_pack: props.medicine.quantity_per_pack != null ? String(props.medicine.quantity_per_pack) : '',
        is_multi_dose: props.medicine.is_multi_dose ?? false,
        inventory_enabled: props.medicine.inventory_enabled,
        stock_quantity: String(props.medicine.stock_quantity ?? 0),
      }
    } else {
      form.value = emptyForm()
    }
    systemMedicineId.value = props.medicine?.system_medicine_id ?? null
    systemResults.value = []
    showSystemDropdown.value = false
  },
)

function handleSubmit() {
  if (!form.value.generic_name.trim()) return

  const payload: CreateMedicinePayload | UpdateMedicinePayload = {
    generic_name: form.value.generic_name.trim(),
    system_medicine_id: systemMedicineId.value,
    brand_name: form.value.brand_name.trim() || null,
    dosage_strength: form.value.dosage_strength.trim() || null,
    dosage_form: form.value.dosage_form.trim() || null,
    classification: form.value.classification || null,
    pharmacologic_category: form.value.pharmacologic_category.trim() || null,
    manufacturer: form.value.manufacturer.trim() || null,
    country_of_origin: form.value.country_of_origin.trim() || null,
    registration_number: form.value.registration_number.trim() || null,
    default_frequency: form.value.default_frequency || null,
    default_route: form.value.default_route || null,
    default_instructions: form.value.default_instructions.trim() || null,
    price_per_piece: form.value.price_per_piece ? parseFloat(form.value.price_per_piece) : null,
    price_per_pack: form.value.price_per_pack ? parseFloat(form.value.price_per_pack) : null,
    quantity_per_pack: form.value.quantity_per_pack ? parseInt(form.value.quantity_per_pack) : null,
    is_multi_dose: form.value.is_multi_dose,
    inventory_enabled: form.value.inventory_enabled,
    stock_quantity: parseInt(form.value.stock_quantity) || 0,
  }

  emit('save', payload)
}

defineExpose({ isSaving })
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ medicine ? 'Edit Medicine' : 'Add Medicine' }}</DialogTitle>
        <DialogDescription>
          {{ medicine ? 'Update medicine details.' : 'Add a new medicine to the clinic catalog.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <!-- Generic Name search — always visible above tabs -->
        <div class="relative flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">Generic Name *</label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <LoaderCircle v-if="isSearching" class="size-3.5 animate-spin text-muted-foreground" />
              <Search v-else class="size-3.5 text-muted-foreground" />
            </div>
            <Input
              :model-value="form.generic_name"
              placeholder="Search FDA or type name..."
              class="pl-9"
              @update:model-value="onGenericNameInput"
              @keydown="onNameKeydown"
              @blur="onNameBlur"
            />
          </div>
          <div
            ref="dropdownRef"
            v-if="showSystemDropdown"
            class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
          >
            <!-- Add new (custom) option -->
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              :class="highlightedIndex === 0 ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
              @mousedown.prevent="selectCustomName"
              @mouseenter="highlightedIndex = 0"
            >
              <Badge variant="outline" class="shrink-0 text-[10px] border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400">
                Add new <CornerDownLeft class="ml-0.5 inline size-2.5" />
              </Badge>
              <span class="truncate font-medium">{{ form.generic_name.trim() }}</span>
            </button>
            <!-- FDA results -->
            <button
              v-for="(sm, idx) in systemResults"
              :key="sm.id"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              :class="idx + 1 === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
              @mousedown.prevent="selectSystemMedicine(sm)"
              @mouseenter="highlightedIndex = idx + 1"
            >
              <Badge variant="outline" class="shrink-0 text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400">FDA</Badge>
              <span class="truncate font-medium">{{ sm.display_name }}</span>
              <span v-if="sm.dosage_strength" class="shrink-0 text-xs text-muted-foreground">{{ sm.dosage_strength }}</span>
            </button>
          </div>
        </div>

        <Tabs default-value="general" class="w-full">
          <TabsList class="w-full">
            <TabsTrigger value="general" class="flex-1">General</TabsTrigger>
            <TabsTrigger value="defaults" class="flex-1">Defaults & Details</TabsTrigger>
          </TabsList>

          <!-- Tab 1: Medicine Info + Pricing & Inventory -->
          <TabsContent value="general" class="flex flex-col gap-4 pt-2">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Brand Name</label>
                <Input v-model="form.brand_name" placeholder="e.g. Biogesic" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Dosage Form</label>
                <Input v-model="form.dosage_form" placeholder="e.g. Tablet" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Dosage Strength</label>
                <Input v-model="form.dosage_strength" placeholder="e.g. 500mg" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Classification</label>
                <Select v-model="form.classification">
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RX">RX - Prescription</SelectItem>
                    <SelectItem value="OTC">OTC - Over-the-Counter</SelectItem>
                    <SelectItem value="HR">HR - Household Remedy</SelectItem>
                    <SelectItem value="Herbal">Herbal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <!-- Pricing & Inventory separator -->
            <div class="border-t pt-3">
              <p class="mb-2 text-xs font-medium text-muted-foreground">Pricing & Inventory</p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Price (per piece)</label>
                  <Input v-model="form.price_per_piece" type="number" step="0.01" min="0" placeholder="0.00" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Price (per pack)</label>
                  <Input v-model="form.price_per_pack" type="number" step="0.01" min="0" placeholder="0.00" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Qty per pack</label>
                  <Input v-model="form.quantity_per_pack" type="number" min="1" placeholder="e.g. 10" />
                </div>
              </div>
              <label class="mt-3 flex cursor-pointer items-center gap-4 rounded-md border bg-muted/20 px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="form.is_multi_dose"
                    class="size-4 rounded border-input"
                    @change="form.is_multi_dose = ($event.target as HTMLInputElement).checked"
                  />
                  <span class="text-sm">Multi-dose unit</span>
                </div>
                <p class="text-xs text-muted-foreground">e.g. syrup bottle, eye drops, inhaler</p>
              </label>
              <div class="mt-2 flex items-center justify-between gap-4 rounded-md border bg-muted/20 px-3 py-2.5">
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="form.inventory_enabled"
                    class="size-4 rounded border-input"
                    @change="form.inventory_enabled = ($event.target as HTMLInputElement).checked"
                  />
                  <span class="text-sm">Enable inventory tracking</span>
                </label>
                <div class="flex items-center gap-2">
                  <label class="text-xs text-muted-foreground">Total Quantity</label>
                  <Input v-model="form.stock_quantity" type="number" min="0" placeholder="0" class="w-24" />
                </div>
              </div>
            </div>
          </TabsContent>

          <!-- Tab 2: Prescription Defaults + Details -->
          <TabsContent value="defaults" class="flex flex-col gap-4 pt-2">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Default Frequency</label>
                <Select v-model="form.default_frequency">
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="f in FREQUENCIES" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Default Route</label>
                <Select v-model="form.default_route">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="r in ROUTES" :key="r" :value="r">{{ r }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1 sm:col-span-3">
                <label class="text-xs text-muted-foreground">Default Instructions</label>
                <Input v-model="form.default_instructions" placeholder="e.g. After meals" />
              </div>
            </div>

            <!-- Details separator -->
            <div class="border-t pt-3">
              <p class="mb-2 text-xs font-medium text-muted-foreground">Details</p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Pharmacologic Category</label>
                  <Input v-model="form.pharmacologic_category" placeholder="e.g. Analgesic" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Manufacturer</label>
                  <Input v-model="form.manufacturer" placeholder="e.g. Unilab" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Country of Origin</label>
                  <Input v-model="form.country_of_origin" placeholder="e.g. Philippines" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-muted-foreground">Registration No.</label>
                  <Input v-model="form.registration_number" placeholder="e.g. DR-XY12345" />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button :disabled="isSaving || !form.generic_name.trim()">
            <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ medicine ? 'Save Changes' : 'Add Medicine' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
