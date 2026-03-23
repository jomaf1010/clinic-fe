<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { HttpError } from '@/lib/http'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  LoaderCircle,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
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
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { useBillingStore } from '../stores/billingStore'
import BillingStatCards from '../components/BillingStatCards.vue'
import InvoiceTable from '../components/InvoiceTable.vue'
import InvoiceDetailSheet from '../components/InvoiceDetailSheet.vue'
import RecordPaymentDialog from '../components/RecordPaymentDialog.vue'
import CreateInvoiceDialog from '../components/CreateInvoiceDialog.vue'
import type { InvoiceResponse } from '../types/billing.types'

const authStore = useAuthStore()
const billingStore = useBillingStore()
const { connect, subscribe, getSubscription } = useCentrifugo()

// UI state
const showCreateDialog = ref(false)
const showDetailSheet = ref(false)
const showPaymentDialog = ref(false)
const showVoidDialog = ref(false)

// Selected invoice
const selectedInvoice = ref<InvoiceResponse | null>(null)

// Filters
const statusFilter = ref('all')
const searchQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

// Void dialog
const voidReason = ref('')
const isVoiding = ref(false)
const voidError = ref<string | null>(null)

const paginationPages = computed(() => {
  const current = billingStore.currentPage
  const last = billingStore.lastPage
  const pages: (number | '...')[] = []

  if (last <= 7) {
    for (let i = 1; i <= last; i++) pages.push(i)
    return pages
  }

  pages.push(1)
  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < last - 2) pages.push('...')
  pages.push(last)

  return pages
})

async function fetchInvoices(page = 1) {
  await billingStore.fetchInvoices({
    page,
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
    search: searchQuery.value.trim() || undefined,
  })
}

function onStatusChange() {
  fetchInvoices(1)
}

function onSearchInput(value: string | number) {
  searchQuery.value = String(value)
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchInvoices(1), 300)
}

function goToPrevPage() {
  if (billingStore.currentPage > 1) {
    fetchInvoices(billingStore.currentPage - 1)
  }
}

function goToNextPage() {
  if (billingStore.currentPage < billingStore.lastPage) {
    fetchInvoices(billingStore.currentPage + 1)
  }
}

function openDetail(invoice: InvoiceResponse) {
  selectedInvoice.value = invoice
  showDetailSheet.value = true
}

function handleRecordPayment() {
  showDetailSheet.value = false
  showPaymentDialog.value = true
}

function handleVoidInvoice() {
  voidReason.value = ''
  voidError.value = null
  showDetailSheet.value = false
  showVoidDialog.value = true
}

async function confirmVoid() {
  if (!selectedInvoice.value || !voidReason.value.trim()) {
    voidError.value = 'Please provide a reason for voiding.'
    return
  }
  voidError.value = null
  isVoiding.value = true
  try {
    await billingStore.voidInvoice(selectedInvoice.value.id, voidReason.value.trim())
    // Update selected invoice from store
    const updated = billingStore.invoices.find((i) => i.id === selectedInvoice.value?.id)
    if (updated) selectedInvoice.value = updated
    showVoidDialog.value = false
    toast.success('Invoice voided')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to void invoice.'
    voidError.value = msg
    toast.error(msg)
  } finally {
    isVoiding.value = false
  }
}

function onInvoiceUpdated() {
  // Refresh the selected invoice from store state
  const updated = billingStore.invoices.find((i) => i.id === selectedInvoice.value?.id)
  if (updated) selectedInvoice.value = updated
  billingStore.fetchSummary()
}

function onPaymentRecorded() {
  // Refresh the selected invoice from store state (store already updated it)
  const updated = billingStore.invoices.find((i) => i.id === selectedInvoice.value?.id)
  if (updated) selectedInvoice.value = updated
  fetchInvoices(billingStore.currentPage)
}

async function handleRequestMedCert() {
  if (!selectedInvoice.value) return
  try {
    await billingStore.requestMedCert(selectedInvoice.value.id)
    const updated = billingStore.invoices.find((i) => i.id === selectedInvoice.value?.id)
    if (updated) selectedInvoice.value = updated
  } catch (err: unknown) {
    const msg = err instanceof HttpError && (err.data as { message?: string })?.message
      ? (err.data as { message: string }).message
      : 'Failed to request medical certificate.'
    toast.error(msg)
  }
}

function onInvoiceCreated() {
  fetchInvoices(1)
  billingStore.fetchSummary()
}

watch(statusFilter, onStatusChange)

function onBillingEvent(ctx: { data?: { type?: string } }) {
  const type = ctx.data?.type
  if (type?.startsWith('invoice.')) {
    fetchInvoices(billingStore.currentPage)
    billingStore.fetchSummary()
  }
}

