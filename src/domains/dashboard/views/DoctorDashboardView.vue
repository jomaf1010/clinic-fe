<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Stethoscope,
  FileEdit,
  Users,
  Clock,
  CalendarDays,
  RefreshCw,
  UserRound,
  Plus,
  ListOrdered,
  UserPlus,
  ChevronRight,
  AlertCircle,
  LoaderCircle,
} from 'lucide-vue-next'
import { dashboardApi } from '@/domains/dashboard/api/dashboardApi'
import type { DoctorDashboardStats, DoctorAppointment } from '@/domains/dashboard/api/dashboardApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import StatCard from '@/domains/dashboard/components/StatCard.vue'
import RevenueChart from '@/domains/dashboard/components/RevenueChart.vue'
import ProBadgeBanner from '@/components/shared/ProBadgeBanner.vue'
import { Badge } from '@/components/ui/badge'
import PatientAvatar from '@/components/PatientAvatar.vue'
import { Button } from '@/components/ui/button'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { RouteNames } from '@/router/routeNames'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { queueApi } from '@/domains/queue/api/queueApi'
import { toast } from 'vue-sonner'

const router = useRouter()
const authStore = useAuthStore()

const hasAppointments = computed(() => authStore.hasFeature('appointments'))

const stats = ref<DoctorDashboardStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const greeting = computed(() => {
  const name = authStore.user?.name ?? authStore.user?.email ?? ''
  return `${getGreeting()}, ${name}`
})

const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? '')

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const groupedAppointments = computed(() => {
  if (!stats.value?.upcoming_appointments.length) return []

  const groups: { date: string; label: string; appointments: DoctorAppointment[] }[] = []
  let currentDate = ''

  for (const appt of stats.value.upcoming_appointments) {
    if (appt.date !== currentDate) {
      currentDate = appt.date
      groups.push({ date: appt.date, label: formatDateLabel(appt.date), appointments: [] })
    }
    groups[groups.length - 1]!.appointments.push(appt)
  }

  return groups
})

const appointmentStatusColors: Record<string, string> = {
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

const callingId = ref<string | null>(null)

async function handleCall(item: { id: string; patient_id: string; consultation_id: string | null }) {
  callingId.value = item.id
  try {
    const response = await queueApi.call(item.id)
    toast.success('Patient called')

    const consultationId = response.data.consultation_id ?? item.consultation_id
    if (consultationId) {
      router.push({
        name: RouteNames.CONSULTATION_DETAIL,
        params: { patientId: item.patient_id, id: consultationId },
      })
    } else {
      router.push({
        name: RouteNames.CONSULTATION_NEW,
        params: { patientId: item.patient_id },
      })
    }
  } catch {
    toast.error('Failed to call patient')
  } finally {
    callingId.value = null
  }
}

async function fetchStats(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const response = await dashboardApi.doctorStats()
    stats.value = response.data
  } catch {
    error.value = 'Failed to load dashboard stats. Please try again.'
  } finally {
    loading.value = false
  }
}

// Real-time updates
const { subscribe, unsubscribe } = useCentrifugo()
let pollInterval: ReturnType<typeof setInterval> | undefined

function silentRefresh() {
  dashboardApi.doctorStats().then((response) => {
    stats.value = response.data
  }).catch(() => {})
}

