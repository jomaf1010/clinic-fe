<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PregnancyDashboard } from '../types/obgyn.types'

use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer])

const props = withDefaults(defineProps<{
  dashboardData: PregnancyDashboard
  showFetalCharts?: boolean
}>(), {
  showFetalCharts: true,
})

function shortDate(d: string): string {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function gaLabel(weeks: number | null | undefined, date: string): string {
  return weeks != null ? `${weeks}w` : shortDate(date)
}

const baseGrid = { top: 8, right: 8, bottom: 28, left: 40 }

const baseAxisLabel = { fontSize: 10 }
const baseXAxisLabel = { fontSize: 9 }
const baseAxisLine = { lineStyle: { color: 'hsl(var(--border))' } }
const baseSplitLine = { lineStyle: { color: 'hsl(var(--border))', opacity: 0.15, type: 'dotted' as const } }

// ── Blood Pressure Chart ────────────────────────────────────────────────────
const bpOption = computed(() => {
  const pts = props.dashboardData.bp_trend
  if (pts.length === 0) return {}

  return {
    animation: true,
    animationDuration: 300,
    grid: baseGrid,
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number; seriesName: string; value: number }[]) => {
        if (!params[0]) return ''
        const pt = pts[params[0].dataIndex]
        if (!pt) return ''
        const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const ga = pt.gestational_age_weeks !== null ? ` · ${pt.gestational_age_weeks}w` : ''
        return `<div style="font-size:12px"><b>${date}${ga}</b><br/>Systolic: <b>${pt.systolic}</b> mmHg<br/>Diastolic: <b>${pt.diastolic}</b> mmHg</div>`
      },
    },
    legend: { data: ['Systolic', 'Diastolic'], bottom: 0, itemHeight: 8, textStyle: { fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: pts.map((p) => gaLabel(p.gestational_age_weeks, p.date)),
      axisLabel: baseXAxisLabel,
      axisLine: baseAxisLine,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'mmHg',
      nameLocation: 'middle' as const,
      nameGap: 40,
      axisLabel: baseAxisLabel,
      axisLine: baseAxisLine,
      splitLine: baseSplitLine,
      min: 50,
    },
    series: [
      {
        name: 'Systolic',
        type: 'line',
        data: pts.map((p) => p.systolic),
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        symbolSize: 5,
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: 140, name: '140' }],
          lineStyle: { color: '#ef4444', type: 'dashed', width: 1, opacity: 0.6 },
          label: { formatter: '140', fontSize: 10, color: '#ef4444' },
        },
      },
      {
        name: 'Diastolic',
        type: 'line',
        data: pts.map((p) => p.diastolic),
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
        symbolSize: 5,
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ yAxis: 90, name: '90' }],
          lineStyle: { color: '#3b82f6', type: 'dashed', width: 1, opacity: 0.6 },
          label: { formatter: '90', fontSize: 10, color: '#3b82f6' },
        },
      },
    ],
  }
})

// ── Weight Gain Chart ───────────────────────────────────────────────────────
const weightOption = computed(() => {
  const pts = props.dashboardData.weight_trend
  const rec = props.dashboardData.pregnancy.recommended_weight_gain
  if (pts.length === 0) return {}

  // Build recommended band as area series aligned to the same x categories
  const minBandData = pts.map((p) => {
    const ga = p.gestational_age_weeks ?? 0
    return rec ? parseFloat(((rec.min / 40) * ga).toFixed(1)) : null
  })
  const maxBandData = pts.map((p) => {
    const ga = p.gestational_age_weeks ?? 0
    return rec ? parseFloat(((rec.max / 40) * ga).toFixed(1)) : null
  })

  return {
    animation: true,
    animationDuration: 300,
    grid: baseGrid,
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number; seriesName: string; value: number | null }[]) => {
        if (!params[0]) return ''
        const pt = pts[params[0].dataIndex]
        if (!pt) return ''
        const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const ga = pt.gestational_age_weeks !== null ? ` · ${pt.gestational_age_weeks}w` : ''
        const status = pt.status ? ` (${pt.status})` : ''
        return `<div style="font-size:12px"><b>${date}${ga}</b><br/>Gain: <b>+${pt.cumulative_gain.toFixed(1)} kg</b>${status}</div>`
      },
    },
    legend: {
      data: rec ? ['Actual Gain', 'Min Recommended', 'Max Recommended'] : ['Actual Gain'],
      bottom: 0,
      itemHeight: 8,
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: pts.map((p) => gaLabel(p.gestational_age_weeks, p.date)),
      axisLabel: baseXAxisLabel,
      axisLine: baseAxisLine,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'kg',
      nameLocation: 'middle' as const,
      nameGap: 36,
      axisLabel: baseAxisLabel,
      axisLine: baseAxisLine,
      splitLine: baseSplitLine,
      min: 0,
      max: rec ? Math.ceil(rec.max * 1.2) : undefined,
    },
    series: [
      ...(rec
        ? [
            {
              name: 'Max Recommended',
              type: 'line',
              data: maxBandData,
              lineStyle: { color: '#22c55e', width: 1, type: 'dashed' as const, opacity: 0.7 },
              itemStyle: { color: '#22c55e' },
              symbol: 'none',
              areaStyle: { color: '#22c55e', opacity: 0.08 },
              stack: undefined,
            },
            {
              name: 'Min Recommended',
              type: 'line',
              data: minBandData,
              lineStyle: { color: '#22c55e', width: 1, type: 'dashed' as const, opacity: 0.7 },
              itemStyle: { color: '#22c55e' },
              symbol: 'none',
            },
          ]
        : []),
      {
        name: 'Actual Gain',
        type: 'line',
        data: pts.map((p) => p.cumulative_gain),
        lineStyle: { color: '#8b5cf6', width: 2 },
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const pt = pts[params.dataIndex]
            if (!pt || !rec) return '#8b5cf6'
            const ga = pt.gestational_age_weeks ?? 0
            const minExp = (rec.min / 40) * ga
            const maxExp = (rec.max / 40) * ga
            if (pt.cumulative_gain < minExp || pt.cumulative_gain > maxExp) return '#ef4444'
            return '#8b5cf6'
          },
        },
        symbolSize: 5,
      },
    ],
  }
})

