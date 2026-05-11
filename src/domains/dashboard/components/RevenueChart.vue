<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { VisXYContainer, VisLine, VisArea } from '@unovis/vue'
import { CurveType } from '@unovis/ts'
import { Banknote } from 'lucide-vue-next'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { dashboardApi } from '@/domains/dashboard/api/dashboardApi'
import type { RevenueChartPoint } from '@/domains/dashboard/api/dashboardApi'

const data = ref<RevenueChartPoint[]>([])
const loading = ref(true)

const totalCollected = computed(() =>
  data.value.reduce((sum, d) => sum + d.revenue, 0),
)

const totalInvoiced = computed(() =>
  data.value.reduce((sum, d) => sum + d.invoiced, 0),
)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const x = (_: RevenueChartPoint, i: number) => i
const yRevenue = (d: RevenueChartPoint) => d.revenue
const yInvoiced = (d: RevenueChartPoint) => d.invoiced

onMounted(async () => {
  try {
    const res = await dashboardApi.doctorRevenueChart()
    data.value = res.data
  } catch {
    // silent
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="surface-card relative overflow-hidden rounded-xl border p-6 text-card-foreground">
    <!-- Sparkline behind content -->
    <div
      v-if="!loading && data.length"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-40"
    >
      <div class="h-full w-full" data-slot="chart">
        <VisXYContainer :data="data" :padding="{ top: 8 }" :height="64">
          <VisArea :x="x" :y="yInvoiced" color="var(--color-stat-blue)" :opacity="0.15" :curve-type="CurveType.MonotoneX" />
          <VisArea :x="x" :y="yRevenue" color="var(--color-stat-green)" :opacity="0.25" :curve-type="CurveType.MonotoneX" />
          <VisLine :x="x" :y="yRevenue" color="var(--color-stat-green)" :line-width="1.5" :curve-type="CurveType.MonotoneX" />
        </VisXYContainer>
      </div>
    </div>

    <!-- Content (same layout as StatCard) -->
    <div class="relative flex items-start justify-between">
      <div class="flex flex-col gap-3">
        <span class="text-sm font-medium text-muted-foreground">Revenue (30d)</span>
        <Skeleton v-if="loading" class="h-9 w-20" />
        <div v-else class="flex items-baseline gap-1.5">
          <span class="text-3xl font-bold tabular-nums">{{ formatCurrency(totalCollected) }}</span>
          <span class="text-xs text-muted-foreground">/ {{ formatCurrency(totalInvoiced) }}</span>
        </div>
      </div>
      <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-green/10">
        <Banknote class="size-5 text-stat-green" />
      </div>
    </div>
  </div>
</template>
