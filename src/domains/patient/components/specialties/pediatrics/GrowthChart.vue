<script setup lang="ts">
import { ref, computed } from 'vue'
import { use } from 'echarts/core'
import { LineChart, CustomChart, EffectScatterChart } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { GrowthMeasurement } from '@/domains/patient/api/pediatricsApi'
import {
  percentileCurve,
  type GrowthMetric,
  type PatientSex,
} from '@/domains/patient/lib/whoGrowthStandards'

use([LineChart, CustomChart, EffectScatterChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{
  measurements: GrowthMeasurement[]
  sex: PatientSex
  initialMetric?: 'weight' | 'height' | 'hc'
}>()

// ── Tab state ──────────────────────────────────────────────────────────────────

type MetricTab = 'weight' | 'height' | 'hc'

const activeTab = ref<MetricTab>(props.initialMetric ?? 'weight')

const tabs: { key: MetricTab; label: string }[] = [
  { key: 'weight', label: 'Weight' },
  { key: 'height', label: 'Height' },
  { key: 'hc', label: 'Head Circ.' },
]

// ── Metric mapping ─────────────────────────────────────────────────────────────

function tabToMetric(tab: MetricTab): GrowthMetric {
  if (tab === 'weight') return 'weight'
  if (tab === 'height') return 'height'
  return 'headCircumference'
}

function yAxisLabel(tab: MetricTab): string {
  if (tab === 'weight') return 'kg'
  return 'cm'
}

// ── Patient data series ────────────────────────────────────────────────────────

interface PatientPoint {
  age: number
  value: number
  date: string
  percentile: number | null | undefined
}

const patientSeries = computed((): PatientPoint[] => {
  return props.measurements
    .filter((m) => {
      if (m.age_months == null) return false
      if (activeTab.value === 'weight') return m.weight_kg != null
      if (activeTab.value === 'height') return m.height_cm != null
      return m.head_circumference_cm != null
    })
    .map((m) => {
      let value = 0
      let percentile: number | null | undefined = null
      if (activeTab.value === 'weight') {
        value = m.weight_kg!
        percentile = m.weight_percentile
      } else if (activeTab.value === 'height') {
        value = m.height_cm!
        percentile = m.height_percentile
      } else {
        value = m.head_circumference_cm!
        percentile = m.hc_percentile
      }
      return { age: m.age_months!, value, date: m.date, percentile }
    })
    .sort((a, b) => a.age - b.age)
})

// ── Percentile curves (memoized per sex + metric) ─────────────────────────────

const curveCache = new Map<string, Array<[number, number]>>()

function getCurve(percentile: number, metric: GrowthMetric): Array<[number, number]> {
  const key = `${props.sex}-${metric}-${percentile}`
  if (!curveCache.has(key)) {
    curveCache.set(key, percentileCurve(percentile, props.sex, metric))
  }
  return curveCache.get(key)!
}

// ── Band rendering via custom series ──────────────────────────────────────────
// renderItem is called per data point — we only draw once at dataIndex 0,
// iterating ALL points to build a single polygon.

function makeBandRenderer(fillColor: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (params: any, api: any) => {
    if (params.dataIndex > 0) return { type: 'group', children: [] }

    const upperPts: number[][] = []
    const lowerPts: number[][] = []

    for (let i = 0; i < params.dataInsideLength; i++) {
      const age = api.value(0, i) as number
      const lo = api.value(1, i) as number
      const hi = api.value(2, i) as number
      upperPts.push(api.coord([age, hi]) as number[])
      lowerPts.push(api.coord([age, lo]) as number[])
    }

    lowerPts.reverse()

    return {
      type: 'polygon',
      shape: { points: [...upperPts, ...lowerPts], smooth: 0.2 },
      style: { fill: fillColor, stroke: 'none' },
    }
  }
}

function bandData(
  lower: Array<[number, number]>,
  upper: Array<[number, number]>,
): Array<[number, number, number]> {
  return lower.map(([age, lo], i) => [age, lo, upper[i]?.[1] ?? lo])
}

// ── Y-axis range: tight to data ──────────────────────────────────────────────

function computeYRange(
  p3: Array<[number, number]>,
  p97: Array<[number, number]>,
  patientPts: PatientPoint[],
): { min: number; max: number } {
  let lo = Infinity
  let hi = -Infinity

  for (const [, v] of p3) { if (v < lo) lo = v }
  for (const [, v] of p97) { if (v > hi) hi = v }
  for (const pt of patientPts) {
    if (pt.value < lo) lo = pt.value
    if (pt.value > hi) hi = pt.value
  }

  // Add 5% padding on each side and round to nice numbers
  const padding = (hi - lo) * 0.05
  return {
    min: Math.floor(lo - padding),
    max: Math.ceil(hi + padding),
  }
}

// ── ECharts option ─────────────────────────────────────────────────────────────

const option = computed(() => {
  const metric = tabToMetric(activeTab.value)

  const p3 = getCurve(3, metric)
  const p15 = getCurve(15, metric)
  const p50 = getCurve(50, metric)
  const p85 = getCurve(85, metric)
  const p97 = getCurve(97, metric)

  const outerBand = bandData(p3, p97)
  const innerBand = bandData(p15, p85)

  const patientLineData = patientSeries.value.map((pt) => [pt.age, pt.value])
  const yRange = computeYRange(p3, p97, patientSeries.value)

  return {
    animation: true,
    animationDuration: 300,
    grid: {
      top: 16,
      right: 24,
      bottom: 40,
      left: 52,
      containLabel: false,
    },
    tooltip: {
      trigger: 'item' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        if (params.seriesName !== 'Patient') return ''
        const pt = patientSeries.value[params.dataIndex]
        if (!pt) return ''
        const dateStr = new Date(pt.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
        const unit = yAxisLabel(activeTab.value)
        const pctStr =
          pt.percentile != null
            ? `<br/>${Math.round(pt.percentile)}th percentile`
            : ''
        return `<div style="font-size:12px;">
          <b>${dateStr}</b><br/>
          Age: ${pt.age} mo<br/>
          ${pt.value} ${unit}${pctStr}
        </div>`
      },
    },
    xAxis: {
      type: 'value' as const,
      name: 'Age (months)',
      nameLocation: 'middle' as const,
      nameGap: 28,
      min: 0,
      max: 60,
      interval: 12,
      axisLabel: { fontSize: 11 },
      nameTextStyle: { fontSize: 11, color: 'hsl(var(--muted-foreground))' },
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      splitLine: { lineStyle: { color: 'hsl(var(--border))', opacity: 0.15, type: 'dotted' } },
    },
    yAxis: {
      type: 'value' as const,
      name: yAxisLabel(activeTab.value),
      nameLocation: 'middle' as const,
      nameGap: 40,
      min: yRange.min,
      max: yRange.max,
      axisLabel: { fontSize: 11 },
      nameTextStyle: { fontSize: 11, color: 'hsl(var(--muted-foreground))' },
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      splitLine: { lineStyle: { color: 'hsl(var(--border))', opacity: 0.15, type: 'dotted' } },
    },
    series: [
      // ── Outer band (p3–p97) — single polygon ──────────────────────
      {
        name: '_outer',
        type: 'custom' as const,
        data: outerBand,
        renderItem: makeBandRenderer('rgba(0, 178, 178, 0.08)'),
        encode: { x: 0, y: [1, 2] },
        silent: true,
        tooltip: { show: false },
        z: 1,
      },

      // ── Inner band (p15–p85) — single polygon ─────────────────────
      {
        name: '_inner',
        type: 'custom' as const,
        data: innerBand,
        renderItem: makeBandRenderer('rgba(0, 178, 178, 0.10)'),
        encode: { x: 0, y: [1, 2] },
        silent: true,
        tooltip: { show: false },
        z: 2,
      },

      // ── Percentile lines ───────────────────────────────────────────
      {
        name: 'p3',
        type: 'line' as const,
        data: p3,
        symbol: 'none',
        lineStyle: { color: '#60a5fa', width: 1 },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: 3,
      },
      {
        name: 'p15',
        type: 'line' as const,
        data: p15,
        symbol: 'none',
        lineStyle: { color: '#4ade80', width: 1 },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: 3,
      },
      {
        name: 'p50',
        type: 'line' as const,
        data: p50,
        symbol: 'none',
        lineStyle: { color: '#a3a3a3', width: 1.5, type: 'dashed' },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: 3,
      },
      {
        name: 'p85',
        type: 'line' as const,
        data: p85,
        symbol: 'none',
        lineStyle: { color: '#4ade80', width: 1 },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: 3,
      },
      {
        name: 'p97',
        type: 'line' as const,
        data: p97,
        symbol: 'none',
        lineStyle: { color: '#60a5fa', width: 1 },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: 3,
      },

      // ── Patient data ───────────────────────────────────────────────
      {
        name: 'Patient',
        type: 'line' as const,
        data: patientLineData,
        symbolSize: 8,
        lineStyle: { color: '#00B2B2', width: 2 },
        itemStyle: { color: '#00B2B2' },
        emphasis: {
          itemStyle: { color: '#00B2B2', borderWidth: 2, borderColor: '#fff' },
        },
        z: 10,
      },

      // ── Pulsing dot on latest measurement ─────────────────────────
      ...(patientLineData.length > 0
        ? [
            {
              name: '_pulse',
              type: 'effectScatter' as const,
              data: [patientLineData[patientLineData.length - 1]],
              symbolSize: 12,
              rippleEffect: {
                brushType: 'stroke' as const,
                scale: 3,
                period: 2,
              },
              itemStyle: { color: '#00B2B2' },
              tooltip: { show: false },
              silent: true,
              z: 11,
            },
          ]
        : []),
    ],
  }
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Metric tabs -->
    <div class="flex gap-1 rounded-lg border bg-muted/40 p-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        :class="
          activeTab === tab.key
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Chart -->
    <div class="relative rounded-md">
      <VChart
        :option="option"
        autoresize
        style="height: 350px; width: 100%;"
      />

      <!-- Percentile legend -->
      <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        <span class="flex items-center gap-1">
          <span class="inline-block h-px w-5 bg-[#60a5fa]" />
          p3 / p97
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-px w-5 bg-[#4ade80]" />
          p15 / p85
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-5 border-t border-dashed border-[#a3a3a3]" />
          p50
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block size-2 rounded-full bg-[#00B2B2]" />
          Patient
        </span>
      </div>
    </div>
  </div>
</template>