// ── Fundal Height Chart ─────────────────────────────────────────────────────
const fundalOption = computed(() => {
  const pts = props.dashboardData.fundal_height_trend
  if (pts.length === 0) return {}

  return {
    animation: true,
    animationDuration: 300,
    grid: baseGrid,
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number; seriesName: string; value: number | null }[]) => {
        if (!params[0]) return ''
        const pt = pts[params[0].dataIndex]
        if (!pt) return ''
        const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const ga = pt.gestational_age_weeks !== null ? ` · ${pt.gestational_age_weeks}w` : ''
        const exp = pt.expected !== null ? ` · Expected: ${pt.expected} cm` : ''
        return `<div style="font-size:12px"><b>${date}${ga}</b><br/>Fundal Height: <b>${pt.fundal_height} cm</b>${exp}</div>`
      },
    },
    legend: { data: ['Fundal Height', 'Expected (GA)', '+3cm band', '-3cm band'], bottom: 0, itemHeight: 8, textStyle: { fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: pts.map((p) => gaLabel(p.gestational_age_weeks, p.date)),
      axisLabel: baseXAxisLabel,
      axisLine: baseAxisLine,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'cm',
      nameLocation: 'middle' as const,
      nameGap: 36,
      axisLabel: baseAxisLabel,
      axisLine: baseAxisLine,
      splitLine: baseSplitLine,
      min: (value: { min: number }) => Math.max(0, Math.floor(value.min) - 4),
    },
    series: [
      {
        name: '+3cm band',
        type: 'line',
        data: pts.map((p) => (p.expected !== null ? p.expected + 3 : null)),
        lineStyle: { color: '#22c55e', width: 1, type: 'dashed' as const, opacity: 0.5 },
        itemStyle: { color: '#22c55e' },
        symbol: 'none',
        areaStyle: { color: '#22c55e', opacity: 0.07 },
      },
      {
        name: '-3cm band',
        type: 'line',
        data: pts.map((p) => (p.expected !== null ? p.expected - 3 : null)),
        lineStyle: { color: '#22c55e', width: 1, type: 'dashed' as const, opacity: 0.5 },
        itemStyle: { color: '#22c55e' },
        symbol: 'none',
      },
      {
        name: 'Expected (GA)',
        type: 'line',
        data: pts.map((p) => p.expected),
        lineStyle: { color: '#94a3b8', width: 1.5, type: 'dotted' as const },
        itemStyle: { color: '#94a3b8' },
        symbol: 'none',
      },
      {
        name: 'Fundal Height',
        type: 'line',
        data: pts.map((p) => p.fundal_height),
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const pt = pts[params.dataIndex]
            if (!pt || pt.expected === null) return '#f59e0b'
            if (Math.abs(pt.fundal_height - pt.expected) > 3) return '#ef4444'
            return '#f59e0b'
          },
        },
        symbolSize: 5,
      },
    ],
  }
})