onMounted(() => {
  billingStore.fetchSummary()
  fetchInvoices(1)

  const clinicId = authStore.currentClinic?.id
  if (clinicId) {
    connect()
    subscribe(`clinic:${clinicId}:dashboard`, onBillingEvent)
  }
})

onUnmounted(() => {
  const clinicId = authStore.currentClinic?.id
  if (clinicId) {
    const sub = getSubscription(`clinic:${clinicId}:dashboard`)
    sub?.removeListener('publication', onBillingEvent)
  }
})
</script>

<template>
  <div class="flex flex-1 flex-col gap-6 pt-4">
    <!-- Stat cards -->
    <BillingStatCards
      :summary="billingStore.summary"
      :loading="billingStore.isLoadingSummary"
    />

    <!-- Filter bar -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div class="relative flex-1 sm:max-w-xs">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          :model-value="searchQuery"
          placeholder="Search invoices..."
          class="pl-8"
          @update:model-value="onSearchInput"
        />
      </div>
      <Select v-model="statusFilter" @update:model-value="onStatusChange">
        <SelectTrigger class="w-full sm:w-[160px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="unpaid">Unpaid</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="void">Void</SelectItem>
        </SelectContent>
      </Select>
      <Button
        v-if="authStore.hasPermission('billing.create')"
        class="w-full sm:ml-auto sm:w-auto"
        @click="showCreateDialog = true"
      >
        <Plus class="size-4" />
        <span class="hidden sm:inline">Create Invoice</span>
        <span class="sm:hidden">New</span>
      </Button>
    </div>

    <!-- Invoice table -->
    <InvoiceTable
      :invoices="billingStore.invoices"
      :loading="billingStore.isLoading"
      @select="openDetail"
    />

    <!-- Pagination -->
    <div
      v-if="billingStore.lastPage > 1"
      class="flex items-center justify-between border-t pt-4"
    >
      <p class="text-sm text-muted-foreground">
        Page {{ billingStore.currentPage }} of {{ billingStore.lastPage }}
      </p>
      <div class="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="billingStore.currentPage <= 1 || billingStore.isLoading"
          @click="goToPrevPage"
        >
          <ChevronLeft class="size-4" />
        </Button>
        <template v-for="page in paginationPages" :key="page">
          <span v-if="page === '...'" class="px-1 text-sm text-muted-foreground">...</span>
          <Button
            v-else
            size="sm"
            class="size-8 p-0"
            :variant="page === billingStore.currentPage ? 'default' : 'outline'"
            :disabled="billingStore.isLoading"
            @click="fetchInvoices(page as number)"
          >
            {{ page }}
          </Button>
        </template>
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="billingStore.currentPage >= billingStore.lastPage || billingStore.isLoading"
          @click="goToNextPage"
        >
          <ChevronRight class="size-4" />
        </Button>
      </div>
    </div>

    <!-- Invoice detail sheet -->
    <InvoiceDetailSheet
      :open="showDetailSheet"
      :invoice="selectedInvoice"
      @update:open="showDetailSheet = $event"
      @record-payment="handleRecordPayment"
      @void-invoice="handleVoidInvoice"
      @request-medcert="handleRequestMedCert"
      @updated="onInvoiceUpdated"
    />

    <!-- Record payment dialog -->
    <RecordPaymentDialog
      :open="showPaymentDialog"
      :invoice="selectedInvoice"
      @update:open="showPaymentDialog = $event"
      @recorded="onPaymentRecorded"
    />

    <!-- Create invoice dialog -->
    <CreateInvoiceDialog
      :open="showCreateDialog"
      @update:open="showCreateDialog = $event"
      @created="onInvoiceCreated"
    />

    <!-- Void confirmation dialog -->
    <Dialog v-model:open="showVoidDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <AlertTriangle class="size-5 text-destructive" />
            Void Invoice
          </DialogTitle>
          <DialogDescription>
            This will permanently void invoice
            <span class="font-medium text-foreground">{{ selectedInvoice?.invoice_number }}</span>.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3">
          <div
            v-if="voidError"
            role="alert"
            class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {{ voidError }}
          </div>

          <div class="flex flex-col gap-2">
            <Label for="void_reason">
              Reason <span class="text-destructive">*</span>
            </Label>
            <Textarea
              id="void_reason"
              v-model="voidReason"
              placeholder="Reason for voiding this invoice..."
              rows="3"
              :disabled="isVoiding"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button
            variant="outline"
            :disabled="isVoiding"
            @click="showVoidDialog = false"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            :disabled="isVoiding || !voidReason.trim()"
            @click="confirmVoid"
          >
            <LoaderCircle v-if="isVoiding" class="size-3.5 animate-spin" />
            {{ isVoiding ? 'Voiding...' : 'Void Invoice' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
