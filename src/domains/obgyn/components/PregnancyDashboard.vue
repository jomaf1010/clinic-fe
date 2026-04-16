<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  Weight,
  CalendarDays,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import PregnantIcon from '@/components/icons/PregnantIcon.vue'
import PregnantWeeksIcon from '@/components/icons/PregnantWeeksIcon.vue'
import ChartLineIcon from '@/components/icons/ChartLineIcon.vue'
import GACalculator from './GACalculator.vue'
import RiskClassificationBadge from './RiskClassificationBadge.vue'
import PrenatalTrendCharts from './PrenatalTrendCharts.vue'
import PrenatalCareChecklist from './PrenatalCareChecklist.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import type { Pregnancy } from '../types/obgyn.types'

const props = defineProps<{
  patientId: string
  pregnancyId: string
  pregnancy: Pregnancy
}>()

const pdStore = usePatientDetailStore()
const timelineAnimated = ref(false)

onMounted(() => {
  // Trigger timeline animation after render — data is already loaded by parent
  setTimeout(() => { timelineAnimated.value = true }, 100)
})

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const patientInitials = computed(() => {
  if (!pdStore.patient) return '?'
  return `${pdStore.patient.first_name.charAt(0)}${pdStore.patient.last_name.charAt(0)}`.toUpperCase()
})

// ── GA timeline ────────────────────────────────────────────────────
const TOTAL_WEEKS = 42
const gaWeeks = computed(() => props.pregnancy.current_ga?.weeks ?? 0)
const gaDays = computed(() => props.pregnancy.current_ga?.days ?? 0)
const gaProgressTarget = computed(() => Math.min(100, ((gaWeeks.value + gaDays.value / 7) / TOTAL_WEEKS) * 100))
const gaProgress = computed(() => timelineAnimated.value ? gaProgressTarget.value : 0)
const trimesterLabel = computed(() => {
  const w = gaWeeks.value
  if (w <= 13) return '1st Trimester'
  if (w <= 27) return '2nd Trimester'
  return '3rd Trimester'
})
const weekMarkers = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40]

function sexEmoji(sex: string | undefined): string {
  if (sex === 'male') return '👦'
  if (sex === 'female') return '👧'
  return '👶'
}

const babyEmoji = computed(() => {
  const fetuses = props.pregnancy.fetuses
  if (!fetuses?.length || fetuses.length === 1) {
    return sexEmoji(fetuses?.[0]?.sex)
  }
  return fetuses.map((f) => sexEmoji(f.sex)).join('')
})

const babyRingColor = computed(() => {
  const sex = props.pregnancy.fetuses?.[0]?.sex
  if (sex === 'female') return 'ring-pink-400'
  if (sex === 'male') return 'ring-blue-400'
  return 'ring-purple-400'
})

const babyPingColor = computed(() => {
  const sex = props.pregnancy.fetuses?.[0]?.sex
  if (sex === 'female') return 'bg-pink-400/30'
  if (sex === 'male') return 'bg-blue-400/30'
  return 'bg-purple-400/30'
})

const gpal = computed(() => {
  const gp = pdStore.gynProfile
  if (!gp) return '—'
  const g = gp.gravidity ?? '?'
  const t = gp.parity_term ?? '?'
  const pt = gp.parity_preterm ?? '?'
  const a = gp.abortions ?? '?'
  const l = gp.living_children ?? '?'
  return `G${g}P(${t}-${pt}-${a}-${l})`
})

const weeksRemaining = computed(() => {
  if (!props.pregnancy.edd) return null
  const currentWeeks = gaWeeks.value
  const remaining = 40 - currentWeeks
  return remaining > 0 ? remaining : 0
})

