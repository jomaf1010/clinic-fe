<script setup lang="ts">
import { ref } from 'vue'
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

defineProps<{
  invoices: InvoiceResponse[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [invoice: InvoiceResponse]
}>()

// Track invoice PDF state per invoice: doc data + generating flag
const invoiceDocs = ref<Record<string, GeneratedDocumentResponse | null>>({})
const generatingIds = ref<Set<string>>(new Set())

async function loadInvoiceDoc(invoice: InvoiceResponse) {
  if (invoice.status === 'void' || invoiceDocs.value[invoice.id] !== undefined) return
  try {
    const res = await billingApi.getPdf(invoice.id)
    invoiceDocs.value[invoice.id] = res.data
  } catch {
    // ignore
  }
}

function getDoc(invoiceId: string): GeneratedDocumentResponse | null | undefined {
  return invoiceDocs.value[invoiceId]
}

async function handlePdfClick(e: Event, invoice: InvoiceResponse) {
  e.stopPropagation()

  const doc = getDoc(invoice.id)

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
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice #</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead class="hidden md:table-cell">Date</TableHead>
          <TableHead class="text-right">Total</TableHead>
          <TableHead class="hidden text-right md:table-cell">Paid</TableHead>
          <TableHead class="hidden text-right md:table-cell">Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead class="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <!-- Loading skeleton -->
        <template v-if="loading">
          <TableRow v-for="i in 5" :key="i">
            <TableCell><Skeleton class="h-4 w-24" /></TableCell>
            <TableCell><Skeleton class="h-4 w-32" /></TableCell>
            <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-24" /></TableCell>
            <TableCell><Skeleton class="ml-auto h-4 w-20" /></TableCell>
            <TableCell class="hidden md:table-cell"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
            <TableCell class="hidden md:table-cell"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
            <TableCell><Skeleton class="h-5 w-16 rounded-full" /></TableCell>
            <TableCell><Skeleton class="size-4" /></TableCell>
          </TableRow>
        </template>

        <!-- Empty state -->
        <template v-else-if="invoices.length === 0">
          <TableRow>
            <TableCell colspan="8" class="py-12 text-center text-sm text-muted-foreground">
              No invoices found
            </TableCell>
          </TableRow>
        </template>

        <!-- Data rows -->
        <template v-else>
          <TableRow
            v-for="invoice in invoices"
            :key="invoice.id"
            class="cursor-pointer hover:bg-muted/50"
            @click="emit('select', invoice)"
            @vue:mounted="loadInvoiceDoc(invoice)"
          >
            <TableCell class="font-medium">{{ invoice.invoice_number }}</TableCell>
            <TableCell>{{ invoice.patient_name ?? '—' }}</TableCell>
            <TableCell class="hidden text-sm text-muted-foreground md:table-cell">
              {{ formatDate(invoice.created_at) }}
            </TableCell>
            <TableCell class="text-right tabular-nums">{{ formatCurrency(invoice.total) }}</TableCell>
            <TableCell class="hidden text-right tabular-nums md:table-cell">{{ formatCurrency(invoice.amount_paid) }}</TableCell>
            <TableCell class="hidden text-right tabular-nums md:table-cell">{{ formatCurrency(invoice.balance) }}</TableCell>
            <TableCell>
              <InvoiceStatusBadge :status="invoice.status" />
            </TableCell>
            <TableCell>
              <Tooltip v-if="invoice.status !== 'void'">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7"
                    :disabled="generatingIds.has(invoice.id)"
                    @click="handlePdfClick($event, invoice)"
                  >
                    <LoaderCircle v-if="generatingIds.has(invoice.id)" class="size-3.5 animate-spin text-muted-foreground" />
                    <Download v-else-if="getDoc(invoice.id)?.status === 'completed'" class="size-3.5" />
                    <FileText v-else class="size-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span v-if="generatingIds.has(invoice.id)">Generating...</span>
                  <span v-else-if="getDoc(invoice.id)?.status === 'completed'">Download Invoice PDF</span>
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
