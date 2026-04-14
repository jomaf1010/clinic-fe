<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  LoaderCircle,
  Activity,
  Weight,
  CalendarDays,
  Baby,
  Hash,
  AlertTriangle,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import GACalculator from './GACalculator.vue'
import RiskClassificationBadge from './RiskClassificationBadge.vue'
import PrenatalTrendCharts from './PrenatalTrendCharts.vue'
import PrenatalLabTracker from './PrenatalLabTracker.vue'
import { obgynApi } from '../api/obgynApi'
import type { Pregnancy, PregnancyDashboard as PregnancyDashboardData } from '../types/obgyn.types'

const props = defineProps<{
  patientId: string
  pregnancyId: string
  pregnancy: Pregnancy
}>()

const dashboardData = ref<PregnancyDashboardData | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)

onMounted(async () => {
  isLoading.value = true
  loadError.value = null
  try {
    const res = await obgynApi.getDashboard(props.patientId, props.pregnancyId)
    dashboardData.value = res.data
  } catch {
    loadError.value = 'Failed to load dashboard data.'
  } finally {
    isLoading.value = false
  }
})

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const gpal = computed(() => {
  const p = props.pregnancy
  const g = p.gravidity ?? '?'
  const t = p.parity_term ?? '?'
  const pt = p.parity_preterm ?? '?'
  const a = p.abortions ?? '?'
  const l = p.living_children ?? '?'
  return `G${g}P${t}${pt}A${a}L${l}`
})

const weeksRemaining = computed(() => {
  if (!props.pregnancy.edd) return null
  const eddDate = new Date(props.pregnancy.edd)
  const today = new Date()
  const diffMs = eddDate.getTime() - today.getTime()
  if (diffMs <= 0) return 0
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
})