const statusConfig = computed(() => {
  switch (props.pregnancy.status) {
    case 'active':
      return { label: 'Active', class: 'border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400' }
    case 'postpartum':
      return { label: 'Postpartum', class: 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400' }
    case 'delivered':
      return { label: 'Delivered', class: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400' }
    case 'resolved':
      return { label: 'Resolved', class: 'border-red-200 bg-red-100 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400' }
    default:
      return { label: 'Inactive', class: '' }
  }
})

// Timeline visits from dashboard data
const visitSummary = computed(() => pdStore.pregnancyDashboard?.visit_summary ?? [])
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Loading state -->
    <div v-if="pdStore.isLoadingObgyn" class="flex items-center justify-center py-16">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="pdStore.pregnancyDashboard">
      <!-- A. Patient Card + GA Timeline ────────────────────────────────── -->
      <div v-if="pdStore.patient" class="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <!-- Patient info row -->
        <div class="flex items-center gap-4">
          <Avatar class="size-12">
            <AvatarImage v-if="pdStore.patient.avatar_url" :src="pdStore.patient.avatar_url" :alt="pdStore.patient.full_name" />
            <AvatarFallback class="bg-gradient-to-br from-purple-500 to-pink-500 text-lg font-semibold text-white">
              {{ patientInitials }}
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold leading-tight">{{ pdStore.patient.full_name }}</h2>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span v-if="pdStore.patientAge !== null">{{ pdStore.patientAge }} yrs old</span>
              <span v-if="pdStore.patient.sex">&middot; {{ pdStore.patient.sex === 'female' ? 'Female' : pdStore.patient.sex }}</span>
              <span v-if="pdStore.patient.blood_type">&middot; {{ pdStore.patient.blood_type }}</span>
              <span v-if="pdStore.patient.contact_number">&middot; {{ pdStore.patient.contact_number }}</span>
            </div>
          </div>
          <div class="hidden sm:flex items-center gap-2">
            <Badge variant="outline" class="text-xs" :class="statusConfig.class">
              {{ statusConfig.label }}
            </Badge>
          </div>
        </div>

        <!-- GA Timeline Ruler -->
        <div v-if="pregnancy.edd && pregnancy.status === 'active'" class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{{ trimesterLabel }}</span>
            <span class="font-medium text-foreground">{{ gaWeeks }}w {{ gaDays }}d</span>
          </div>

          <!-- Progress bar -->
          <div class="relative mt-2 mb-3">
            <!-- Track -->
            <div class="h-3 w-full overflow-hidden rounded-full bg-muted">
              <!-- Trimester dividers -->
              <div class="absolute left-[33.3%] top-0 h-3 w-px bg-border/50 z-10" />
              <div class="absolute left-[66.6%] top-0 h-3 w-px bg-border/50 z-10" />

              <!-- Rainbow progress -->
              <div
                class="absolute inset-y-0 left-0 h-3 rounded-full transition-all duration-1000 ease-out"
                :style="{ width: `${gaProgress}%`, background: 'linear-gradient(90deg, #a78bfa, #ec4899, #f97316, #eab308, #22c55e, #06b6d4)' }"
              />
            </div>

            <!-- Baby marker (outside overflow container) -->
            <div
              class="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-1000 ease-out"
              :style="{ left: `${gaProgress}%` }"
            >
              <div class="group relative flex items-center justify-center" :class="pregnancy.fetus_count > 1 ? '-ml-3.5 size-7' : '-ml-2.5 size-5'">
                <span class="absolute inset-0 animate-ping rounded-full" :class="babyPingColor" />
                <span class="relative flex items-center justify-center overflow-visible rounded-full bg-white shadow-md ring-2 whitespace-nowrap cursor-pointer" :class="[babyRingColor, pregnancy.fetus_count > 1 ? 'size-7' : 'size-5']">
                  <span :class="pregnancy.fetus_count > 1 ? 'text-sm' : 'text-lg'">{{ babyEmoji }}</span>
                </span>
                <!-- Hover tooltip -->
                <div class="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {{ babyEmoji }} {{ weeksRemaining !== null && weeksRemaining > 0 ? `${weeksRemaining} weeks to go · EDD ${formatDate(pregnancy.edd)}` : 'Due any day!' }}
                  <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 size-2 rotate-45 bg-foreground" />
                </div>
              </div>
            </div>
          </div>

          <!-- Week markers -->
          <div class="relative h-3 w-full">
            <div
              v-for="w in weekMarkers"
              :key="w"
              class="absolute flex flex-col items-center"
              :style="{ left: `${(w / TOTAL_WEEKS) * 100}%` }"
            >
              <div class="h-1.5 w-px bg-muted-foreground/30" />
              <span class="mt-0.5 text-[8px] tabular-nums text-muted-foreground/60 -translate-x-1/2">{{ w }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- B. Summary Cards ─────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Obstetric Hx -->
        <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-sm">
            <PregnantIcon class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Obstetric Hx</p>
            <p class="font-mono text-lg font-bold">{{ gpal }}</p>
          </div>
        </div>

        <!-- Gestational Age -->
        <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-sm">
            <PregnantWeeksIcon class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">GA</p>
            <GACalculator v-if="pregnancy.edd" :edd="pregnancy.edd" class="text-sm font-bold" />
            <p v-else class="text-sm text-muted-foreground">—</p>
          </div>
        </div>

        <!-- EDD -->
        <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
            <CalendarDays class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">EDD</p>
            <p class="text-lg font-bold">{{ formatDate(pregnancy.edd) }}</p>
            <p v-if="weeksRemaining !== null && weeksRemaining > 0" class="text-[10px] text-muted-foreground">
              {{ weeksRemaining }}w remaining
            </p>
            <p v-else-if="weeksRemaining === 0" class="text-[10px] text-green-600 dark:text-green-400">
              Past EDD
            </p>
          </div>
        </div>

        <!-- Risk Level -->
        <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
            :class="pregnancy.risk_level === 'high'
              ? 'bg-gradient-to-br from-red-500 to-orange-500'
              : 'bg-gradient-to-br from-emerald-500 to-green-500'"
          >
            <ShieldAlert class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Risk</p>
            <RiskClassificationBadge
              v-if="pregnancy.risk_level"
              :level="pregnancy.risk_level"
              :factors="pregnancy.risk_factors"
            />
            <p v-else class="text-xs text-muted-foreground">Not assessed</p>
          </div>
        </div>

        <!-- Total Visits -->
        <div class="flex items-start gap-3 rounded-xl border bg-card p-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-sm">
            <ChartLineIcon class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Visits</p>
            <p class="text-lg font-bold tabular-nums">{{ pdStore.pregnancyDashboard.visit_summary?.count ?? 0 }}</p>
          </div>
        </div>
      </div>

      <!-- B. Trend Charts ──────────────────────────────────────────────── -->
      <PrenatalTrendCharts :dashboard-data="dashboardData" />

      <!-- C. Lab Tracker ──────────────────────────────────────────────── -->
      <PrenatalCareChecklist
        :patient-id="patientId"
        :pregnancy-id="pregnancyId"
        :disabled="pregnancy.status !== 'active'"
      />

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
