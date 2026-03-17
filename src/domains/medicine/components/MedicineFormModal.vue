<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoaderCircle, CheckCircle2, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
let searchTimer: ReturnType<typeof setTimeout> | null = null

function emptyForm() {
  return {
    name: '',
    generic_name: '',
    strength: '',
    dosage_form: '',
    default_dose: '',
    default_frequency: '',
    default_route: 'Oral',
    default_instructions: '',
    default_price: '',
    unit: '',
    inventory_enabled: false,
    stock_quantity: '0',
  }
}

function onNameInput(val: string | number) {
  form.value.name = String(val)
  systemMedicineId.value = null

  if (searchTimer) clearTimeout(searchTimer)
  const q = form.value.name.trim()
  if (q.length < 2 || props.medicine) {
    systemResults.value = []
    showSystemDropdown.value = false
    return
  }

  searchTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const res = await medicineApi.searchSystem(q)
      systemResults.value = res.data
      highlightedIndex.value = systemResults.value.length > 0 ? 0 : -1
      showSystemDropdown.value = systemResults.value.length > 0
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectSystemMedicine(sm: SystemMedicine) {
  form.value.name = sm.name
  form.value.generic_name = sm.generic_name ?? ''
  form.value.strength = sm.strength ?? ''
  form.value.dosage_form = sm.dosage_form ?? ''
  systemMedicineId.value = sm.id
  systemResults.value = []
  showSystemDropdown.value = false
}

function onNameKeydown(e: KeyboardEvent) {
  if (!showSystemDropdown.value || systemResults.value.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % systemResults.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = highlightedIndex.value <= 0
      ? systemResults.value.length - 1
      : highlightedIndex.value - 1
  } else if (e.key === 'Enter') {
    const result = systemResults.value[highlightedIndex.value]
    if (result) {
      e.preventDefault()
      selectSystemMedicine(result)
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
        name: props.medicine.name,
        generic_name: props.medicine.generic_name ?? '',
        strength: props.medicine.strength ?? '',
        dosage_form: props.medicine.dosage_form ?? '',
        default_dose: props.medicine.default_dose ?? '',
        default_frequency: props.medicine.default_frequency ?? '',
        default_route: props.medicine.default_route ?? 'Oral',
        default_instructions: props.medicine.default_instructions ?? '',
        default_price: props.medicine.default_price != null ? String(props.medicine.default_price) : '',
        unit: props.medicine.unit ?? '',
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
  if (!form.value.name.trim()) return

  const payload: CreateMedicinePayload | UpdateMedicinePayload = {
    name: form.value.name.trim(),
    system_medicine_id: systemMedicineId.value,
    generic_name: form.value.generic_name.trim() || null,
    strength: form.value.strength.trim() || null,
    dosage_form: form.value.dosage_form.trim() || null,
    default_dose: form.value.default_dose.trim() || null,
    default_frequency: form.value.default_frequency || null,
    default_route: form.value.default_route || null,
    default_instructions: form.value.default_instructions.trim() || null,
    default_price: form.value.default_price ? parseFloat(form.value.default_price) : null,
    unit: form.value.unit.trim() || null,
    inventory_enabled: form.value.inventory_enabled,
    stock_quantity: parseInt(form.value.stock_quantity) || 0,
  }

  emit('save', payload)
}

defineExpose({ isSaving })
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ medicine ? 'Edit Medicine' : 'Add Medicine' }}</DialogTitle>
        <DialogDescription>
          {{ medicine ? 'Update medicine details.' : 'Add a new medicine to the clinic catalog.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="relative flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Name *</label>
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <LoaderCircle v-if="isSearching" class="size-3.5 animate-spin text-muted-foreground" />
                <Search v-else class="size-3.5 text-muted-foreground" />
              </div>
              <Input
                :model-value="form.name"
                placeholder="Search FDA or type name..."
                class="pl-9"
                @update:model-value="onNameInput"
                @keydown="onNameKeydown"
                @blur="onNameBlur"
              />
            </div>
            <div
              v-if="showSystemDropdown"
              class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
            >
              <button
                v-for="(sm, idx) in systemResults"
                :key="sm.id"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                :class="idx === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
                @mousedown.prevent="selectSystemMedicine(sm)"
                @mouseenter="highlightedIndex = idx"
              >
                <Badge variant="outline" class="shrink-0 text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400">FDA</Badge>
                <span class="truncate font-medium">{{ sm.name }}</span>
                <span v-if="sm.strength" class="shrink-0 text-xs text-muted-foreground">{{ sm.strength }}</span>
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Generic Name</label>
            <Input v-model="form.generic_name" placeholder="e.g. Acetaminophen" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Strength</label>
            <Input v-model="form.strength" placeholder="e.g. 500mg" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Dosage Form</label>
            <Input v-model="form.dosage_form" placeholder="e.g. Tablet" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Default Dose</label>
            <Input v-model="form.default_dose" placeholder="e.g. 500mg" />
          </div>
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
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">Default Instructions</label>
          <Input v-model="form.default_instructions" placeholder="e.g. After meals" />
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Price</label>
            <Input v-model="form.default_price" type="number" step="0.01" min="0" placeholder="0.00" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Unit</label>
            <Input v-model="form.unit" placeholder="e.g. tablet, ml" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Initial Stock</label>
            <Input v-model="form.stock_quantity" type="number" min="0" placeholder="0" />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox
            :checked="form.inventory_enabled"
            @update:checked="(val: boolean) => form.inventory_enabled = val"
          />
          <label class="text-sm">Enable inventory tracking</label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button :disabled="isSaving || !form.name.trim()">
            <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ medicine ? 'Save Changes' : 'Add Medicine' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