const statusConfig = computed(() => {
  switch (props.pregnancy.status) {
    case 'active':
      return { label: 'Active', class: 'border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400' }
    case 'postpartum':
      return { label: 'Postpartum', class: 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400' }
    case 'delivered':
      return { label: 'Delivered', class: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400' }
    case 'lost':
      return { label: 'Lost', class: 'border-red-200 bg-red-100 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400' }
    default:
      return { label: 'Inactive', class: '' }
  }
})

// Timeline visits from dashboard data
const visitSummary = computed(() => dashboardData.value?.visit_summary ?? [])
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Error state -->
    <div
      v-else-if="loadError"
      role="alert"
      class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <template v-else-if="dashboardData">
      <!-- A. Summary Header ─────────────────────────────────────────────── -->
      <Card>
        <CardContent class="pt-4 pb-4">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <!-- GPAL -->
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1 text-xs text-muted-foreground">
                <Baby class="size-3.5 text-muted-foreground" />
                Obstetric Hx
              </span>
              <span class="font-mono text-sm font-semibold">{{ gpal }}</span>
            </div>

            <!-- Current GA -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs text-muted-foreground">Gestational Age</span>
              <GACalculator v-if="pregnancy.edd" :edd="pregnancy.edd" />
              <span v-else class="text-sm text-muted-foreground">—</span>
            </div>

            <!-- EDD -->
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays class="size-3.5 text-muted-foreground" />
                EDD
              </span>
              <span class="text-sm font-semibold">{{ formatDate(pregnancy.edd) }}</span>
              <span v-if="weeksRemaining !== null && weeksRemaining > 0" class="text-xs text-muted-foreground">
                {{ weeksRemaining }}w remaining
              </span>
              <span v-else-if="weeksRemaining === 0" class="text-xs text-green-600 dark:text-green-400">
                Past EDD
              </span>
            </div>

            <!-- Risk -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs text-muted-foreground">Risk Level</span>
              <RiskClassificationBadge
                v-if="pregnancy.risk_level"
                :level="pregnancy.risk_level"
                :factors="pregnancy.risk_factors"
              />
              <span v-else class="text-xs text-muted-foreground">Not assessed</span>
            </div>

            <!-- Status -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs text-muted-foreground">Status</span>
              <Badge variant="outline" class="w-fit text-xs" :class="statusConfig.class">
                {{ statusConfig.label }}
              </Badge>
            </div>

            <!-- Total Visits -->
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1 text-xs text-muted-foreground">
                <Hash class="size-3.5 text-muted-foreground" />
                Total Visits
              </span>
              <span class="text-2xl font-bold tabular-nums">{{ dashboardData.visit_count }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- B. Trend Charts ──────────────────────────────────────────────── -->
      <PrenatalTrendCharts :dashboard-data="dashboardData" />

      <!-- C. Lab Tracker ──────────────────────────────────────────────── -->
      <PrenatalLabTracker :patient-id="patientId" :pregnancy-id="pregnancyId" />

      <!-- D. Visit Timeline ───────────────────────────────────────────── -->
      <Card v-if="visitSummary.length > 0">
        <CardHeader class="pb-2 pt-3">
          <CardTitle class="text-sm font-semibold">Visit Timeline</CardTitle>
        </CardHeader>
        <CardContent class="pb-4">
          <div class="flex flex-col gap-2">
            <div
              v-for="v in visitSummary"
              :key="v.id"
              class="flex flex-col gap-1.5 rounded-md border px-3 py-2.5"
              :class="v.danger_signs.length > 0 ? 'border-l-2 border-l-red-400 bg-red-50/40 dark:bg-red-950/20' : 'bg-card'"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold">Visit #{{ v.visit_number }}</span>
                  <Separator orientation="vertical" class="h-3" />
                  <span class="text-xs text-muted-foreground">{{ formatDate(v.visit_date) }}</span>
                  <Badge
                    v-if="v.gestational_age_weeks !== null"
                    variant="secondary"
                    class="text-[10px]"
                  >
                    {{ v.gestational_age_weeks }}w{{ v.gestational_age_days !== null ? `${v.gestational_age_days}d` : '' }}
                  </Badge>
                </div>
                <Badge
                  v-if="v.pregnancy_progress"
                  variant="outline"
                  class="text-[10px]"
                  :class="{
                    'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400': v.pregnancy_progress === 'normal',
                    'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400': v.pregnancy_progress === 'complicated',
                    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400': v.pregnancy_progress !== 'normal' && v.pregnancy_progress !== 'complicated',
                  }"
                >
                  {{ v.pregnancy_progress }}
                </Badge>
              </div>

              <!-- Key vitals row -->
              <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-4">
                <div v-if="v.bp_systolic && v.bp_diastolic" class="flex items-center gap-1 text-muted-foreground">
                  <Activity class="size-3 shrink-0" />
                  <span>BP: <strong class="text-foreground">{{ v.bp_systolic }}/{{ v.bp_diastolic }}</strong></span>
                </div>
                <div v-if="v.weight" class="flex items-center gap-1 text-muted-foreground">
                  <Weight class="size-3 shrink-0" />
                  <span>Wt: <strong class="text-foreground">{{ v.weight }} kg</strong></span>
                </div>
                <div v-if="v.fetal_heart_rate" class="text-muted-foreground">
                  FHR: <strong class="text-foreground">{{ v.fetal_heart_rate }} bpm</strong>
                </div>
                <div v-if="v.fundal_height" class="text-muted-foreground">
                  FH: <strong class="text-foreground">{{ v.fundal_height }} cm</strong>
                </div>
              </div>

              <!-- Danger signs -->
              <div v-if="v.danger_signs.length > 0" class="flex flex-wrap items-center gap-1">
                <AlertTriangle class="size-3 text-red-500" />
                <Badge
                  v-for="sign in v.danger_signs"
                  :key="sign"
                  variant="destructive"
                  class="text-[10px]"
                >
                  {{ sign.replace(/_/g, ' ') }}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
