<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { LoaderCircle, Search, Plus, X, FileText, CheckCircle2 } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import Separator from '@/components/ui/separator/Separator.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { http } from '@/lib/http'
import { medicineApi } from '@/domains/medicine/api/medicineApi'
import type { MedicineSearchResult } from '@/domains/medicine/types/medicine.types'
import { useBillingStore } from '../stores/billingStore'
import type { LineItemType, DiscountType } from '../types/billing.types'

interface PatientSearchResult {
  id: string
  full_name: string
  address?: string | null
}

interface LineItemRow {
  type: LineItemType
  description: string
  quantity: string
  unit_price: string
  // Medicine-specific pricing
  reference_id: string | null
  price_per_piece: number | null
  price_per_pack: number | null
  quantity_per_pack: number | null
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: []
}>()

const billingStore = useBillingStore()

// Patient search
const patientQuery = ref('')
const patientResults = ref<PatientSearchResult[]>([])
const isSearchingPatient = ref(false)
const selectedPatient = ref<PatientSearchResult | null>(null)
let patientSearchTimer: ReturnType<typeof setTimeout> | null = null

// Line items
const lineItems = ref<LineItemRow[]>([emptyLineItem()])

// Medicine search per row
const medicineQueries = ref<Record<number, string>>({})
const medicineResults = ref<Record<number, MedicineSearchResult[]>>({})
const medicineSearching = ref<Record<number, boolean>>({})
let medicineTimers: Record<number, ReturnType<typeof setTimeout>> = {}

// Discount
const discountType = ref<DiscountType | ''>('')
const discountValue = ref('')

// Notes
const notes = ref('')

const error = ref<string | null>(null)

const nativeSelectClass = "flex h-9 w-full appearance-none items-center rounded-md border border-input bg-transparent bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-9 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

const lineItemTypeOptions: { value: LineItemType; label: string }[] = [
  { value: 'consultation_fee', label: 'Consultation Fee' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'lab_service', label: 'Lab Service' },
  { value: 'custom', label: 'Custom' },
]

function emptyLineItem(): LineItemRow {
  return {
    type: 'custom',
    description: '',
    quantity: '1',
    unit_price: '0',
    reference_id: null,
    price_per_piece: null,
    price_per_pack: null,
    quantity_per_pack: null,
  }
}

function addLineItem() {
  lineItems.value.push(emptyLineItem())
}

function removeLineItem(index: number) {
  lineItems.value.splice(index, 1)
  delete medicineQueries.value[index]
  delete medicineResults.value[index]
  delete medicineSearching.value[index]
}

function onTypeChange(index: number) {
  const item = lineItems.value[index]
  // Reset medicine fields when switching away from medicine
  if (item.type !== 'medicine') {
    item.reference_id = null
    item.price_per_piece = null
    item.price_per_pack = null
    item.quantity_per_pack = null
    delete medicineQueries.value[index]
    delete medicineResults.value[index]
  } else {
    // Clear description so user searches
    item.description = ''
    item.unit_price = '0'
    medicineQueries.value[index] = ''
  }
}

// Medicine search
function onMedicineInput(index: number, val: string) {
  medicineQueries.value[index] = val
  const item = lineItems.value[index]
  // Clear previous selection
  item.reference_id = null
  item.description = ''
  item.unit_price = '0'
  item.price_per_piece = null
  item.price_per_pack = null
  item.quantity_per_pack = null

  const q = val.trim()
  if (q.length < 2) {
    medicineResults.value[index] = []
    return
  }

  if (medicineTimers[index]) clearTimeout(medicineTimers[index])
  medicineTimers[index] = setTimeout(async () => {
    medicineSearching.value[index] = true
    try {
      const response = await medicineApi.search(q)
      // Only show clinic medicines
      medicineResults.value[index] = response.data.filter((r) => r.source === 'clinic')
    } catch {
      medicineResults.value[index] = []
    } finally {
      medicineSearching.value[index] = false
    }
  }, 300)
}

function selectMedicine(index: number, result: MedicineSearchResult) {
  const item = lineItems.value[index]
  item.description = result.display_name
  item.reference_id = result.id
  item.price_per_piece = result.price_per_piece
  item.price_per_pack = result.price_per_pack
  item.quantity_per_pack = result.quantity_per_pack
  item.unit_price = String(result.price_per_piece ?? 0)
  medicineQueries.value[index] = result.display_name
  medicineResults.value[index] = []
}

