<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  ScrollText,
  LoaderCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  LogIn,
} from 'lucide-vue-next'
import { auditLogApi } from '../api/auditLogApi'
import { RouteNames } from '@/router/routeNames'
import { formatRelativeTime } from '@/lib/utils'
import type { AuditLogResponse } from '../types/auditLog.types'

const router = useRouter()
const route = useRoute()

const logs = ref<AuditLogResponse[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const pagination = ref({
  page: 1,
  per_page: 15,
  total: 0,
  last_page: 1,
})

const currentPage = ref(Number(route.query.page) || 1)

async function fetchLogs(page: number) {
  isLoading.value = true
  error.value = null

  try {
    const response = await auditLogApi.list(page, 15)
    logs.value = response.data
    pagination.value = response.meta.pagination
  } catch {
    error.value = 'Failed to load audit logs. Please try again.'
  } finally {
    isLoading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > pagination.value.last_page) return
  currentPage.value = page
  router.replace({ query: { page: String(page) } })
}

const actionConfig: Record<string, { icon: typeof Plus; bg: string; text: string }> = {
  created: { icon: Plus, bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  updated: { icon: Pencil, bg: 'bg-amber-500/10', text: 'text-amber-600' },
  deleted: { icon: Trash2, bg: 'bg-red-500/10', text: 'text-red-600' },
  login_success: { icon: LogIn, bg: 'bg-blue-500/10', text: 'text-blue-600' },
}

const defaultActionConfig = { icon: ScrollText, bg: 'bg-muted', text: 'text-muted-foreground' }

function getActionConfig(action: string) {
  return actionConfig[action] ?? defaultActionConfig
}

watch(currentPage, (page) => {
  fetchLogs(page)
})

onMounted(() => {
  fetchLogs(currentPage.value)
})
</script>

<template>
  <div class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
    <!-- Left panel -->
    <div class="flex shrink-0 flex-col gap-4 border-b p-4 md:w-64 md:gap-6 md:border-b-0 md:border-r md:p-6">
      <div class="flex items-center gap-3 md:block">
        <div class="flex size-10 items-center justify-center rounded-full bg-primary/10 md:mb-3">
          <ScrollText class="size-5 text-primary" />
        </div>
        <div>
          <h1 class="text-lg font-semibold">Activity Logs</h1>
          <p class="text-sm text-muted-foreground">
            {{ pagination.total }} log entr{{ pagination.total !== 1 ? 'ies' : 'y' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <div class="flex flex-1 flex-col overflow-y-auto p-4 md:p-8">
      <div v-if="isLoading" class="flex flex-1 items-center justify-center py-12">
        <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        {{ error }}
        <Button variant="outline" size="sm" class="mt-2" @click="fetchLogs(currentPage)">Try again</Button>
      </div>

      <div v-else-if="logs.length === 0" class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground">
        <ScrollText class="size-10 mb-3 opacity-50" />
        <p>No activity logs yet.</p>
      </div>

      <template v-else>
        <div class="flex flex-col divide-y">
          <button
            v-for="log in logs"
            :key="log.id"
            class="flex items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/50"
            @click="router.push({ name: RouteNames.AUDIT_LOG_DETAIL, params: { id: log.id } })"
          >
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-full"
              :class="[getActionConfig(log.action).bg]"
            >
              <component
                :is="getActionConfig(log.action).icon"
                class="size-4"
                :class="[getActionConfig(log.action).text]"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate font-medium">{{ log.entity_label }}</p>
                <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {{ log.entity_type }}
                </span>
              </div>
              <p class="truncate text-sm text-muted-foreground">
                {{ log.action }} by {{ log.user_name }} · {{ formatRelativeTime(log.created_at) }}
              </p>
            </div>
            <ChevronRight class="ml-2 size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>

        <div v-if="pagination.last_page > 1" class="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            <ChevronLeft class="size-4" />
            Previous
          </Button>
          <span class="px-3 text-sm text-muted-foreground">
            Page {{ currentPage }} of {{ pagination.last_page }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage >= pagination.last_page"
            @click="goToPage(currentPage + 1)"
          >
            Next
            <ChevronRight class="size-4" />
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
