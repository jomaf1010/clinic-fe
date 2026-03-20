<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  DollarSign,
  FileText,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Receipt,
  CreditCard,
  Banknote,
  Pencil,
  Check,
  X,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Separator from '@/components/ui/separator/Separator.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useBillingStore } from '@/domains/billing/stores/billingStore'
import InvoiceStatusBadge from '@/domains/billing/components/InvoiceStatusBadge.vue'
import RecordPaymentDialog from '@/domains/billing/components/RecordPaymentDialog.vue'
import type { InvoiceResponse } from '@/domains/billing/types/billing.types'
import { RouteNames } from '@/router/routeNames'

const props = defineProps<{
  disabled: boolean
  consultationId: string
  status: 'draft' | 'finalized'
}>()

const router = useRouter()
const authStore = useAuthStore()
const billingStore = useBillingStore()

const invoice = ref<InvoiceResponse | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const showPaymentDialog = ref(false)

const isDraft = computed(() => props.status === 'draft')
const isFinalized = computed(() => props.status === 'finalized')
const hasInvoice = computed(() => invoice.value !== null)
const canManage = computed(() => authStore.hasPermission('billing.manage'))

// Edit mode
const isEditing = ref(false)
const editedQuantities = ref<Record<string, number>>({})

const canEdit = computed(() =>
  invoice.value
  && invoice.value.status !== 'void'
  && invoice.value.amount_paid === 0
  && canManage.value,
)

function startEditing() {
  if (!invoice.value) return
  editedQuantities.value = {}
  for (const item of invoice.value.line_items) {
    editedQuantities.value[item.id] = item.quantity
  }
  isEditing.value = true
}

function cancelEditing() {
  if (!invoice.value) return
  for (const item of invoice.value.line_items) {
    editedQuantities.value[item.id] = item.quantity
  }
  isEditing.value = false
}

async function saveItemQty(itemId: string) {
  if (!invoice.value) return
  const original = invoice.value.line_items.find((i) => i.id === itemId)
  if (!original || editedQuantities.value[itemId] === original.quantity) return

  try {
    await billingStore.updateInvoice(invoice.value.id, [
      { id: itemId, quantity: editedQuantities.value[itemId] },
    ])
    invoice.value = billingStore.currentInvoice
  } catch {
    // Revert on failure
    editedQuantities.value[itemId] = original.quantity
  }
}

function calcMedicinePricing(quantity: number, item: { price_per_piece?: number | null; price_per_pack?: number | null; quantity_per_pack?: number | null; unit_price: number }): number {
  const ppp = item.price_per_piece ?? item.unit_price
  const ppk = item.price_per_pack ?? 0
  const qpk = item.quantity_per_pack ?? 0

  if (ppk > 0 && qpk > 0 && quantity >= qpk) {
    const packs = Math.floor(quantity / qpk)
    const remaining = quantity % qpk
    return packs * ppk + remaining * ppp
  }
  return quantity * ppp
}

function editedSubtotal(item: NonNullable<typeof invoice.value>['line_items'][number]): number {
  const qty = editedQuantities.value[item.id] ?? 0
  if (item.type === 'medicine' && (item.price_per_pack || item.price_per_piece)) {
    return calcMedicinePricing(qty, item)
  }
  return qty * item.unit_price
}

function formatCurrency(amount: number): string {
  return '\u20B1' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function lineItemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    consultation_fee: 'Consultation Fee',
    medicine: 'Medicine',
    consumable: 'Consumable',
    lab_service: 'Lab Service',
    custom: 'Custom',
  }
  return labels[type] ?? type
}

async function fetchInvoice() {
  isLoading.value = true
  loadError.value = null
  try {
    const result = await billingStore.fetchForConsultation(props.consultationId)
    invoice.value = result
  } catch {
    loadError.value = 'Failed to load invoice.'
  } finally {
    isLoading.value = false
  }
}

function onPaymentRecorded() {
  // Refresh invoice data after payment
  fetchInvoice()
}

function goToBilling() {
  router.push({ name: RouteNames.BILLING })
}

onMounted(() => {
  if (isFinalized.value) {
    fetchInvoice()
  }
})
</script>

