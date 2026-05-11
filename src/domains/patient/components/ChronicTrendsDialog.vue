<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TrendingUp, LoaderCircle } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { classificationLabel, classificationColor } from '@/domains/patient/utils/chronicTrendsLabels'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const pdStore = usePatientDetailStore()
const trendsData = computed(() => pdStore.chronicTrends)
const isLoading = computed(() => pdStore.isLoadingFM)

const activeTrendTab = ref<'bp' | 'blood_sugar' | 'weight' | 'bmi'>('bp')

const trendTabs = [
  { key: 'bp' as const, label: 'Blood Pressure' },
  { key: 'blood_sugar' as const, label: 'Blood Sugar' },
  { key: 'weight' as const, label: 'Weight' },
  { key: 'bmi' as const, label: 'BMI' },
]

// Lazy-load trends when dialog first opens (in case caller hasn't loaded FM data)
watch(() => props.open, (isOpen) => {
  if (isOpen && !pdStore.chronicTrends && !pdStore.isLoadingFM) {
    pdStore.loadFM()
  }
})

const trendsChartOption = computed(() => {
  const tab = activeTrendTab.value
  const data = trendsData.value
  if (!data) return {}

  if (tab === 'bp') {
    const points = data.bp ?? []
    return {
      animation: true,
      animationDuration: 300,
      grid: { top: 16, right: 24, bottom: 40, left: 52 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: { dataIndex: number }[]) => {
          const p = params[0]
          if (!p) return ''
          const pt = points[p.dataIndex]
          if (!pt) return ''
          const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          return `<div style="font-size:12px;">
            <b>${date}</b><br/>
            ${pt.systolic}/${pt.diastolic} mmHg
            ${pt.classification ? `<br/><span style="color:${classificationColor(pt.classification)}">${classificationLabel(pt.classification)}</span>` : ''}
          </div>`
        },
      },
      xAxis: {
        type: 'category',
        data: points.map(p => {
          const d = new Date(p.date)
          return `${d.getMonth() + 1}/${d.getDate()}`
        }),
        axisLabel: { fontSize: 11 },
        axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'mmHg',
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: { fontSize: 11 },
        axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
        splitLine: { lineStyle: { color: 'hsl(var(--border))', opacity: 0.15, type: 'dotted' } },
      },
      series: [
        {
          name: 'Systolic',
          type: 'line',
          data: points.map(p => p.systolic),
          lineStyle: { color: '#ef4444', width: 2 },
          itemStyle: { color: '#ef4444' },
          symbolSize: 6,
        },
        {
          name: 'Diastolic',
          type: 'line',
          data: points.map(p => p.diastolic),
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' },
          symbolSize: 6,
        },
      ],
    }
  }

  const points = (tab === 'blood_sugar' ? data.blood_sugar : tab === 'weight' ? data.weight : data.bmi) ?? []
  const unit = tab === 'blood_sugar' ? 'mg/dL' : tab === 'weight' ? 'kg' : ''
  const color = '#00B2B2'

  return {
    animation: true,
    animationDuration: 300,
    grid: { top: 16, right: 24, bottom: 40, left: 52 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number }[]) => {
        const p = params[0]
        if (!p) return ''
        const pt = points[p.dataIndex]
        if (!pt) return ''
        const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return `<div style="font-size:12px;">
          <b>${date}</b><br/>
          ${pt.value} ${unit}
          ${pt.classification ? `<br/><span style="color:${classificationColor(pt.classification)}">${classificationLabel(pt.classification)}</span>` : ''}
        </div>`
      },
    },
    xAxis: {
      type: 'category',
      data: points.map(p => {
        const d = new Date(p.date)
        return `${d.getMonth() + 1}/${d.getDate()}`
      }),
      axisLabel: { fontSize: 11 },
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameLocation: 'middle',
      nameGap: 40,
      axisLabel: { fontSize: 11 },
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      splitLine: { lineStyle: { color: 'hsl(var(--border))', opacity: 0.15, type: 'dotted' } },
    },
    series: [
      {
        name: tab === 'blood_sugar' ? 'Blood Sugar' : tab === 'weight' ? 'Weight' : 'BMI',
        type: 'line',
        data: points.map(p => p.value),
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.08 },
        symbolSize: 6,
      },
    ],
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <TrendingUp class="size-5" />
          Patient Trends
        </DialogTitle>
      </DialogHeader>

      <div class="flex flex-1 flex-col gap-4">
        <div v-if="isLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle class="size-3.5 animate-spin" />
          Loading...
        </div>

        <div v-else-if="!trendsData || (!trendsData.bp?.length && !trendsData.blood_sugar?.length && !trendsData.weight?.length && !trendsData.bmi?.length)" class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
          <TrendingUp class="size-10 text-muted-foreground/30" />
          <p class="text-sm font-medium text-muted-foreground">No trend data available</p>
          <p class="max-w-sm text-xs text-muted-foreground/70">Trends are generated from finalized consultations. BP, blood sugar, weight, and BMI are tracked over time.</p>
        </div>

        <template v-else>
          <div class="flex gap-1 rounded-lg border bg-muted/40 p-1">
            <button
              v-for="tab in trendTabs"
              :key="tab.key"
              type="button"
              class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="activeTrendTab === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              @click="activeTrendTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <VChart
            :option="trendsChartOption"
            autoresize
            style="height: 350px; width: 100%;"
          />

          <div v-if="activeTrendTab === 'bp' && trendsData.bp?.length" class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">Latest:</span>
            <span class="font-semibold">{{ trendsData.bp[trendsData.bp.length - 1]?.systolic }}/{{ trendsData.bp[trendsData.bp.length - 1]?.diastolic }} mmHg</span>
            <span v-if="trendsData.bp[trendsData.bp.length - 1]?.classification" class="text-xs" :style="{ color: classificationColor(trendsData.bp[trendsData.bp.length - 1]!.classification!) }">
              {{ classificationLabel(trendsData.bp[trendsData.bp.length - 1]!.classification!) }}
            </span>
          </div>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
