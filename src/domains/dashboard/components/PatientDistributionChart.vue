<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { dashboardApi } from '@/domains/dashboard/api/dashboardApi'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { MapPin } from 'lucide-vue-next'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

interface BarangayData {
  name: string
  value: number
}

const data = ref<BarangayData[]>([])
const city = ref<string | null>(null)
const total = ref(0)
const other = ref(0)
const loading = ref(true)
const empty = ref(false)

onMounted(async () => {
  try {
    const res = await dashboardApi.patientDistribution()
    data.value = res.data.data as BarangayData[]
    city.value = res.data.city
    total.value = res.data.total
    other.value = res.data.other
    empty.value = !res.data.city || (res.data.data as BarangayData[]).length === 0
  } catch {
    empty.value = true
  } finally {
    loading.value = false
  }
})

const colors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#22c55e',
  '#a855f7', '#facc15', '#fb923c', '#4ade80', '#38bdf8',
]

const chartData = computed(() => {
  const items = [...data.value]
  if (other.value > 0) {
    items.push({ name: 'Other areas', value: other.value })
  }
  return items
})

const option = computed(() => ({
  color: colors,
  tooltip: {
    trigger: 'item',
    formatter: (params: { name: string; value: number; percent: number }) => {
      return `<b>${params.name}</b><br/>${params.value} patient${params.value > 1 ? 's' : ''} (${params.percent}%)`
    },
  },
  series: [
    {
      type: 'pie',
      radius: ['35%', '75%'],
      center: ['50%', '50%'],
      data: chartData.value,
      label: {
        show: true,
        fontSize: 11,
        color: '#475569',
        formatter: (params: { name: string; percent: number }) => {
          return params.percent >= 3 ? `${params.name}` : ''
        },
      },
      labelLine: {
        show: true,
        length: 10,
        length2: 15,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.15)',
        },
      },
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2,
      },
    },
  ],
}))

const localCount = computed(() => total.value - other.value)
</script>

<template>
  <div class="surface-card rounded-xl border p-6 text-card-foreground">
    <div class="mb-4">
      <h2 class="text-sm font-semibold">Patient Distribution</h2>
      <p v-if="city && !loading" class="text-xs text-muted-foreground">
        {{ city }} · {{ localCount }} patients
      </p>
    </div>

    <div v-if="loading" class="flex items-center justify-center" style="height: 400px;">
      <Skeleton class="size-48 rounded-full" />
    </div>

    <div v-else-if="empty" class="flex items-center justify-center text-sm text-muted-foreground" style="height: 300px;">
      No patient address data available
    </div>

    <template v-else>
      <VChart
        :option="option"
        autoresize
        style="height: 400px; width: 100%;"
      />
      <p v-if="other > 0" class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin class="size-3" />
        {{ other }} patient{{ other > 1 ? 's' : '' }} from other cities/municipalities
      </p>
    </template>
  </div>
</template>
