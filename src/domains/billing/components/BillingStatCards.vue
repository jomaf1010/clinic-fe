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
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <!-- Revenue this month -->
    <div class="billing-stat-card surface-card rounded-2xl p-4">
      <div class="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3">
        <span class="billing-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_16px_32px_rgba(37,99,235,0.24)]">
          <DollarSign class="size-5" />
        </span>
        <div class="min-w-0">
          <span class="text-sm font-medium text-muted-foreground">Revenue This Month</span>
          <Skeleton v-if="loading" class="mt-2 h-8 w-28" />
          <p v-else class="truncate text-2xl font-semibold leading-tight tabular-nums">
            {{ formatCurrency(summary?.total_revenue_this_month ?? 0) }}
          </p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">Collected this month</p>
    </div>

    <!-- Outstanding balance -->
    <div class="billing-stat-card surface-card rounded-2xl p-4">
      <div class="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3">
        <span class="billing-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_16px_32px_rgba(245,158,11,0.24)]">
          <AlertCircle class="size-5" />
        </span>
        <div class="min-w-0">
          <span class="text-sm font-medium text-muted-foreground">Outstanding Balance</span>
          <Skeleton v-if="loading" class="mt-2 h-8 w-28" />
          <p v-else class="truncate text-2xl font-semibold leading-tight tabular-nums">
            {{ formatCurrency(summary?.outstanding_balance ?? 0) }}
          </p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">Still to collect</p>
    </div>

    <!-- Invoices today -->
    <div class="billing-stat-card surface-card rounded-2xl p-4">
      <div class="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3">
        <span class="billing-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_32px_rgba(16,185,129,0.24)]">
          <FileText class="size-5" />
        </span>
        <div>
          <span class="text-sm font-medium text-muted-foreground">Invoices Today</span>
          <Skeleton v-if="loading" class="mt-2 h-8 w-20" />
          <p v-else class="text-2xl font-semibold leading-tight tabular-nums">
            {{ summary?.invoices_today ?? 0 }}
          </p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">Created today</p>
    </div>

    <!-- Paid today -->
    <div class="billing-stat-card surface-card rounded-2xl p-4">
      <div class="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3">
        <span class="billing-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-[0_16px_32px_rgba(139,92,246,0.24)]">
          <Banknote class="size-5" />
        </span>
        <div class="min-w-0">
          <span class="text-sm font-medium text-muted-foreground">Paid Today</span>
          <Skeleton v-if="loading" class="mt-2 h-8 w-28" />
          <p v-else class="truncate text-2xl font-semibold leading-tight tabular-nums">
            {{ formatCurrency(summary?.paid_today ?? 0) }}
          </p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">Payments posted</p>
    </div>
  </div>
</template>

<style scoped>
.billing-stat-card {
  position: relative;
  border: 0;
  background:
    radial-gradient(circle at 18% 0%, rgb(59 130 246 / 0.08), transparent 32%),
    radial-gradient(circle at 82% 18%, rgb(20 184 166 / 0.08), transparent 30%),
    var(--surface-panel-strong);
}

.billing-stat-icon {
  transform: translateZ(0);
}

:global(.dark .billing-stat-card) {
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
</style>
