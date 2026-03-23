<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Stethoscope,
  Users,
  UserPlus,
  Clock,
  MonitorCheck,
  CalendarDays,
  ClipboardList,
  RefreshCw,
} from 'lucide-vue-next'
import { dashboardApi } from '@/domains/dashboard/api/dashboardApi'
import type { StaffDashboardStats } from '@/domains/dashboard/api/dashboardApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import StatCard from '@/domains/dashboard/components/StatCard.vue'
import ProBadgeBanner from '@/components/shared/ProBadgeBanner.vue'
import Button from '@/components/ui/button/Button.vue'

const authStore = useAuthStore()
const hasAppointments = computed(() => authStore.hasFeature('appointments'))

const stats = ref<StaffDashboardStats | null>(null)
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

async function fetchStats(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const response = await dashboardApi.staffStats()
    stats.value = response.data
  } catch {
    error.value = 'Failed to load dashboard stats. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchStats)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ greeting }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ clinicName }}</p>
    </div>

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

      <!-- First row: visit + patient overview -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Today's Visits"
          :value="stats?.consultations_today ?? 0"
          :icon="Stethoscope"
          color-class="stat-green"
          :loading="loading"
        />
        <StatCard
          label="Total Patients"
          :value="stats?.total_patients ?? 0"
          :icon="Users"
          color-class="stat-blue"
          :loading="loading"
        />
        <StatCard
          label="Registered Today"
          :value="stats?.patients_registered_today ?? 0"
          :icon="UserPlus"
          color-class="stat-purple"
          :loading="loading"
        />
      </div>

      <!-- Second row: queue + appointment ops -->
      <div v-if="hasAppointments" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Queue Waiting"
          :value="stats?.queue_waiting ?? 0"
          :icon="Clock"
          color-class="stat-orange"
          :loading="loading"
        />
        <StatCard
          label="Queue Serving"
          :value="stats?.queue_serving ?? 0"
          :icon="MonitorCheck"
          color-class="stat-green"
          :loading="loading"
        />
        <StatCard
          label="Today's Appointments"
          :value="stats?.appointments_today ?? 0"
          :icon="CalendarDays"
          color-class="stat-blue"
          :loading="loading"
        />
        <StatCard
          label="Pending Check-ins"
          :value="stats?.pending_checkins ?? 0"
          :icon="ClipboardList"
          color-class="stat-purple"
          :loading="loading"
        />
      </div>
    </template>
  </div>
</template>
