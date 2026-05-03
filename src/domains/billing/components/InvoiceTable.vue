<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Download, FileText, LoaderCircle } from 'lucide-vue-next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import Button from '@/components/ui/button/Button.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import InvoiceStatusBadge from './InvoiceStatusBadge.vue'
import { openNewTab } from '@/lib/utils'
import { documentApi } from '@/domains/consultation/api/documentApi'
import { billingApi } from '../api/billingApi'
import type { GeneratedDocumentResponse } from '@/domains/consultation/api/documentApi'
import type { InvoiceResponse } from '../types/billing.types'

const props = defineProps<{
  invoices: InvoiceResponse[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [invoice: InvoiceResponse]
}>()

// Track invoice PDF state per invoice: doc data + generating flag
const invoiceDocs = ref<Record<string, GeneratedDocumentResponse | null>>({})
const generatingIds = ref<Set<string>>(new Set())

watch(
  () => props.invoices,
  (invoices) => {
    for (const invoice of invoices) {
      if (invoice.status === 'void') continue
      if (!Object.prototype.hasOwnProperty.call(invoiceDocs.value, invoice.id)) {
        invoiceDocs.value[invoice.id] = invoice.invoice_pdf_document
      }
      if (getDoc(invoice)?.status === 'pending' && !generatingIds.value.has(invoice.id)) {
        generatingIds.value.add(invoice.id)
        pollForCompletion(invoice)
      }
    }
  },
  { immediate: true },
)

function getDoc(invoice: InvoiceResponse): GeneratedDocumentResponse | null | undefined {
  return Object.prototype.hasOwnProperty.call(invoiceDocs.value, invoice.id)
    ? invoiceDocs.value[invoice.id]
    : invoice.invoice_pdf_document
}

async function handlePdfClick(e: Event, invoice: InvoiceResponse) {
  e.stopPropagation()

  const doc = getDoc(invoice)

  // If ready, download
  if (doc?.status === 'completed' && doc.id) {
    const tab = openNewTab()
    try {
      const url = await documentApi.getSignedUrl(doc.id)
      tab.navigate(url)
    } catch {
      tab.close()
      toast.error('Failed to download invoice PDF')
    }
    return
  }

  if (doc?.status === 'pending') {
    generatingIds.value.add(invoice.id)
    pollForCompletion(invoice)
    return
  }

  // Generate
  generatingIds.value.add(invoice.id)
  try {
    const res = await billingApi.generatePdf(invoice.id)
    invoiceDocs.value[invoice.id] = res.data
    pollForCompletion(invoice)
  } catch {
    generatingIds.value.delete(invoice.id)
    toast.error('Failed to generate invoice PDF')
  }
}

function pollForCompletion(invoice: InvoiceResponse) {
  const interval = setInterval(async () => {
    try {
      const res = await billingApi.getPdf(invoice.id)
      invoiceDocs.value[invoice.id] = res.data
      if (res.data?.status === 'completed' || res.data?.status === 'failed') {
        clearInterval(interval)
        generatingIds.value.delete(invoice.id)
        if (res.data.status === 'failed') {
          toast.error('Invoice PDF generation failed')
        }
      }
    } catch {
      clearInterval(interval)
      generatingIds.value.delete(invoice.id)
    }
  }, 3000)
}

function formatCurrency(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="billing-table-card surface-card overflow-hidden rounded-2xl">
    <Table class="min-w-[46rem] border-collapse">
      <TableHeader>
        <TableRow class="billing-table-header hover:bg-transparent">
          <TableHead class="px-4 py-3.5 text-muted-foreground">Invoice #</TableHead>
          <TableHead class="px-4 py-3.5 text-muted-foreground">Patient</TableHead>
          <TableHead class="hidden px-4 py-3.5 text-muted-foreground md:table-cell">Date</TableHead>
          <TableHead class="px-4 py-3.5 text-right text-muted-foreground">Total</TableHead>
          <TableHead class="hidden px-4 py-3.5 text-right text-muted-foreground md:table-cell">Paid</TableHead>
          <TableHead class="hidden px-4 py-3.5 text-right text-muted-foreground md:table-cell">Balance</TableHead>
          <TableHead class="px-4 py-3.5 text-muted-foreground">Status</TableHead>
          <TableHead class="w-10 px-4 py-3.5" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Loading skeleton -->
        <template v-if="loading">
          <TableRow v-for="i in 5" :key="i" class="billing-table-row">
            <TableCell class="px-4 py-4"><Skeleton class="h-4 w-24" /></TableCell>
            <TableCell class="px-4 py-4"><Skeleton class="h-4 w-32" /></TableCell>
            <TableCell class="hidden px-4 py-4 md:table-cell"><Skeleton class="h-4 w-24" /></TableCell>
            <TableCell class="px-4 py-4"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
            <TableCell class="hidden px-4 py-4 md:table-cell"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
            <TableCell class="hidden px-4 py-4 md:table-cell"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
            <TableCell class="px-4 py-4"><Skeleton class="h-5 w-16 rounded-full" /></TableCell>
            <TableCell class="px-4 py-4"><Skeleton class="size-4" /></TableCell>
          </TableRow>
        </template>

        <!-- Empty state -->
        <template v-else-if="invoices.length === 0">
          <TableRow>
            <TableCell colspan="8" class="px-4 py-14 text-center text-sm text-muted-foreground">
              No invoices found. New invoices will show here once billing starts moving.
            </TableCell>
          </TableRow>
        </template>

        <!-- Data rows -->
        <template v-else>
          <TableRow
            v-for="invoice in invoices"
            :key="invoice.id"
            class="billing-table-row cursor-pointer transition-colors"
            @click="emit('select', invoice)"
          >
            <TableCell class="px-4 py-4 font-medium">{{ invoice.invoice_number }}</TableCell>
            <TableCell class="px-4 py-4">{{ invoice.patient_name ?? '—' }}</TableCell>
            <TableCell class="hidden px-4 py-4 text-sm text-muted-foreground md:table-cell">
              {{ formatDate(invoice.created_at) }}
            </TableCell>
            <TableCell class="px-4 py-4 text-right font-medium tabular-nums">{{ formatCurrency(invoice.total) }}</TableCell>
            <TableCell class="hidden px-4 py-4 text-right tabular-nums text-muted-foreground md:table-cell">{{ formatCurrency(invoice.amount_paid) }}</TableCell>
            <TableCell class="hidden px-4 py-4 text-right tabular-nums md:table-cell">{{ formatCurrency(invoice.balance) }}</TableCell>
            <TableCell class="px-4 py-4">
              <InvoiceStatusBadge :status="invoice.status" />
            </TableCell>
            <TableCell class="px-4 py-4">
              <Tooltip v-if="invoice.status !== 'void'">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8 rounded-full"
                    :disabled="generatingIds.has(invoice.id)"
                    @click="handlePdfClick($event, invoice)"
                  >
                    <LoaderCircle v-if="generatingIds.has(invoice.id)" class="size-3.5 animate-spin text-muted-foreground" />
                    <Download v-else-if="getDoc(invoice)?.status === 'completed'" class="size-3.5" />
                    <FileText v-else class="size-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span v-if="generatingIds.has(invoice.id)">Generating...</span>
                  <span v-else-if="getDoc(invoice)?.status === 'completed'">Download Invoice PDF</span>
                  <span v-else>Generate Invoice PDF</span>
                </TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>

<style scoped>
.billing-table-card {
  position: relative;
  background:
    radial-gradient(circle at 18% 0%, rgb(59 130 246 / 0.08), transparent 32%),
    radial-gradient(circle at 82% 18%, rgb(20 184 166 / 0.08), transparent 30%),
    var(--surface-panel-strong);
}

.billing-table-header {
  border-color: transparent;
  background: rgb(255 255 255 / 0.34);
}

.billing-table-row {
  border-color: rgb(255 255 255 / 0.32);
}

.billing-table-row:hover {
  background:
    linear-gradient(90deg, rgb(59 130 246 / 0.1), rgb(20 184 166 / 0.07)),
    rgb(255 255 255 / 0.2);
}

:global(.dark .billing-table-card) {
  background:
    radial-gradient(circle at 86% 88%, rgb(20 184 166 / 0.12), transparent 34%),
    radial-gradient(circle at 18% 10%, rgb(59 130 246 / 0.12), transparent 30%),
    linear-gradient(135deg, rgb(15 23 42 / 0.58), rgb(15 23 42 / 0.28) 54%, rgb(15 23 42 / 0.42)),
    rgb(15 23 42 / 0.12);
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 1px 0 0 rgb(255 255 255 / 0.035),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .billing-table-header) {
  border-color: transparent;
  background: transparent !important;
  box-shadow:
    inset 0 -1px 0 rgb(148 163 184 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.03);
}

:global(.dark .billing-table-header:hover) {
  background: transparent !important;
}

:global(.dark .billing-table-header th) {
  color: rgb(203 213 225 / 0.74);
}

:global(.dark .billing-table-row) {
  border-color: rgb(148 163 184 / 0.1);
}

:global(.dark .billing-table-row:hover) {
  background:
    linear-gradient(90deg, rgb(59 130 246 / 0.12), rgb(20 184 166 / 0.08)),
    rgb(15 23 42 / 0.38);
  box-shadow:
    inset 3px 0 0 rgb(56 189 248 / 0.42),
    inset 0 1px 0 rgb(255 255 255 / 0.04),
    inset 0 -1px 0 rgb(255 255 255 / 0.04);
}
</style>
