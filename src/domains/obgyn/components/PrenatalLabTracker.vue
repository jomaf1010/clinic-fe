<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, Circle, Clock, AlertCircle, LoaderCircle, FlaskConical } from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { obgynApi } from '../api/obgynApi'
import type { LabsDueItem } from '../types/obgyn.types'

const props = defineProps<{
  patientId: string
  pregnancyId: string
}>()

const labs = ref<LabsDueItem[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

onMounted(async () => {
  isLoading.value = true
  loadError.value = null
  try {
    const res = await obgynApi.getLabsDue(props.patientId, props.pregnancyId)
    labs.value = res.data
  } catch {
    loadError.value = 'Failed to load lab schedule.'
  } finally {
    isLoading.value = false
  }
})

// Group labs by trimester label
const groupedLabs = computed(() => {
  const groups = new Map<string, LabsDueItem[]>()
  for (const lab of labs.value) {
    const key = lab.trimester
    const list = groups.get(key) ?? []
    list.push(lab)
    groups.set(key, list)
  }
  return Array.from(groups.entries()).map(([trimester, items]) => ({ trimester, items }))
})

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusConfig(status: LabsDueItem['status']): {
  icon: typeof CheckCircle2
  label: string
  iconClass: string
  rowClass: string
} {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        label: 'Completed',
        iconClass: 'text-green-500',
        rowClass: 'opacity-70',
      }
    case 'ordered':
      return {
        icon: Clock,
        label: 'Ordered',
        iconClass: 'text-amber-500',
        rowClass: '',
      }
    case 'overdue':
      return {
        icon: AlertCircle,
        label: 'Overdue',
        iconClass: 'text-red-500',
        rowClass: 'border-l-2 border-l-red-400 pl-2',
      }
    case 'due':
    default:
      return {
        icon: Circle,
        label: 'Due',
        iconClass: 'text-yellow-500',
        rowClass: '',
      }
  }
}
</script>

<template>
  <Card>
    <CardHeader class="pb-2 pt-3">
      <CardTitle class="flex items-center gap-2 text-sm font-semibold">
        <FlaskConical class="size-3.5 text-muted-foreground" />
        Lab Schedule
      </CardTitle>
    </CardHeader>
    <CardContent class="pb-4">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <LoaderCircle class="size-3.5 animate-spin" />
        Loading lab schedule...
      </div>

      <!-- Error -->
      <div
        v-else-if="loadError"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ loadError }}
      </div>

      <!-- Empty -->
      <div
        v-else-if="labs.length === 0"
        class="flex flex-col items-center justify-center gap-1.5 py-8 text-center"
      >
        <FlaskConical class="size-8 text-muted-foreground/30" />
        <p class="text-sm text-muted-foreground">No lab schedule available</p>
      </div>

      <!-- Lab groups -->
      <div v-else class="flex flex-col gap-4">
        <div
          v-for="group in groupedLabs"
          :key="group.trimester"
          class="flex flex-col gap-1.5"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ group.trimester }}
          </p>
          <div class="flex flex-col gap-1">
            <div
              v-for="lab in group.items"
              :key="lab.key"
              class="flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors"
              :class="[
                statusConfig(lab.status).rowClass,
                lab.status === 'overdue' ? 'bg-red-50/50 dark:bg-red-950/20' : 'hover:bg-muted/40',
              ]"
            >
              <component
                :is="statusConfig(lab.status).icon"
                class="mt-0.5 size-3.5 shrink-0"
                :class="statusConfig(lab.status).iconClass"
              />
              <div class="min-w-0 flex-1">
                <span class="text-sm font-medium" :class="lab.status === 'completed' ? 'line-through text-muted-foreground' : ''">
                  {{ lab.name }}
                </span>
                <div class="flex flex-wrap gap-x-3 gap-y-0.5">
                  <span v-if="lab.due_at_weeks !== null" class="text-xs text-muted-foreground">
                    Due at {{ lab.due_at_weeks }}w
                  </span>
                  <span v-if="lab.completed_date" class="text-xs text-green-600 dark:text-green-400">
                    Done {{ formatDate(lab.completed_date) }}
                  </span>
                  <span v-else-if="lab.ordered_date" class="text-xs text-amber-600 dark:text-amber-400">
                    Ordered {{ formatDate(lab.ordered_date) }}
                  </span>
                  <span v-if="lab.result" class="text-xs text-muted-foreground">
                    · {{ lab.result }}
                  </span>
                </div>
              </div>
              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                :class="{
                  'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400': lab.status === 'completed',
                  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400': lab.status === 'ordered',
                  'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400': lab.status === 'overdue',
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400': lab.status === 'due',
                }"
              >
                {{ statusConfig(lab.status).label }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