// Pack pricing computation
function calcLineItemSubtotal(item: LineItemRow): number {
  const qty = parseFloat(item.quantity) || 0
  if (item.type === 'medicine' && item.reference_id) {
    return calcMedicinePricing(qty, item)
  }
  return qty * (parseFloat(item.unit_price) || 0)
}

function calcMedicinePricing(quantity: number, item: LineItemRow): number {
  const ppp = item.price_per_piece ?? (parseFloat(item.unit_price) || 0)
  const ppk = item.price_per_pack ?? 0
  const qpk = item.quantity_per_pack ?? 0

  if (ppk > 0 && qpk > 0 && quantity >= qpk) {
    const packs = Math.floor(quantity / qpk)
    const remaining = quantity % qpk
    return packs * ppk + remaining * ppp
  }
  return quantity * ppp
}

function lineItemBreakdown(item: LineItemRow): string | null {
  const qty = parseFloat(item.quantity) || 0
  if (item.type !== 'medicine' || !item.reference_id) return null
  const ppk = item.price_per_pack ?? 0
  const qpk = item.quantity_per_pack ?? 0
  const ppp = item.price_per_piece ?? 0

  if (ppk > 0 && qpk > 0 && qty >= qpk) {
    const packs = Math.floor(qty / qpk)
    const remaining = qty % qpk
    const parts = [`${packs} ${packs === 1 ? 'pack' : 'packs'} × ₱${ppk.toFixed(2)}`]
    if (remaining > 0) {
      parts.push(`${remaining} ${remaining === 1 ? 'pc' : 'pcs'} × ₱${ppp.toFixed(2)}`)
    }
    return parts.join(' + ')
  }
  return null
}

// Patient search
async function handlePatientInput() {
  selectedPatient.value = null
  const q = patientQuery.value.trim()
  if (q.length < 2) {
    patientResults.value = []
    return
  }
  if (patientSearchTimer) clearTimeout(patientSearchTimer)
  patientSearchTimer = setTimeout(async () => {
    isSearchingPatient.value = true
    try {
      const response = await http.get<{ data: PatientSearchResult[] }>(`/patients/search?q=${encodeURIComponent(q)}`)
      patientResults.value = response.data
    } catch {
      patientResults.value = []
    } finally {
      isSearchingPatient.value = false
    }
  }, 300)
}

function selectPatient(patient: PatientSearchResult) {
  selectedPatient.value = patient
  patientQuery.value = patient.full_name
  patientResults.value = []
}

const subtotal = computed(() => {
  return lineItems.value.reduce((sum, item) => sum + calcLineItemSubtotal(item), 0)
})

const discountAmount = computed(() => {
  if (!discountType.value || !discountValue.value) return 0
  const val = parseFloat(discountValue.value) || 0
  if (discountType.value === 'percentage') {
    return subtotal.value * (val / 100)
  }
  return Math.min(val, subtotal.value)
})

const total = computed(() => Math.max(0, subtotal.value - discountAmount.value))

