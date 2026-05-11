<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Users,
  Stethoscope,
  Pill,
  UserCog,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-vue-next'
import { dashboardApi } from '@/domains/dashboard/api/dashboardApi'
import type { OwnerDashboardStats } from '@/domains/dashboard/api/dashboardApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { createDebouncedRefresh, shouldRunFallbackRefresh } from '@/composables/realtimeRefresh'
import StatCard from '@/domains/dashboard/components/StatCard.vue'
import OwnerRevenueChart from '@/domains/dashboard/components/OwnerRevenueChart.vue'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([PieChart, TooltipComponent, CanvasRenderer])
import ProBadgeBanner from '@/components/shared/ProBadgeBanner.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import PatientAvatar from '@/components/PatientAvatar.vue'
import { Button } from '@/components/ui/button'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { RouteNames } from '@/router/routeNames'

const router = useRouter()
const authStore = useAuthStore()

const hasAppointments = computed(() => authStore.hasFeature('appointments'))
const isPro = computed(() => authStore.isPro)
const todayCount = computed(() => stats.value?.my_upcoming_appointments.filter(a => a.date === todayDate).length ?? 0)

const stats = ref<OwnerDashboardStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const todayDate = new Date().toISOString().slice(0, 10)

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))
}

function formatMonth(dateString: string): string {
  return new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(new Date(dateString + 'T00:00:00'))
}

function formatDay(dateString: string): string {
  return new Date(dateString + 'T00:00:00').getDate().toString()
}

const appointmentStatusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-600',
  confirmed: 'bg-blue-500/10 text-blue-600',
  checked_in: 'bg-green-500/10 text-green-600',
  in_progress: 'bg-amber-500/10 text-amber-600',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  no_show: 'bg-destructive/10 text-destructive',
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ')
}

// Patient distribution mini chart
const distData = ref<{ name: string; value: number }[]>([])
const distCity = ref<string | null>(null)
const distOther = ref(0)
const distLoaded = ref(false)

const distColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#22c55e',
]

const distOption = computed(() => ({
  color: distColors,
  tooltip: {
    trigger: 'item' as const,
    formatter: (params: { name: string; value: number; percent: number }) =>
      `<b>${params.name}</b><br/>${params.value} patient${params.value > 1 ? 's' : ''} (${params.percent}%)`,
  },
  series: [{
    type: 'pie',
    radius: ['55%', '85%'],
    center: ['50%', '50%'],
    data: distData.value,
    label: { show: false },
    emphasis: {
      itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.1)' },
      scale: true,
      scaleSize: 4,
    },
    itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 1.5 },
  }],
}))

const showDistDialog = ref(false)

const distFullOption = computed(() => ({
  color: distColors,
  tooltip: {
    trigger: 'item' as const,
    formatter: (params: { name: string; value: number; percent: number }) =>
      `<b>${params.name}</b><br/>${params.value} patient${params.value > 1 ? 's' : ''} (${params.percent}%)`,
  },
  series: [{
    type: 'pie',
    radius: ['40%', '75%'],
    center: ['50%', '50%'],
    data: distData.value,
    label: {
      show: true,
      fontSize: 12,
      color: '#475569',
      formatter: (params: { name: string; percent: number }) =>
        params.percent >= 2 ? `${params.name}` : '',
    },
    labelLine: { show: true, length: 12, length2: 18 },
    emphasis: {
      itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
    },
    itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
  }],
}))

async function fetchDistribution() {
  try {
    const res = await dashboardApi.patientDistribution()
    distData.value = res.data.data
    distCity.value = res.data.city
    distOther.value = res.data.other
  } catch { /* ignore */ }
  distLoaded.value = true
}

async function fetchStats(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const response = await dashboardApi.ownerStats()
    stats.value = response.data
  } catch {
    error.value = 'Failed to load dashboard stats. Please try again.'
  } finally {
    loading.value = false
  }
}

// Real-time updates
const { isConnected, subscribe, unsubscribe } = useCentrifugo()
let pollInterval: ReturnType<typeof setInterval> | undefined

function silentRefresh() {
  dashboardApi.ownerStats().then((response) => {
    stats.value = response.data
  }).catch(() => {})
}

const refreshFromRealtime = createDebouncedRefresh(silentRefresh, 1_000)

