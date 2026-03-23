<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { VisXYContainer, VisLine, VisArea, VisAxis, VisCrosshair, VisTooltip } from '@unovis/vue'
import { CurveType } from '@unovis/ts'
import { RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { ChartContainer, ChartTooltipContent, componentToString } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { dashboardApi } from '@/domains/dashboard/api/dashboardApi'
import type { RevenueChartPoint } from '@/domains/dashboard/api/dashboardApi'

const data = ref<RevenueChartPoint[]>([])
const loading = ref(true)
const error = ref(false)

const chartConfig = {
  revenue: { label: 'Collected', color: 'var(--color-stat-green)' },
  invoiced: { label: 'Invoiced', color: 'var(--color-stat-blue)' },
} satisfies ChartConfig

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

function formatDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00'))
}

const x = (_: RevenueChartPoint, i: number) => i
const yRevenue = (d: RevenueChartPoint) => d.revenue
const yInvoiced = (d: RevenueChartPoint) => d.invoiced

const xTicks = computed(() => {
  if (data.value.length <= 7) return data.value.map((_, i) => i)
  const step = Math.ceil(data.value.length / 6)
  return data.value.map((_, i) => i).filter(i => i % step === 0 || i === data.value.length - 1)
})

const xTickFormat = (i: number) => {
  const point = data.value[i]
  return point ? formatDateLabel(point.date) : ''
}

const yTickFormat = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return `${v}`
}

const template = componentToString(chartConfig, ChartTooltipContent, {
  labelFormatter: (value: number | Date) => {
    const point = data.value[value as number]
    return point ? formatDateLabel(point.date) : ''
  },
})

async function fetchData() {
  loading.value = true
  error.value = false
  try {
    const res = await dashboardApi.ownerRevenueChart()
    data.value = res.data
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold">Clinic Revenue</h2>
        <p class="text-xs text-muted-foreground">Last 30 days</p>
      </div>
      <div v-if="!loading && !error" class="flex items-center gap-4 text-right">
        <div>
          <p class="text-xs text-muted-foreground">Collected</p>
          <p class="text-sm font-semibold text-stat-green">{{ formatCurrency(totalCollected) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">Invoiced</p>
          <p class="text-sm font-semibold text-stat-blue">{{ formatCurrency(totalInvoiced) }}</p>
        </div>
      </div>
    </div>

    <div v-if="loading">
      <Skeleton class="h-48 w-full rounded-lg" />
    </div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-12 text-center">
      <p class="text-sm text-muted-foreground">Failed to load chart</p>
      <Button variant="outline" size="sm" @click="fetchData">
        <RefreshCw class="mr-2 size-3.5" />
        Retry
      </Button>
    </div>

    <template v-else>
      <ChartContainer :config="chartConfig" class="h-48">
        <VisXYContainer :data="data" :padding="{ top: 10 }">
          <VisArea :x="x" :y="yInvoiced" color="var(--color-stat-blue)" :opacity="0.08" :curve-type="CurveType.MonotoneX" />
          <VisArea :x="x" :y="yRevenue" color="var(--color-stat-green)" :opacity="0.15" :curve-type="CurveType.MonotoneX" />
          <VisLine :x="x" :y="yInvoiced" color="var(--color-stat-blue)" :line-width="1.5" :curve-type="CurveType.MonotoneX" />
          <VisLine :x="x" :y="yRevenue" color="var(--color-stat-green)" :line-width="2" :curve-type="CurveType.MonotoneX" />
          <VisAxis type="x" :tick-values="xTicks" :tick-format="xTickFormat" :grid-line="false" />
          <VisCrosshair :template="template" />
          <VisTooltip />
        </VisXYContainer>
      </ChartContainer>

    </template>
  </div>
</template>