function formatCurrency(amount: number): string {
  return '\u20B1' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function reset() {
  patientQuery.value = ''
  patientResults.value = []
  selectedPatient.value = null
  lineItems.value = [emptyLineItem()]
  medicineQueries.value = {}
  medicineResults.value = {}
  medicineSearching.value = {}
  medicineTimers = {}
  discountType.value = ''
  discountValue.value = ''
  notes.value = ''
  error.value = null
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

async function handleSubmit() {
  if (!selectedPatient.value) {
    error.value = 'Please select a patient.'
    return
  }
  const validItems = lineItems.value.filter(
    (item) => item.description.trim(),
  )
  if (validItems.length === 0) {
    error.value = 'Please add at least one line item.'
    return
  }

  error.value = null

  try {
    await billingStore.createInvoice({
      patient_id: selectedPatient.value.id,
      line_items: validItems.map((item) => {
        const qty = parseFloat(item.quantity) || 1
        const itemSubtotal = calcLineItemSubtotal(item)
        // Use blended unit_price for medicine with pack pricing
        const unitPrice = item.type === 'medicine' && item.reference_id && qty > 0
          ? itemSubtotal / qty
          : parseFloat(item.unit_price) || 0

        return {
          type: item.type,
          description: item.description.trim(),
          reference_id: item.reference_id,
          quantity: qty,
          unit_price: Math.round(unitPrice * 10000) / 10000,
        }
      }),
      discount_type: discountType.value || null,
      discount_value: discountValue.value ? parseFloat(discountValue.value) : null,
      notes: notes.value.trim() || null,
    })
    emit('created')
    emit('update:open', false)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create invoice.'
    error.value = msg
    toast.error(msg)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="flex max-h-[90vh] flex-col sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <FileText class="size-5 text-primary" />
          Create Invoice
        </DialogTitle>
        <DialogDescription>
          Add line items, apply discounts, and generate an invoice for a patient.
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="error"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ error }}
      </div>

      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="handleSubmit">
        <div class="flex-1 overflow-y-auto px-0.5 pb-2">
        <div class="flex flex-col gap-4">
        <!-- Patient search — always visible above tabs -->
        <div class="relative flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">Patient *</label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <LoaderCircle v-if="isSearchingPatient" class="size-3.5 animate-spin text-muted-foreground" />
              <Search v-else class="size-3.5 text-muted-foreground" />
            </div>
            <Input
              v-model="patientQuery"
              class="pl-9"
              placeholder="Search by patient name..."
              autocomplete="off"
              :disabled="billingStore.isSaving"
              @input="handlePatientInput"
            />
          </div>
          <!-- Results dropdown -->
          <div
            v-if="patientResults.length > 0"
            class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
          >
            <button
              v-for="patient in patientResults"
              :key="patient.id"
              type="button"
              class="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
              @click="selectPatient(patient)"
            >
              <span class="font-medium">{{ patient.full_name }}</span>
              <span v-if="patient.address" class="text-xs text-muted-foreground">{{ patient.address }}</span>
            </button>
          </div>
          <p v-if="selectedPatient" class="text-xs text-muted-foreground">
            Selected: <span class="font-medium text-foreground">{{ selectedPatient.full_name }}</span>
          </p>
        </div>

        <Tabs default-value="items" class="w-full">
          <TabsList class="w-full">
            <TabsTrigger value="items" class="flex-1">Line Items</TabsTrigger>
            <TabsTrigger value="discount" class="flex-1">Discount & Notes</TabsTrigger>
          </TabsList>

          <!-- Tab 1: Line Items -->
          <TabsContent value="items" class="flex flex-col gap-4 pt-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted-foreground">Add billable items to this invoice</p>
              <Button type="button" variant="outline" size="sm" @click="addLineItem">
                <Plus class="size-3.5" />
                Add Item
              </Button>
            </div>

            <div class="flex flex-col gap-3">
              <div
                v-for="(item, index) in lineItems"
                :key="index"
                class="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-3"
              >
                <div class="flex flex-col gap-2">
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <!-- Type -->
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-muted-foreground">Type</label>
                      <select
                        v-model="item.type"
                        :class="nativeSelectClass"
                        :disabled="billingStore.isSaving"
                        @change="onTypeChange(index)"
                      >
                        <option
                          v-for="opt in lineItemTypeOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>

                    <!-- Medicine search (when type is medicine) -->
                    <div v-if="item.type === 'medicine'" class="relative flex flex-col gap-1">
                      <label class="text-xs text-muted-foreground">Medicine *</label>
                      <div class="relative">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <LoaderCircle v-if="medicineSearching[index]" class="size-3.5 animate-spin text-muted-foreground" />
                          <Search v-else class="size-3.5 text-muted-foreground" />
                        </div>
                        <Input
                          :model-value="medicineQueries[index] ?? ''"
                          class="pl-9"
                          placeholder="Search clinic medicines..."
                          autocomplete="off"
                          :disabled="billingStore.isSaving"
                          @update:model-value="onMedicineInput(index, String($event))"
                        />
                      </div>
                      <!-- Medicine results dropdown -->
                      <div
                        v-if="medicineResults[index]?.length"
                        class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
                      >
                        <button
                          v-for="result in medicineResults[index]"
                          :key="result.id"
                          type="button"
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                          @click="selectMedicine(index, result)"
                        >
                          <span class="truncate font-medium">{{ result.display_name }}</span>
                          <span v-if="result.dosage_strength" class="shrink-0 text-xs text-muted-foreground">{{ result.dosage_strength }}</span>
                          <span v-if="result.price_per_piece" class="ml-auto shrink-0 text-xs text-muted-foreground">₱{{ result.price_per_piece.toFixed(2) }}/pc</span>
                        </button>
                        <div v-if="medicineResults[index]?.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
                          No clinic medicines found
                        </div>
                      </div>
                      <p v-if="item.reference_id" class="text-xs text-muted-foreground">
                        {{ item.description }}
                        <span v-if="item.price_per_pack && item.quantity_per_pack">
                          &middot; ₱{{ item.price_per_pack.toFixed(2) }}/pack ({{ item.quantity_per_pack }}pcs)
                        </span>
                        <span v-if="item.price_per_piece"> &middot; ₱{{ item.price_per_piece.toFixed(2) }}/pc</span>
                      </p>
                    </div>

                    <!-- Description (non-medicine types) -->
                    <div v-else class="flex flex-col gap-1">
                      <label class="text-xs text-muted-foreground">Description</label>
                      <Input
                        v-model="item.description"
                        placeholder="Item description"
                        :disabled="billingStore.isSaving"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <!-- Quantity -->
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-muted-foreground">Quantity</label>
                      <Input
                        v-model="item.quantity"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="1"
                        :disabled="billingStore.isSaving"
                      />
                    </div>

                    <!-- Unit price (hidden for medicine with reference, shown otherwise) -->
                    <div v-if="item.type !== 'medicine' || !item.reference_id" class="flex flex-col gap-1">
                      <label class="text-xs text-muted-foreground">Unit Price (₱)</label>
                      <Input
                        v-model="item.unit_price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        :disabled="billingStore.isSaving"
                      />
                    </div>

                    <!-- Subtotal for medicine with pricing -->
                    <div v-else class="flex flex-col gap-1">
                      <label class="text-xs text-muted-foreground">Subtotal</label>
                      <div class="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium tabular-nums">
                        {{ formatCurrency(calcLineItemSubtotal(item)) }}
                      </div>
                    </div>
                  </div>

                  <!-- Pack pricing breakdown -->
                  <div
                    v-if="lineItemBreakdown(item)"
                    class="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {{ lineItemBreakdown(item) }} = {{ formatCurrency(calcLineItemSubtotal(item)) }}
                  </div>
                </div>

                <!-- Remove button -->
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="self-start text-muted-foreground hover:text-destructive"
                  :disabled="lineItems.length === 1"
                  @click="removeLineItem(index)"
                >
                  <X class="size-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <!-- Tab 2: Discount & Notes -->
          <TabsContent value="discount" class="flex flex-col gap-4 pt-2">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Discount Type</label>
                <select
                  v-model="discountType"
                  :class="nativeSelectClass"
                  :disabled="billingStore.isSaving"
                >
                  <option value="">None</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₱)</option>
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">Discount Value</label>
                <Input
                  v-model="discountValue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  :disabled="!discountType || billingStore.isSaving"
                />
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-2">
              <Label for="inv_notes">Notes <span class="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="inv_notes"
                v-model="notes"
                placeholder="Any additional notes..."
                rows="3"
                :disabled="billingStore.isSaving"
              />
            </div>
          </TabsContent>
        </Tabs>
        </div>
        </div>

        <!-- Fixed footer: totals + actions -->
        <div class="shrink-0 border-t pt-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-0.5 text-sm">
              <div v-if="discountAmount > 0" class="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Subtotal: {{ formatCurrency(subtotal) }}</span>
                <span class="text-amber-600">-{{ formatCurrency(discountAmount) }}</span>
              </div>
              <div class="flex items-center gap-1.5 font-semibold">
                <span>Total:</span>
                <span class="tabular-nums">{{ formatCurrency(total) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Button type="button" variant="outline" :disabled="billingStore.isSaving" @click="emit('update:open', false)">
                Cancel
              </Button>
              <Button type="submit" :disabled="billingStore.isSaving || !selectedPatient">
                <LoaderCircle v-if="billingStore.isSaving" class="size-3.5 animate-spin" />
                <CheckCircle2 v-else class="size-3.5" />
                {{ billingStore.isSaving ? 'Creating...' : 'Create Invoice' }}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
