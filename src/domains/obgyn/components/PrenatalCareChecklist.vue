<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, Circle, AlertCircle, LoaderCircle, ClipboardList, Clock } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { obgynApi } from '../api/obgynApi'
import type { ChecklistItem } from '../types/obgyn.types'

const props = defineProps<{
  patientId: string
  pregnancyId: string
  disabled?: boolean
}>()

const items = ref<ChecklistItem[]>([])
const isLoading = ref(false)
const togglingKey = ref<string | null>(null)

// Confirmation dialog state
const pendingItem = ref<ChecklistItem | null>(null)
const showConfirm = ref(false)

onMounted(async () => {
  isLoading.value = true
  try {
    const res = await obgynApi.getChecklist(props.patientId, props.pregnancyId)
    items.value = res.data
  } catch {
    // silent
  } finally {
    isLoading.value = false
  }
})

// Group by ga_window
const grouped = computed(() => {
  const groups = new Map<string, ChecklistItem[]>()
  for (const item of items.value) {
    const key = item.ga_window
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  return Array.from(groups.entries()).map(([window, list]) => ({ window, items: list }))
})

const completedCount = computed(() => items.value.filter((i) => i.status === 'completed').length)
const totalCount = computed(() => items.value.length)

const isUnmarking = computed(() => pendingItem.value?.status === 'completed')

function requestToggle(item: ChecklistItem) {
  if (props.disabled) return
  // Only show confirmation dialog when unmarking (accidental removal protection)
  // Marking as done is a single tap — no friction
  if (item.status === 'completed') {
    pendingItem.value = item
    showConfirm.value = true
  } else {
    pendingItem.value = item
    confirmToggle()
  }
}

async function confirmToggle() {
  const item = pendingItem.value
  if (!item) return

  showConfirm.value = false
  const wasCompleted = item.status === 'completed'
  togglingKey.value = item.key

  try {
    const res = await obgynApi.toggleChecklistItem(props.patientId, props.pregnancyId, {
      key: item.key,
      completed: !wasCompleted,
    })
    items.value = res.data
    toast.success(wasCompleted ? `${item.name} unmarked` : `${item.name} marked as done`)
  } catch {
    toast.error('Failed to update checklist')
  } finally {
    togglingKey.value = null
    pendingItem.value = null
  }
}

function statusIcon(status: ChecklistItem['status']) {
  switch (status) {
    case 'completed': return CheckCircle2
    case 'overdue': return AlertCircle
    case 'due': return Circle
    case 'upcoming': return Clock
  }
}

function statusClass(status: ChecklistItem['status']): string {
  switch (status) {
    case 'completed': return 'text-green-500'
    case 'overdue': return 'text-red-500'
    case 'due': return 'text-amber-500'
    case 'upcoming': return 'text-muted-foreground/50'
  }
}

function typeLabel(type: ChecklistItem['type']): string {
  switch (type) {
    case 'lab': return 'Lab'
    case 'procedure': return 'Procedure'
    case 'treatment': return 'Treatment'
  }
}

function typeBadgeClass(type: ChecklistItem['type']): string {
  switch (type) {
    case 'lab': return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400'
    case 'procedure': return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400'
    case 'treatment': return 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400'
  }
}
</script>

<template>
  <Card>
    <CardHeader class="pb-2 pt-3">
      <div class="flex items-center justify-between">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList class="size-3.5 text-muted-foreground" />
          Prenatal Care Checklist
        </CardTitle>
        <span v-if="!isLoading && totalCount > 0" class="text-xs text-muted-foreground">
          {{ completedCount }}/{{ totalCount }}
        </span>
      </div>
    </CardHeader>
    <CardContent class="pb-4">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <LoaderCircle class="size-3.5 animate-spin" />
        Loading checklist...
      </div>

      <!-- Empty -->
      <div
        v-else-if="items.length === 0"
        class="flex flex-col items-center justify-center gap-1.5 py-8 text-center"
      >
        <ClipboardList class="size-8 text-muted-foreground/30" />
        <p class="text-sm text-muted-foreground">No checklist available</p>
      </div>

      <!-- Grouped checklist -->
      <div v-else class="flex flex-col gap-4">
        <div v-for="group in grouped" :key="group.window" class="flex flex-col gap-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ group.window }}
          </p>
          <div class="flex flex-col gap-0.5">
            <button
              v-for="item in group.items"
              :key="item.key"
              type="button"
              class="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors"
              :class="[
                item.status === 'overdue' ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-muted/40',
                disabled ? 'cursor-default' : 'cursor-pointer',
              ]"
              :disabled="disabled || togglingKey === item.key"
              @click="requestToggle(item)"
            >
              <LoaderCircle
                v-if="togglingKey === item.key"
                class="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground"
              />
              <component
                v-else
                :is="statusIcon(item.status)"
                class="mt-0.5 size-3.5 shrink-0"
                :class="statusClass(item.status)"
              />
              <div class="min-w-0 flex-1">
                <span
                  class="text-sm font-medium"
                  :class="item.status === 'completed' ? 'line-through text-muted-foreground' : ''"
                >
                  {{ item.name }}
                </span>
                <div class="flex items-center gap-2">
                  <Badge variant="outline" class="h-4 px-1 text-[9px]" :class="typeBadgeClass(item.type)">
                    {{ typeLabel(item.type) }}
                  </Badge>
                  <span v-if="item.completed_at" class="text-[10px] text-green-600 dark:text-green-400">
                    {{ new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                  </span>
                  <span v-if="item.notes" class="text-[10px] text-muted-foreground">
                    {{ item.notes }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </CardContent>

    <!-- Confirmation Dialog -->
    <AlertDialog :open="showConfirm" @update:open="showConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ isUnmarking ? 'Unmark as done?' : 'Mark as done?' }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="isUnmarking">
              This will unmark <span class="font-medium text-foreground">{{ pendingItem?.name }}</span> as incomplete.
            </template>
            <template v-else>
              This will mark <span class="font-medium text-foreground">{{ pendingItem?.name }}</span> as completed today.
            </template>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="pendingItem = null">Cancel</AlertDialogCancel>
          <AlertDialogAction
            :class="isUnmarking ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''"
            @click="confirmToggle"
          >
            {{ isUnmarking ? 'Unmark' : 'Confirm' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>
</template>
