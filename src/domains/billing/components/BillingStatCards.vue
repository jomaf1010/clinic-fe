<script setup lang="ts">
import { DollarSign, AlertCircle, FileText, Banknote } from 'lucide-vue-next'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import type { BillingSummary } from '../types/billing.types'

defineProps<{
  summary: BillingSummary | null
  loading: boolean
}>()

function formatCurrency(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- Revenue this month -->
    <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <div class="flex items-start justify-between">
        <div class="flex flex-col gap-3">
          <span class="text-sm font-medium text-muted-foreground">Revenue This Month</span>
          <Skeleton v-if="loading" class="h-9 w-28" />
          <span v-else class="text-3xl font-bold tabular-nums">
            {{ formatCurrency(summary?.total_revenue_this_month ?? 0) }}
          </span>
        </div>
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-blue/10">
          <DollarSign class="size-5 text-stat-blue" />
        </div>
      </div>
    </div>

    <!-- Outstanding balance -->
    <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <div class="flex items-start justify-between">
        <div class="flex flex-col gap-3">
          <span class="text-sm font-medium text-muted-foreground">Outstanding Balance</span>
          <Skeleton v-if="loading" class="h-9 w-28" />
          <span v-else class="text-3xl font-bold tabular-nums">
            {{ formatCurrency(summary?.outstanding_balance ?? 0) }}
          </span>
        </div>
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-orange/10">
          <AlertCircle class="size-5 text-stat-orange" />
        </div>
      </div>
    </div>

    <!-- Invoices today -->
    <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <div class="flex items-start justify-between">
        <div class="flex flex-col gap-3">
          <span class="text-sm font-medium text-muted-foreground">Invoices Today</span>
          <Skeleton v-if="loading" class="h-9 w-20" />
          <span v-else class="text-3xl font-bold tabular-nums">
            {{ summary?.invoices_today ?? 0 }}
          </span>
        </div>
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-green/10">
          <FileText class="size-5 text-stat-green" />
        </div>
      </div>
    </div>

    <!-- Paid today -->
    <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <div class="flex items-start justify-between">
        <div class="flex flex-col gap-3">
          <span class="text-sm font-medium text-muted-foreground">Paid Today</span>
          <Skeleton v-if="loading" class="h-9 w-28" />
          <span v-else class="text-3xl font-bold tabular-nums">
            {{ formatCurrency(summary?.paid_today ?? 0) }}
          </span>
        </div>
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-purple/10">
          <Banknote class="size-5 text-stat-purple" />
        </div>
      </div>
    </div>
  </div>
</template>