<template>
  <!-- Draft state -->
  <div v-if="isDraft" class="flex flex-col items-center justify-center gap-4 py-16 text-center">
    <div class="flex size-12 items-center justify-center rounded-full bg-muted">
      <Receipt class="size-6 text-muted-foreground" />
    </div>
    <div>
      <p class="font-medium text-muted-foreground">Invoice will be generated when consultation is finalized</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Billable items (consultation fee, medicines, consumables, lab services) will be automatically added.
      </p>
    </div>
  </div>

  <!-- Loading -->
  <div v-else-if="isLoading" class="flex flex-col gap-4 py-4">
    <Skeleton class="h-6 w-48" />
    <Skeleton class="h-32 w-full" />
    <Skeleton class="h-20 w-full" />
  </div>

  <!-- Error -->
  <div
    v-else-if="loadError"
    class="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
  >
    <p class="text-sm text-destructive">{{ loadError }}</p>
    <Button variant="outline" size="sm" @click="fetchInvoice">
      <RefreshCw class="mr-2 size-3.5" />
      Retry
    </Button>
  </div>

  <!-- Finalized, no invoice -->
  <div
    v-else-if="isFinalized && !hasInvoice"
    class="flex flex-col items-center justify-center gap-4 py-16 text-center"
  >
    <div class="flex size-12 items-center justify-center rounded-full bg-muted">
      <FileText class="size-6 text-muted-foreground" />
    </div>
    <div>
      <p class="font-medium text-muted-foreground">No invoice for this consultation</p>
      <p class="mt-1 text-sm text-muted-foreground">
        This consultation was finalized before billing was enabled, or had no billable items.
      </p>
    </div>
  </div>

  <!-- Finalized with invoice -->
  <div v-else-if="invoice" class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h3 class="text-base font-semibold">{{ invoice.invoice_number }}</h3>
        <InvoiceStatusBadge :status="invoice.status" />
      </div>
      <Button variant="outline" size="sm" @click="goToBilling">
        <ExternalLink class="size-3.5" />
        View Full Invoice
      </Button>
    </div>

    <Separator />

    <!-- Line items -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-muted-foreground">Line Items</h4>
        <template v-if="canEdit">
          <Button v-if="isEditing" variant="ghost" size="sm" class="h-6 gap-1 px-2 text-xs" @click="cancelEditing">
            Done
          </Button>
          <Button v-else variant="ghost" size="sm" class="h-6 gap-1 px-2 text-xs" @click="startEditing">
            <Pencil class="size-3" />
            Edit Qty
          </Button>
        </template>
      </div>
      <div class="rounded-lg border">
        <div
          v-for="item in invoice.line_items"
          :key="item.id"
          class="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
        >
          <div class="flex-1">
            <p class="text-sm font-medium">{{ item.description }}</p>
            <p class="text-xs text-muted-foreground">
              {{ lineItemTypeLabel(item.type) }}
              <span v-if="item.price_breakdown"> &middot; {{ item.price_breakdown }}</span>
              <span v-else-if="item.quantity > 1"> &middot; {{ item.quantity }} &times; {{ formatCurrency(item.unit_price) }}</span>
            </p>
          </div>
          <!-- Edit mode (not for consultation fee) -->
          <div v-if="isEditing && item.type !== 'consultation_fee'" class="flex items-center gap-2">
            <Input
              :model-value="editedQuantities[item.id]"
              type="number"
              min="1"
              class="h-7 w-16 text-center text-xs"
              @update:model-value="editedQuantities[item.id] = Number($event) || 1"
              @blur="saveItemQty(item.id)"
            />
            <span class="w-16 shrink-0 text-right text-xs tabular-nums font-medium">
              {{ formatCurrency(editedSubtotal(item)) }}
            </span>
          </div>
          <!-- View mode -->
          <span v-else class="text-sm font-medium tabular-nums">{{ formatCurrency(item.subtotal) }}</span>
        </div>
      </div>
    </div>

    <!-- Totals -->
    <div class="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-4">
      <div class="flex justify-between text-sm">
        <span class="text-muted-foreground">Subtotal</span>
        <span class="tabular-nums">{{ formatCurrency(invoice.subtotal) }}</span>
      </div>
      <div v-if="invoice.discount_amount > 0" class="flex justify-between text-sm">
        <span class="text-muted-foreground">
          Discount
          <span v-if="invoice.discount_type === 'percentage'">({{ invoice.discount_value }}%)</span>
        </span>
        <span class="tabular-nums text-green-600">-{{ formatCurrency(invoice.discount_amount) }}</span>
      </div>
      <Separator />
      <div class="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span class="tabular-nums">{{ formatCurrency(invoice.total) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-muted-foreground">Amount Paid</span>
        <span class="tabular-nums">{{ formatCurrency(invoice.amount_paid) }}</span>
      </div>
      <div class="flex justify-between text-sm font-semibold">
        <span>Balance</span>
        <span class="tabular-nums" :class="invoice.balance > 0 ? 'text-destructive' : 'text-green-600'">
          {{ formatCurrency(invoice.balance) }}
        </span>
      </div>
    </div>

    <!-- Payments -->
    <div v-if="invoice.payments.length > 0" class="flex flex-col gap-2">
      <h4 class="text-sm font-medium text-muted-foreground">Payments</h4>
      <div class="flex flex-col gap-2">
        <div
          v-for="payment in invoice.payments"
          :key="payment.id"
          class="flex items-start gap-3 rounded-lg border p-3"
        >
          <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Banknote v-if="payment.method === 'cash'" class="size-4 text-muted-foreground" />
            <CreditCard v-else class="size-4 text-muted-foreground" />
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ formatCurrency(payment.amount) }}</span>
              <span class="text-xs text-muted-foreground capitalize">{{ payment.method }}</span>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ formatDate(payment.paid_at) }}
              <span v-if="payment.received_by_name"> &middot; {{ payment.received_by_name }}</span>
            </p>
            <p v-if="payment.reference_number" class="text-xs text-muted-foreground">
              Ref: {{ payment.reference_number }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Record payment button -->
    <Button
      v-if="canManage && invoice.status !== 'paid' && invoice.status !== 'void'"
      class="w-full sm:w-auto"
      @click="showPaymentDialog = true"
    >
      <DollarSign class="size-4" />
      Record Payment
    </Button>

    <!-- Payment dialog -->
    <RecordPaymentDialog
      :open="showPaymentDialog"
      :invoice="invoice"
      @update:open="showPaymentDialog = $event"
      @recorded="onPaymentRecorded"
    />
  </div>
</template>