// ── FHR Chart ───────────────────────────────────────────────────────────────
const fhrOption = computed(() => {
  const pts = props.dashboardData.fhr_trend
  if (pts.length === 0) return {}

  return {
    animation: true,
    animationDuration: 300,
    grid: baseGrid,
    tooltip: {
      trigger: 'axis',
      formatter: (params: { dataIndex: number; seriesName: string; value: number | null }[]) => {
        if (!params[0]) return ''
        const pt = pts[params[0].dataIndex]
        if (!pt) return ''
        const date = new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const ga = pt.gestational_age_weeks !== null ? ` · ${pt.gestational_age_weeks}w` : ''
        const flag = pt.fetal_heart_rate < 110 || pt.fetal_heart_rate > 160 ? ' ⚠' : ''
        return `<div style="font-size:12px"><b>${date}${ga}</b><br/>FHR: <b>${pt.fetal_heart_rate} bpm${flag}</b></div>`
      },
    },
    legend: { data: ['FHR', 'Normal 110-160'], bottom: 0, itemHeight: 8, textStyle: { fontSize: 11 }, selected: { 'Normal lower': false } },
    xAxis: {
      type: 'category',
      data: pts.map((p) => gaLabel(p.gestational_age_weeks, p.date)),
      axisLabel: baseXAxisLabel,
      axisLine: baseAxisLine,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'bpm',
      nameLocation: 'middle' as const,
      nameGap: 36,
      axisLabel: baseAxisLabel,
      axisLine: baseAxisLine,
      splitLine: baseSplitLine,
      min: 80,
      max: 200,
    },
    series: [
      {
        // upper edge of normal band — carries the green fill down to lower edge
        name: 'Normal 110-160',
        type: 'line',
        data: pts.map(() => 160),
        lineStyle: { color: '#22c55e', width: 1, type: 'dashed' as const, opacity: 0.6 },
        itemStyle: { color: '#22c55e' },
        symbol: 'none',
        areaStyle: { color: '#22c55e', opacity: 0.1, origin: 110 },
      },
      {
        // lower edge — dashed line only, no area
        name: 'Normal lower',
        type: 'line',
        data: pts.map(() => 110),
        lineStyle: { color: '#22c55e', width: 1, type: 'dashed' as const, opacity: 0.6 },
        itemStyle: { color: '#22c55e' },
        symbol: 'none',
      },
      {
        name: 'FHR',
        type: 'line',
        data: pts.map((p) => p.fetal_heart_rate),
        lineStyle: { color: '#06b6d4', width: 2 },
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const pt = pts[params.dataIndex]
            if (!pt) return '#06b6d4'
            if (pt.fetal_heart_rate < 110 || pt.fetal_heart_rate > 160) return '#ef4444'
            return '#06b6d4'
          },
        },
        symbolSize: 5,
      },
    ],
  }
})

const hasBpData = computed(() => props.dashboardData.bp_trend.length > 0)
const hasWeightData = computed(() => props.dashboardData.weight_trend.length > 0)
const hasFundalData = computed(() => props.dashboardData.fundal_height_trend.length > 0)
const hasFhrData = computed(() => props.dashboardData.fhr_trend.length > 0)
</script>

<template>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    <!-- Blood Pressure -->
    <Card>
      <CardHeader class="px-3 pb-0 pt-2.5">
        <CardTitle class="text-[11px] font-semibold">Blood Pressure Trend</CardTitle>
      </CardHeader>
      <CardContent class="px-2 pb-1.5">
        <div v-if="!hasBpData" class="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
          No blood pressure data recorded
        </div>
        <VChart
          v-else
          :option="bpOption"
          autoresize
          style="height: 220px; width: 100%"
        />
      </CardContent>
    </Card>

    <!-- Weight Gain -->
    <Card>
      <CardHeader class="px-3 pb-0 pt-2.5">
        <CardTitle class="text-[11px] font-semibold">Weight Gain Trend</CardTitle>
      </CardHeader>
      <CardContent class="px-2 pb-1.5">
        <div v-if="!hasWeightData" class="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
          No weight data recorded
        </div>
        <VChart
          v-else
          :option="weightOption"
          autoresize
          style="height: 220px; width: 100%"
        />
      </CardContent>
    </Card>

    <!-- Fundal Height (prenatal only) -->
    <Card v-if="showFetalCharts">
      <CardHeader class="px-3 pb-0 pt-2.5">
        <CardTitle class="text-[11px] font-semibold">Fundal Height Trend</CardTitle>
      </CardHeader>
      <CardContent class="px-2 pb-1.5">
        <div v-if="!hasFundalData" class="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
          No fundal height data recorded
        </div>
        <VChart
          v-else
          :option="fundalOption"
          autoresize
          style="height: 220px; width: 100%"
        />
      </CardContent>
    </Card>

    <!-- Fetal Heart Rate (prenatal only) -->
    <Card v-if="showFetalCharts">
      <CardHeader class="px-3 pb-0 pt-2.5">
        <CardTitle class="text-[11px] font-semibold">Fetal Heart Rate Trend</CardTitle>
      </CardHeader>
      <CardContent class="px-2 pb-1.5">
        <div v-if="!hasFhrData" class="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
          No FHR data recorded
        </div>
        <VChart
          v-else
          :option="fhrOption"
          autoresize
          style="height: 220px; width: 100%"
        />
      </CardContent>
    </Card>
  </div>
</template>
