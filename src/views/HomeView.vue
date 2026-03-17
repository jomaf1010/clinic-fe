<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Users, Stethoscope, FileEdit, Pill, BarChart3, RefreshCw } from 'lucide-vue-next'
import { dashboardApi } from '@/domains/dashboard/api/dashboardApi'
import type { DashboardStats } from '@/domains/dashboard/api/dashboardApi'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import Button from '@/components/ui/button/Button.vue'

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function fetchStats() {
  loading.value = true
  error.value = null
  try {
    const response = await dashboardApi.stats()
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
  <div class="flex flex-col gap-6">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Overview of your clinic activity
      </p>
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

    <!-- Stat cards -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Total Patients -->
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-3">
            <span class="text-sm font-medium text-muted-foreground">Total Patients</span>
            <Skeleton v-if="loading" class="h-9 w-20" />
            <span v-else class="text-3xl font-bold tabular-nums">
              {{ stats?.total_patients ?? 0 }}
            </span>
          </div>
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-blue/10">
            <Users class="size-5 text-stat-blue" />
          </div>
        </div>
      </div>

      <!-- Today's Visits -->
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-3">
            <span class="text-sm font-medium text-muted-foreground">Today's Visits</span>
            <Skeleton v-if="loading" class="h-9 w-20" />
            <span v-else class="text-3xl font-bold tabular-nums">
              {{ stats?.consultations_today ?? 0 }}
            </span>
          </div>
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-green/10">
            <Stethoscope class="size-5 text-stat-green" />
          </div>
        </div>
      </div>

      <!-- Draft Consultations -->
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-3">
            <span class="text-sm font-medium text-muted-foreground">Draft Consultations</span>
            <Skeleton v-if="loading" class="h-9 w-20" />
            <span v-else class="text-3xl font-bold tabular-nums">
              {{ stats?.draft_consultations ?? 0 }}
            </span>
          </div>
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-purple/10">
            <FileEdit class="size-5 text-stat-purple" />
          </div>
        </div>
      </div>

      <!-- Active Medicines -->
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-3">
            <span class="text-sm font-medium text-muted-foreground">Active Medicines</span>
            <Skeleton v-if="loading" class="h-9 w-20" />
            <span v-else class="text-3xl font-bold tabular-nums">
              {{ stats?.total_medicines ?? 0 }}
            </span>
          </div>
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stat-orange/10">
            <Pill class="size-5 text-stat-orange" />
          </div>
        </div>
      </div>
    </div>

    <!-- Charts placeholder -->
    <div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-muted">
        <BarChart3 class="size-6 text-muted-foreground" />
      </div>
      <div>
        <p class="text-sm font-medium text-foreground">Charts and analytics coming soon</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Visit trends, revenue summaries, and more will appear here.
        </p>
      </div>
    </div>
  </div>
</template>
