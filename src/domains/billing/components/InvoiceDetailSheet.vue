<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { toast } from 'vue-sonner'
import {
  User,
  CalendarDays,
  FileText,
  CreditCard,
  Ban,
  Banknote,
  Pencil,
  LoaderCircle,
  Check,
  X,
  FileCheck,
  Clock,
  Download,
  Printer,
  FileDown,
  RefreshCw,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Separator from '@/components/ui/separator/Separator.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useBillingStore } from '../stores/billingStore'
import { documentApi, type GeneratedDocumentResponse } from '@/domains/consultation/api/documentApi'
import { billingApi } from '../api/billingApi'
import { openNewTab, printPdf } from '@/lib/utils'
import InvoiceStatusBadge from './InvoiceStatusBadge.vue'
import type { InvoiceResponse } from '../types/billing.types'

const props = defineProps<{
  open: boolean
  invoice: InvoiceResponse | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'record-payment': []
  'void-invoice': []
  'request-medcert': []
  'updated': []
}>()

const authStore = useAuthStore()
const billingStore = useBillingStore()

const isEditing = ref(false)
const editedQuantities = ref<Record<string, number>>({})

const canManageBilling = computed(() => authStore.hasPermission('billing.manage'))

const canRecordPayment = computed(() =>
  canManageBilling.value
  && props.invoice?.status !== 'paid'
  && props.invoice?.status !== 'void',
)

const canVoid = computed(() =>
  canManageBilling.value
  && props.invoice?.status !== 'void',
)

const canEdit = computed(() =>
  props.invoice
  && props.invoice.status !== 'void'
  && props.invoice.amount_paid === 0
  && authStore.hasPermission('billing.manage'),
)

watch(() => props.open, (open) => {
  if (!open) {
    isEditing.value = false
    editedQuantities.value = {}
  }
})

function startEditing() {
  if (!props.invoice) return
  editedQuantities.value = {}
  for (const item of props.invoice.line_items) {
    editedQuantities.value[item.id] = item.quantity
  }
  isEditing.value = true
}

function cancelEditing() {
  if (!props.invoice) return
  // Reset to original quantities
  for (const item of props.invoice.line_items) {
    editedQuantities.value[item.id] = item.quantity
  }
  isEditing.value = false
}

async function saveItemQty(itemId: string) {
  if (!props.invoice) return
  const original = props.invoice.line_items.find((i) => i.id === itemId)
  if (!original || editedQuantities.value[itemId] === original.quantity) return

  const isMedicine = original.type === 'medicine'

  try {
    await billingStore.updateInvoice(props.invoice.id, [
      { id: itemId, quantity: editedQuantities.value[itemId] },
    ])
    emit('updated')

    if (isMedicine && props.invoice.consultation_id) {
      const settings = authStore.currentClinic?.settings
      const isAdjustedMode = settings?.prescription_quantity_mode === 'adjusted'
      const autoRegen = isAdjustedMode && settings?.auto_regenerate_pdf_on_qty_change !== false

      if (autoRegen) {
        silentRegenerate(props.invoice.consultation_id)
      } else if (isAdjustedMode) {
        promptRegenerate(props.invoice.consultation_id)
      }
    }
  } catch (err: unknown) {
    // Revert on failure
    editedQuantities.value[itemId] = original.quantity
    const msg = err instanceof Error ? err.message : 'Failed to update invoice.'
    toast.error(msg)
  }
}

async function silentRegenerate(consultationId: string) {
  try {
    await documentApi.generate(consultationId, 'prescription')
    toast.success('Prescription PDF regenerated')
  } catch {
    toast.error('Failed to regenerate prescription PDF')
  }
}

function promptRegenerate(consultationId: string) {
  toast('Prescription quantities changed', {
    description: 'Would you like to regenerate the prescription PDF?',
    action: {
      label: 'Regenerate',
      onClick: async () => {
        try {
          await documentApi.generate(consultationId, 'prescription')
          toast.success('Prescription PDF is being regenerated')
        } catch {
          toast.error('Failed to regenerate prescription PDF')
        }
      },
    },
    duration: 8000,
  })
}

function formatCurrency(amount: number): string {
  return '\u20B1' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function methodLabel(method: string): string {
  if (method === 'gcash') return 'GCash'
  return 'Cash'
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

function editedSubtotal(item: typeof props.invoice extends null ? never : NonNullable<typeof props.invoice>['line_items'][number]): number {
  const qty = editedQuantities.value[item.id] ?? 0
  if (item.type === 'medicine' && (item.price_per_pack || item.price_per_piece)) {
    return calcMedicinePricing(qty, item)
  }
  return qty * item.unit_price
}

async function downloadMedCert(documentId: string) {
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(documentId)
    tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get download link')
  }
}

const lineItemTypeLabel: Record<string, string> = {
  consultation_fee: 'Consultation',
  medicine: 'Medicine',
  consumable: 'Consumable',
  lab_service: 'Lab Service',
  custom: 'Custom',
}

// --- Invoice PDF generation ---
const invoiceDoc = ref<GeneratedDocumentResponse | null>(null)
const isGeneratingInvoicePdf = ref(false)
const invoicePollTimer = ref<ReturnType<typeof setInterval> | null>(null)

const invoicePdfReady = computed(() => invoiceDoc.value?.status === 'completed')

function stopInvoicePolling() {
  if (invoicePollTimer.value) {
    clearInterval(invoicePollTimer.value)
    invoicePollTimer.value = null
  }
}

async function loadInvoiceDoc() {
  if (!props.invoice) return
  try {
    const res = await billingApi.getPdf(props.invoice.id)
    invoiceDoc.value = res.data
  } catch {
    // ignore
  }
}

function startInvoicePolling() {
  stopInvoicePolling()
  invoicePollTimer.value = setInterval(async () => {
    await loadInvoiceDoc()
    if (invoiceDoc.value?.status === 'completed' || invoiceDoc.value?.status === 'failed') {
      stopInvoicePolling()
      isGeneratingInvoicePdf.value = false
      if (invoiceDoc.value.status === 'failed') {
        toast.error('Invoice PDF generation failed')
      }
    }
  }, 3000)
}

async function generateInvoicePdf() {
  if (!props.invoice) return
  isGeneratingInvoicePdf.value = true
  try {
    const res = await billingApi.generatePdf(props.invoice.id)
    invoiceDoc.value = res.data
    startInvoicePolling()
  } catch {
    isGeneratingInvoicePdf.value = false
    toast.error('Failed to generate invoice PDF')
  }
}

async function downloadInvoicePdf() {
  if (!invoiceDoc.value?.id) return
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(invoiceDoc.value.id)
    tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get download link')
  }
}

async function printInvoicePdf() {
  if (!invoiceDoc.value?.id) return
  try {
    const url = await documentApi.getSignedUrl(invoiceDoc.value.id)
    printPdf(url)
  } catch {
    toast.error('Failed to print invoice')
  }
}

watch(() => [props.open, props.invoice?.id], ([open]) => {
  if (open && props.invoice) {
    loadInvoiceDoc()
  } else if (!open) {
    stopInvoicePolling()
    isGeneratingInvoicePdf.value = false
    invoiceDoc.value = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  stopInvoicePolling()
})
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="flex max-h-[90vh] flex-col sm:max-w-lg">
      <DialogHeader class="shrink-0">
        <DialogTitle class="flex items-center gap-2">
          <span class="truncate">{{ invoice?.invoice_number ?? 'Invoice' }}</span>
          <InvoiceStatusBadge v-if="invoice" :status="invoice.status" />
        </DialogTitle>
      </DialogHeader>

      <div v-if="invoice" class="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
        <!-- Patient & Date info -->
        <div class="flex flex-col gap-3 text-sm">
          <div class="flex items-start gap-2">
            <User class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Patient</p>
              <p class="font-medium">{{ invoice.patient_name ?? '—' }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <FileText class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Created By</p>
              <p class="font-medium">{{ invoice.created_by_name ?? '—' }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <CalendarDays class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Date</p>
              <p class="font-medium">{{ formatDate(invoice.created_at) }}</p>
            </div>
          </div>
        </div>

        <!-- Invoice PDF -->
        <div v-if="invoice.status !== 'void'" class="flex flex-wrap items-center gap-2">
          <template v-if="invoicePdfReady">
            <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" @click="printInvoicePdf">
              <Printer class="size-3" />
              Print
            </Button>
            <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" @click="downloadInvoicePdf">
              <FileDown class="size-3" />
              Download
            </Button>
            <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" @click="generateInvoicePdf" :disabled="isGeneratingInvoicePdf">
              <LoaderCircle v-if="isGeneratingInvoicePdf" class="size-3 animate-spin" />
              <RefreshCw v-else class="size-3" />
              Regenerate
            </Button>
          </template>
          <Button v-else variant="secondary" size="sm" class="h-7 gap-1.5 text-xs" @click="generateInvoicePdf" :disabled="isGeneratingInvoicePdf">
            <LoaderCircle v-if="isGeneratingInvoicePdf" class="size-3 animate-spin" />
            <FileText v-else class="size-3" />
            {{ isGeneratingInvoicePdf ? 'Generating...' : 'Generate Invoice PDF' }}
          </Button>
        </div>

        <Separator />

        <!-- Line items -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium text-muted-foreground">Line Items</p>
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
          <div class="flex flex-col divide-y rounded-md border text-sm">
            <div
              v-for="item in invoice.line_items"
              :key="item.id"
              class="flex items-start justify-between gap-2 px-3 py-2.5"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ item.description }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ lineItemTypeLabel[item.type] ?? item.type }}
                  <span v-if="item.price_breakdown"> &middot; {{ item.price_breakdown }}</span>
                  <span v-else> &middot; {{ item.quantity }} &times; {{ formatCurrency(item.unit_price) }}</span>
                </p>
              </div>
              <!-- Edit mode: quantity input (not for consultation fee) -->
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
              <!-- View mode (or consultation fee in edit mode) -->
              <span v-else class="shrink-0 tabular-nums font-medium">{{ formatCurrency(item.subtotal) }}</span>
            </div>
            <div v-if="invoice.line_items.length === 0" class="px-3 py-4 text-center text-xs text-muted-foreground">
              No line items
            </div>
          </div>
        </div>

        <!-- Totals -->
        <div class="flex flex-col gap-1.5 rounded-md border bg-muted/30 px-4 py-3 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Subtotal</span>
            <span class="tabular-nums">{{ formatCurrency(invoice.subtotal) }}</span>
          </div>
          <div v-if="invoice.discount_amount > 0" class="flex justify-between text-amber-700 dark:text-amber-400">
            <span>
              Discount
              <span v-if="invoice.discount_type === 'percentage'" class="text-xs">
                ({{ invoice.discount_value }}%)
              </span>
            </span>
            <span class="tabular-nums">-{{ formatCurrency(invoice.discount_amount) }}</span>
          </div>
          <Separator class="my-1" />
          <div class="flex justify-between font-semibold">
            <span>Total</span>
            <span class="tabular-nums">{{ formatCurrency(invoice.total) }}</span>
          </div>
          <div class="flex justify-between text-green-700 dark:text-green-400">
            <span>Amount Paid</span>
            <span class="tabular-nums">{{ formatCurrency(invoice.amount_paid) }}</span>
          </div>
          <div class="flex justify-between" :class="invoice.balance > 0 ? 'text-destructive' : 'text-muted-foreground'">
            <span>Balance</span>
            <span class="tabular-nums font-semibold">{{ formatCurrency(invoice.balance) }}</span>
          </div>
        </div>

        <Separator />

        <!-- Payments list -->
        <div v-if="invoice.payments.length > 0" class="flex flex-col gap-2">
          <p class="text-xs font-medium text-muted-foreground">Payments</p>
          <div class="flex flex-col gap-2">
            <div
              v-for="payment in invoice.payments"
              :key="payment.id"
              class="flex flex-col gap-1.5 rounded-md border bg-card px-3 py-2.5 text-sm"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Banknote class="size-3.5 text-muted-foreground" />
                  <span class="font-semibold tabular-nums">{{ formatCurrency(payment.amount) }}</span>
                  <span class="text-xs text-muted-foreground">&middot; {{ methodLabel(payment.method) }}</span>
                </div>
                <span class="text-xs text-muted-foreground">{{ formatDateTime(payment.paid_at) }}</span>
              </div>
              <p v-if="payment.received_by_name" class="text-xs text-muted-foreground">
                Received by: {{ payment.received_by_name }}
              </p>
              <p v-if="payment.reference_number" class="text-xs text-muted-foreground">
                Ref: {{ payment.reference_number }}
              </p>
              <p v-if="payment.notes" class="text-xs text-muted-foreground">
                {{ payment.notes }}
              </p>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="invoice.notes" class="flex flex-col gap-1.5">
          <p class="text-xs font-medium text-muted-foreground">Notes</p>
          <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm">{{ invoice.notes }}</p>
        </div>

        <!-- Void info -->
        <div v-if="invoice.voided_at" class="flex flex-col gap-1.5">
          <p class="text-xs font-medium text-destructive">Void Information</p>
          <div class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <p class="text-muted-foreground text-xs">
              Voided at {{ formatDateTime(invoice.voided_at) }}
              <span v-if="invoice.voided_by_name"> by {{ invoice.voided_by_name }}</span>
            </p>
            <p v-if="invoice.void_reason" class="mt-1">{{ invoice.void_reason }}</p>
          </div>
        </div>
      </div>

      <DialogFooter v-if="invoice" class="shrink-0 flex-row gap-2 border-t pt-4 sm:gap-2">
        <!-- Med cert button -->
        <template v-if="invoice.consultation_id && invoice.status !== 'void'">
          <Button
            v-if="!invoice.medcert_status"
            variant="outline"
            class="flex-1"
            @click="emit('request-medcert')"
          >
            <FileCheck class="size-4" />
            <span class="hidden sm:inline">Request</span> Med Cert
          </Button>
          <Button
            v-else-if="invoice.medcert_status === 'requested'"
            variant="outline"
            class="flex-1"
            disabled
          >
            <Clock class="size-4" />
            Requested
          </Button>
          <Button
            v-else-if="invoice.medcert_status === 'completed' && invoice.medcert_document_id"
            variant="outline"
            class="flex-1"
            @click="downloadMedCert(invoice.medcert_document_id!)"
          >
            <Download class="size-4" />
            Med Cert
          </Button>
        </template>

        <Button
          variant="outline"
          class="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          :disabled="!canVoid"
          @click="emit('void-invoice')"
        >
          <Ban class="size-4" />
          Void
        </Button>
        <Button
          class="flex-1"
          :disabled="!canRecordPayment"
          @click="emit('record-payment')"
        >
          <CreditCard class="size-4" />
          Record Payment
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
