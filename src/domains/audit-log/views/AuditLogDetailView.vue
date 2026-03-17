<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LoaderCircle, Plus, Pencil, Trash2, User, Globe, LogIn, ScrollText } from 'lucide-vue-next'
import { auditLogApi } from '../api/auditLogApi'
import type { AuditLogResponse } from '../types/auditLog.types'

const route = useRoute()
const log = ref<AuditLogResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

const actionConfig: Record<string, { icon: typeof Plus; bg: string; text: string; label: string }> = {
  created: { icon: Plus, bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Created' },
  updated: { icon: Pencil, bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Updated' },
  deleted: { icon: Trash2, bg: 'bg-red-500/10', text: 'text-red-600', label: 'Deleted' },
  login_success: { icon: LogIn, bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Login Success' },
}

const defaultActionConfig = { icon: ScrollText, bg: 'bg-muted', text: 'text-muted-foreground', label: 'Unknown' }

function getActionConfig(action: string) {
  return actionConfig[action] ?? defaultActionConfig
}

async function fetchLog() {
  isLoading.value = true
  error.value = null

  try {
    const response = await auditLogApi.get(route.params.id as string)
    log.value = response.data

  } catch {
    error.value = 'Failed to load audit log details. Please try again.'
  } finally {
    isLoading.value = false
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

onMounted(() => {
  fetchLog()
})
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-6">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="error"
      role="alert"
      class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div v-else-if="log" class="flex flex-col gap-4">
      <!-- Header -->
      <Card>
        <CardHeader class="text-center">
          <div
            class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full"
            :class="[getActionConfig(log.action).bg]"
          >
            <component
              :is="getActionConfig(log.action).icon"
              class="size-6"
              :class="[getActionConfig(log.action).text]"
            />
          </div>
          <CardTitle class="text-xl">{{ log.entity_label }}</CardTitle>
          <p class="text-sm text-muted-foreground">
            {{ getActionConfig(log.action).label }} · {{ log.entity_type }} · {{ formatDate(log.created_at) }}
          </p>
        </CardHeader>
      </Card>

      <!-- Performed by -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <User class="size-4 text-muted-foreground" />
            <CardTitle class="text-base">Performed by</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-foreground">Name</dt>
            <dd>{{ log.user_name }}</dd>
            <dt class="text-muted-foreground">Email</dt>
            <dd>{{ log.user_email }}</dd>
            <template v-if="log.ip_address">
              <dt class="text-muted-foreground">IP Address</dt>
              <dd class="flex items-center gap-1.5">
                <Globe class="size-3.5 text-muted-foreground" />
                {{ log.ip_address }}
              </dd>
            </template>
          </dl>
        </CardContent>
      </Card>

      <!-- Changes diff (for updates) -->
      <Card v-if="log.action === 'updated' && log.old_values && log.new_values">
        <CardHeader>
          <div class="flex items-center gap-2">
            <Pencil class="size-4 text-muted-foreground" />
            <CardTitle class="text-base">Changes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left">
                  <th class="pb-2 pr-4 font-medium text-muted-foreground">Field</th>
                  <th class="pb-2 pr-4 font-medium text-muted-foreground">Old Value</th>
                  <th class="pb-2 font-medium text-muted-foreground">New Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="field in log.changed_fields" :key="field" class="border-b last:border-0">
                  <td class="py-2 pr-4 font-medium">{{ field }}</td>
                  <td class="py-2 pr-4 text-red-600">{{ formatValue(log.old_values[field]) }}</td>
                  <td class="py-2 text-emerald-600">{{ formatValue(log.new_values[field]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- Created values -->
      <Card v-if="log.action === 'created' && log.new_values">
        <CardHeader>
          <div class="flex items-center gap-2">
            <Plus class="size-4 text-muted-foreground" />
            <CardTitle class="text-base">Created Values</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <template v-for="(value, key) in log.new_values" :key="key">
              <dt class="text-muted-foreground">{{ key }}</dt>
              <dd>{{ formatValue(value) }}</dd>
            </template>
          </dl>
        </CardContent>
      </Card>

      <!-- Deleted snapshot -->
      <Card v-if="log.action === 'deleted' && log.old_values">
        <CardHeader>
          <div class="flex items-center gap-2">
            <Trash2 class="size-4 text-muted-foreground" />
            <CardTitle class="text-base">Deleted Snapshot</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <template v-for="(value, key) in log.old_values" :key="key">
              <dt class="text-muted-foreground">{{ key }}</dt>
              <dd>{{ formatValue(value) }}</dd>
            </template>
          </dl>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