onMounted(() => {
  fetchStats()
  if (isPro.value) fetchDistribution()

  const clinicId = authStore.currentClinic?.id
  if (clinicId) {
    subscribe(`clinic:${clinicId}:queue`, () => {
      refreshFromRealtime()
    })
  }

  pollInterval = setInterval(() => {
    if (shouldRunFallbackRefresh(isConnected.value)) silentRefresh()
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  const clinicId = authStore.currentClinic?.id
  if (clinicId) {
    unsubscribe(`clinic:${clinicId}:queue`)
  }
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="flex flex-col gap-4 pt-4">
    <!-- Error state -->
    <div
      v-if="error"
      class="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
    >
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button variant="outline" size="sm" @click="fetchStats">
        <RefreshCw class="mr-2 size-3.5" />
        Retry
      </Button>
    </div>

    <template v-else>
      <ProBadgeBanner />

      <!-- Stat cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button class="text-left h-full" @click="router.push({ name: RouteNames.PATIENT_LIST })">
          <div class="surface-card h-full rounded-xl border p-6 text-card-foreground">
            <div class="flex items-start justify-between">
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-muted-foreground">Total Patients</span>
                <Skeleton v-if="loading" class="h-9 w-20" />
                <span v-else class="text-3xl font-bold tabular-nums">{{ stats?.total_patients ?? 0 }}</span>
                <p v-if="isPro && distLoaded && distCity" class="text-xs text-muted-foreground leading-snug mt-1">
                  <span class="font-semibold">{{ (stats?.total_patients ?? 0) - distOther }}</span> in {{ distCity }}
                  <span v-if="distOther > 0"><br/><span class="font-semibold">{{ distOther }}</span> from other areas</span>
                </p>
              </div>
              <div v-if="isPro && distLoaded && distData.length" class="shrink-0 cursor-pointer" @click.stop="showDistDialog = true">
                <VChart :option="distOption" autoresize style="width: 120px; height: 120px; pointer-events: none;" />
              </div>
              <div v-else class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-blue/10">
                <Users class="size-5 text-stat-blue" />
              </div>
            </div>
          </div>
        </button>
        <button class="text-left h-full" @click="router.push({ name: RouteNames.PATIENT_LIST })">
          <StatCard
            label="Today's Visits"
            :value="stats?.consultations_today ?? 0"
            :icon="Stethoscope"
            color-class="stat-green"
            :loading="loading"
          />
        </button>
        <button class="text-left h-full" @click="router.push({ name: RouteNames.TEAM })">
          <div class="surface-card rounded-xl border p-6 text-card-foreground">
            <div class="flex items-start justify-between">
              <div class="flex flex-col gap-3">
                <span class="text-sm font-medium text-muted-foreground">Team Members</span>
                <Skeleton v-if="loading" class="h-9 w-20" />
                <div v-else class="flex items-baseline gap-1.5">
                  <span class="text-3xl font-bold tabular-nums">{{ stats?.total_team_members ?? 0 }}</span>
                  <span class="text-xs text-stat-green font-medium">{{ stats?.online_team_members ?? 0 }} online</span>
                </div>
              </div>
              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-purple/10">
                <UserCog class="size-5 text-stat-purple" />
              </div>
            </div>
            <div v-if="!loading && stats?.online_team_members" class="mt-3 flex -space-x-2">
              <div
                v-for="member in stats.team_members.filter(m => m.is_online).slice(0, 6)"
                :key="member.user_id"
                class="relative"
              >
                <Avatar class="size-7 ring-2 ring-card">
                  <AvatarImage v-if="member.avatar_url" :src="member.avatar_url" :alt="member.name" class="object-cover" />
                  <AvatarFallback class="text-[10px] font-medium bg-muted">
                    {{ member.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?' }}
                  </AvatarFallback>
                </Avatar>
                <span class="absolute -bottom-0.5 -right-0.5 block size-2 rounded-full bg-green-500 ring-1 ring-card" />
              </div>
              <div
                v-if="stats.team_members.filter(m => m.is_online).length > 6"
                class="flex size-7 items-center justify-center rounded-full bg-muted ring-2 ring-card text-[10px] font-medium text-muted-foreground"
              >
                +{{ stats.team_members.filter(m => m.is_online).length - 6 }}
              </div>
            </div>
          </div>
        </button>
        <button class="text-left h-full" @click="router.push({ name: RouteNames.CLINIC_MEDICINES })">
          <StatCard
            label="Active Medicines"
            :value="stats?.total_medicines ?? 0"
            :icon="Pill"
            color-class="stat-orange"
            :loading="loading"
          />
        </button>
      </div>

      <!-- Widgets grid -->
      <div class="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <!-- Clinic Revenue -->
        <OwnerRevenueChart />

        <!-- Your Upcoming Appointments -->
        <div v-if="hasAppointments && (loading || stats?.my_upcoming_appointments.length)" class="surface-card overflow-hidden rounded-xl border p-6 text-card-foreground">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold">
              Your Upcoming Appointments
              <span v-if="!loading && todayCount > 0" class="ml-1.5 inline-flex items-center rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">today {{ todayCount }}</span>
            </h2>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="router.push({ name: RouteNames.SCHEDULE })">
              View schedule
              <ChevronRight class="size-3.5" />
            </Button>
          </div>

          <div v-if="loading" class="flex flex-col gap-3">
            <div v-for="n in 3" :key="n" class="flex items-center gap-3">
              <Skeleton class="h-5 w-14 shrink-0" />
              <Skeleton class="size-8 shrink-0 rounded-full" />
              <div class="flex flex-col gap-1">
                <Skeleton class="h-4 w-28" />
                <Skeleton class="h-3 w-20" />
              </div>
            </div>
          </div>

          <ul v-else class="flex max-h-72 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden">
            <li
              v-for="appt in stats?.my_upcoming_appointments ?? []"
              :key="appt.id"
              class="flex cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-muted/50 rounded-lg"
              @click="router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: appt.patient_id } })"
            >
              <div v-if="appt.date === todayDate" class="w-14 shrink-0 flex flex-col items-center rounded-lg border border-green-600 bg-green-600 py-1">
                <span class="text-[10px] font-semibold uppercase text-white leading-none">Today</span>
                <span class="text-lg font-bold leading-tight tabular-nums text-white">{{ formatDay(appt.date) }}</span>
                <span class="text-[10px] font-semibold tabular-nums text-white/80 leading-none">{{ appt.scheduled_at }}</span>
              </div>
              <div v-else class="w-14 shrink-0 flex flex-col items-center rounded-lg border bg-muted/50 py-1">
                <span class="text-[10px] font-medium uppercase text-muted-foreground leading-none">{{ formatMonth(appt.date) }}</span>
                <span class="text-lg font-bold leading-tight tabular-nums">{{ formatDay(appt.date) }}</span>
                <span class="text-[10px] font-medium tabular-nums text-muted-foreground leading-none">{{ appt.scheduled_at }}</span>
              </div>
              <PatientAvatar
                :avatar-url="appt.patient_avatar_url"
                :sex="appt.patient_sex"
                :name="appt.patient_name"
                class="size-8 shrink-0"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ appt.patient_name }}</span>
              </div>
              <Badge
                variant="secondary"
                class="shrink-0 text-[10px] capitalize"
                :class="appointmentStatusColors[appt.status] ?? ''"
              >
                {{ formatStatus(appt.status) }}
              </Badge>
            </li>
          </ul>
        </div>

        <!-- Today's Clinic Appointments -->
        <div v-if="hasAppointments && (loading || stats?.todays_appointments.length)" class="surface-card overflow-hidden rounded-xl border p-6 text-card-foreground">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Today's Clinic Appointments</h2>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="router.push({ name: RouteNames.APPOINTMENT_LIST })">
              View all
              <ChevronRight class="size-3.5" />
            </Button>
          </div>

          <div v-if="loading" class="flex flex-col gap-3">
            <div v-for="n in 3" :key="n" class="flex items-center gap-3">
              <Skeleton class="h-5 w-14 shrink-0" />
              <Skeleton class="size-8 shrink-0 rounded-full" />
              <div class="flex flex-col gap-1">
                <Skeleton class="h-4 w-28" />
                <Skeleton class="h-3 w-20" />
              </div>
            </div>
          </div>

          <ul v-else class="flex max-h-72 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden">
            <li
              v-for="appt in stats?.todays_appointments ?? []"
              :key="appt.id"
              class="flex cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-muted/50 rounded-lg"
              @click="router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: appt.patient_id } })"
            >
              <span class="w-16 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {{ appt.scheduled_at }}
              </span>
              <PatientAvatar
                :avatar-url="appt.patient_avatar_url"
                :sex="appt.patient_sex"
                :name="appt.patient_name"
                class="size-8 shrink-0"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ appt.patient_name }}</span>
                <span class="truncate text-xs text-muted-foreground">Dr. {{ appt.doctor_name }}</span>
              </div>
              <Badge
                variant="secondary"
                class="shrink-0 text-[10px] capitalize"
                :class="appointmentStatusColors[appt.status] ?? ''"
              >
                {{ formatStatus(appt.status) }}
              </Badge>
            </li>
          </ul>
        </div>

        <!-- Queue -->
        <div v-if="hasAppointments && (loading || stats?.queue_list.length)" class="surface-card rounded-xl border p-6 text-card-foreground">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              Queue
              <span v-if="!loading && stats?.queue_waiting" class="inline-flex items-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{{ stats.queue_waiting }} waiting</span>
              <span v-if="!loading && stats?.queue_in_progress" class="inline-flex items-center rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{{ stats.queue_in_progress }} in progress</span>
              <span v-if="!loading && stats?.queue_completed" class="inline-flex items-center rounded-full bg-gray-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{{ stats.queue_completed }} completed</span>
            </h2>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="router.push({ name: RouteNames.QUEUE })">
              View all
              <ChevronRight class="size-3.5" />
            </Button>
          </div>

          <div v-if="loading" class="flex flex-col gap-3">
            <div v-for="n in 3" :key="n" class="flex items-center gap-3">
              <Skeleton class="size-8 shrink-0 rounded-full" />
              <div class="flex flex-col gap-1">
                <Skeleton class="h-4 w-28" />
                <Skeleton class="h-3 w-20" />
              </div>
            </div>
          </div>

          <ul v-else class="flex flex-col divide-y divide-border">
            <li
              v-for="item in stats?.queue_list ?? []"
              :key="item.id"
              class="flex cursor-pointer items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/50 rounded-lg"
              @click="router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: item.patient_id } })"
            >
              <PatientAvatar
                :avatar-url="item.patient_avatar_url"
                :sex="item.patient_sex"
                :name="item.patient_name"
                class="size-8 shrink-0"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ item.patient_name }}</span>
                <span class="truncate text-xs text-muted-foreground">
                  Dr. {{ item.doctor_name }} - {{ item.queued_at }}
                </span>
              </div>
              <Badge
                variant="secondary"
                class="shrink-0 text-[10px] capitalize"
                :class="item.status === 'waiting' ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'"
              >
                {{ item.status === 'in_progress' ? 'serving' : item.status }}
              </Badge>
            </li>
          </ul>
        </div>

        <!-- Recent Consultations -->
        <div v-if="loading || stats?.recent_consultations.length" class="surface-card rounded-xl border p-6 text-card-foreground">
          <h2 class="mb-4 text-sm font-semibold">Recent Consultations</h2>

          <div v-if="loading" class="flex flex-col gap-3">
            <div v-for="n in 3" :key="n" class="flex items-center gap-3">
              <Skeleton class="size-8 shrink-0 rounded-full" />
              <div class="flex flex-col gap-1">
                <Skeleton class="h-4 w-32" />
                <Skeleton class="h-3 w-24" />
              </div>
            </div>
          </div>

          <ul v-else class="flex flex-col divide-y divide-border">
            <li
              v-for="consultation in stats?.recent_consultations ?? []"
              :key="consultation.id"
              class="flex cursor-pointer items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/50 rounded-lg"
              @click="router.push({ name: RouteNames.ENCOUNTER_DETAIL, params: { patientId: consultation.patient_id, id: consultation.id } })"
            >
              <PatientAvatar
                :avatar-url="consultation.patient_avatar_url"
                :sex="consultation.patient_sex"
                :name="consultation.patient_name"
                class="size-8 shrink-0"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ consultation.patient_name }}</span>
                <span class="truncate text-xs text-muted-foreground">Dr. {{ consultation.doctor_name }}</span>
              </div>
              <span class="shrink-0 text-xs text-muted-foreground">{{ formatDate(consultation.finalized_at) }}</span>
            </li>
          </ul>
        </div>

        <!-- Medicines Widget -->
        <div v-if="loading || stats?.top_medicines.length || stats?.low_stock_medicines.length" class="surface-card rounded-xl border p-6 text-card-foreground">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Medicines</h2>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="router.push({ name: RouteNames.CLINIC_MEDICINES })">
              View all
              <ChevronRight class="size-3.5" />
            </Button>
          </div>

          <div v-if="loading" class="flex flex-col gap-3">
            <div v-for="n in 4" :key="n" class="flex items-center gap-3">
              <Skeleton class="h-4 w-4 shrink-0" />
              <Skeleton class="h-4 w-40" />
              <Skeleton class="ml-auto h-4 w-8" />
            </div>
          </div>

          <template v-else>
            <!-- Top 5 most prescribed -->
            <div v-if="stats?.top_medicines.length">
              <div class="mb-2 flex items-center gap-1.5">
                <TrendingUp class="size-3.5 text-stat-green" />
                <span class="text-xs font-medium text-muted-foreground">Most Prescribed</span>
              </div>
              <ul class="flex flex-col gap-2">
                <li
                  v-for="(med, i) in stats.top_medicines"
                  :key="med.id"
                  class="flex items-center gap-3"
                >
                  <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {{ i + 1 }}
                  </span>
                  <div class="flex min-w-0 flex-1 flex-col">
                    <span class="truncate text-sm font-medium">{{ med.name }}</span>
                    <span v-if="med.dosage" class="text-xs text-muted-foreground">{{ med.dosage }}</span>
                  </div>
                  <div class="flex shrink-0 flex-col items-end">
                    <span class="text-sm font-semibold tabular-nums">{{ med.prescription_count }}</span>
                    <span v-if="med.stock_quantity !== null" class="text-[10px] text-muted-foreground">
                      {{ med.stock_quantity }} in stock
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Low stock alert -->
            <div v-if="stats?.low_stock_medicines.length" :class="stats?.top_medicines.length ? 'mt-5 border-t pt-5' : ''">
              <div class="mb-2 flex items-center gap-1.5">
                <AlertTriangle class="size-3.5 text-amber-500" />
                <span class="text-xs font-medium text-amber-600">Low Stock</span>
              </div>
              <ul class="flex flex-col gap-2">
                <li
                  v-for="med in stats.low_stock_medicines.slice(0, 3)"
                  :key="med.id"
                  class="flex items-center gap-3"
                >
                  <Pill class="size-4 shrink-0 text-muted-foreground" />
                  <div class="flex min-w-0 flex-1 flex-col">
                    <span class="truncate text-sm font-medium">{{ med.name }}</span>
                    <span v-if="med.dosage" class="text-xs text-muted-foreground">{{ med.dosage }}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    class="shrink-0 text-[10px]"
                    :class="med.stock_quantity === 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'"
                  >
                    {{ med.stock_quantity === 0 ? 'Out of stock' : `${med.stock_quantity} left` }}
                  </Badge>
                </li>
              </ul>
              <p
                v-if="stats.low_stock_medicines.length > 3"
                class="mt-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                @click="router.push({ name: RouteNames.CLINIC_MEDICINES })"
              >
                and {{ stats.low_stock_medicines.length - 3 }} more medicine{{ stats.low_stock_medicines.length - 3 > 1 ? 's' : '' }}
              </p>
            </div>
          </template>
        </div>
      </div>

    </template>

    <!-- Patient Distribution Dialog -->
    <Dialog v-model:open="showDistDialog">
      <DialogContent class="sm:max-w-2xl" @close-auto-focus.prevent>
        <DialogHeader>
          <DialogTitle>Patient Distribution</DialogTitle>
          <DialogDescription>
            {{ distCity }} · <span class="font-semibold">{{ (stats?.total_patients ?? 0) - distOther }}</span> patients
            <span v-if="distOther > 0"> · <span class="font-semibold">{{ distOther }}</span> from other areas</span>
          </DialogDescription>
        </DialogHeader>
        <VChart
          v-if="distData.length"
          :option="distFullOption"
          autoresize
          style="height: 500px; width: 100%;"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