onMounted(() => {
  fetchStats()

  // Subscribe to queue channel for instant queue updates
  const clinicId = authStore.currentClinic?.id
  if (clinicId) {
    const queueChannel = `clinic:${clinicId}:queue`
    subscribe(queueChannel, () => {
      silentRefresh()
    })
  }

  // Poll every 30s for other changes (consultations, appointments, patients)
  pollInterval = setInterval(silentRefresh, 30000)
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

      <!-- Stat cards - clickable -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button class="text-left" @click="router.push({ name: RouteNames.PATIENT_LIST })">
          <StatCard
            label="My Consultations Today"
            :value="stats?.my_consultations_today ?? 0"
            :icon="Stethoscope"
            color-class="stat-green"
            :loading="loading"
          />
        </button>
        <button class="text-left" @click="router.push({ name: RouteNames.PATIENT_LIST })">
          <StatCard
            label="My Patients"
            :value="stats?.my_patients_total ?? 0"
            :icon="Users"
            color-class="stat-blue"
            :loading="loading"
          />
        </button>
        <button v-if="hasAppointments" class="text-left" @click="router.push({ name: RouteNames.QUEUE })">
          <StatCard
            label="Queue Waiting"
            :value="stats?.queue_waiting ?? 0"
            :icon="Clock"
            color-class="stat-orange"
            :loading="loading"
          />
        </button>
        <RevenueChart />
      </div>

      <!-- Widgets grid -->
      <div class="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <!-- Upcoming Schedule -->
        <div v-if="hasAppointments && (loading || groupedAppointments.length)" class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm overflow-hidden">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Upcoming Schedule</h2>
            <Button variant="ghost" size="sm" class="h-7 text-xs" @click="router.push({ name: RouteNames.APPOINTMENT_LIST })">
              View all
              <ChevronRight class="size-3.5" />
            </Button>
          </div>

          <div v-if="loading" class="flex flex-col gap-3">
            <div v-for="n in 3" :key="n" class="flex items-center gap-3">
              <Skeleton class="h-5 w-12 shrink-0" />
              <Skeleton class="size-8 shrink-0 rounded-full" />
              <div class="flex flex-col gap-1">
                <Skeleton class="h-4 w-28" />
                <Skeleton class="h-3 w-16" />
              </div>
            </div>
          </div>

          <div v-else class="flex max-h-80 flex-col gap-4 overflow-y-auto overflow-x-hidden">
            <div v-for="group in groupedAppointments" :key="group.date">
              <div class="mb-2 flex items-center gap-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {{ group.label }}
                </span>
                <div class="h-px flex-1 bg-border" />
              </div>
              <ul class="flex flex-col">
                <li
                  v-for="appt in group.appointments"
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
          </div>
        </div>

        <!-- Queue Preview -->
        <div v-if="hasAppointments && (loading || stats?.queue_list.length)" class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Queue</h2>
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
                <Skeleton class="h-3 w-16" />
              </div>
            </div>
          </div>

          <ul v-else class="flex flex-col divide-y divide-border">
            <li
              v-for="item in stats.queue_list"
              :key="item.id"
              class="flex items-center gap-3 py-3 first:pt-0 last:pb-0 -mx-2 px-2 rounded-lg"
            >
              <button
                class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 transition-colors hover:opacity-80"
                @click="router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: item.patient_id } })"
              >
                <PatientAvatar
                  :avatar-url="item.patient_avatar_url"
                  :sex="item.patient_sex"
                  :name="item.patient_name"
                  class="size-8 shrink-0"
                />
                <div class="flex min-w-0 flex-1 flex-col text-left">
                  <span class="truncate text-sm font-medium">{{ item.patient_name }}</span>
                  <span class="text-xs text-muted-foreground">Queued at {{ item.queued_at }}</span>
                </div>
              </button>
              <Button
                v-if="item.status === 'waiting'"
                size="sm"
                variant="outline"
                class="h-7 shrink-0 text-xs"
                :disabled="callingId !== null"
                @click.stop="handleCall(item)"
              >
                <LoaderCircle v-if="callingId === item.id" class="size-3 animate-spin" />
                <Stethoscope v-else class="size-3" />
                Call
              </Button>
              <Badge
                v-else
                variant="secondary"
                class="shrink-0 text-[10px] capitalize bg-green-500/10 text-green-600"
              >
                Serving
              </Badge>
            </li>
          </ul>
        </div>

        <!-- Draft Consultations -->
        <div v-if="loading || stats?.draft_consultations_list.length" class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold">Draft Consultations</h2>
              <Badge
                v-if="!loading && stats?.draft_consultations_list.length"
                variant="secondary"
                class="text-[10px] bg-purple-500/10 text-purple-600"
              >
                {{ stats.draft_consultations_list.length }}
              </Badge>
            </div>
          </div>

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
              v-for="draft in stats.draft_consultations_list"
              :key="draft.id"
              class="flex cursor-pointer items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/50 -mx-2 px-2 rounded-lg"
              @click="router.push({ name: RouteNames.CONSULTATION_DETAIL, params: { patientId: draft.patient_id, id: draft.id } })"
            >
              <PatientAvatar
                :avatar-url="draft.patient_avatar_url"
                :sex="draft.patient_sex"
                :name="draft.patient_name"
                class="size-8 shrink-0"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ draft.patient_name }}</span>
                <span class="truncate text-xs text-muted-foreground">
                  {{ draft.chief_complaint ?? 'No chief complaint' }}
                </span>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="text-xs text-muted-foreground">{{ formatDate(draft.updated_at) }}</span>
                <Badge variant="secondary" class="text-[10px] bg-amber-500/10 text-amber-600">
                  <AlertCircle class="mr-0.5 size-2.5" />
                  Resume
                </Badge>
              </div>
            </li>
          </ul>
        </div>

        <!-- Recent Patients -->
        <div v-if="loading || stats?.recent_patients.length" class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <h2 class="mb-4 text-sm font-semibold">Recent Patients</h2>

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
              v-for="patient in stats.recent_patients"
              :key="patient.id"
              class="flex cursor-pointer items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/50 -mx-2 px-2 rounded-lg"
              @click="router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: patient.id } })"
            >
              <PatientAvatar
                :avatar-url="patient.avatar_url"
                :sex="patient.sex"
                :name="patient.name"
                class="size-8 shrink-0"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium">{{ patient.name }}</span>
                <span class="text-xs text-muted-foreground">
                  Last visit: {{ formatDate(patient.last_visit) }}
                </span>
              </div>
              <ChevronRight class="size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
            </li>
          </ul>
        </div>
      </div>

    </template>
  </div>
</template>
