<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import InvoiceStatusBadge from './InvoiceStatusBadge.vue'
import type { InvoiceResponse } from '../types/billing.types'

defineProps<{
  invoices: InvoiceResponse[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [invoice: InvoiceResponse]
}>()

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
          </TableRow>
        </template>

        <!-- Empty state -->
        <template v-else-if="invoices.length === 0">
          <TableRow>
            <TableCell colspan="7" class="py-12 text-center text-sm text-muted-foreground">
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
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>
