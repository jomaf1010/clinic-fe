<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, Check, ClipboardList, Clock, Phone, Stethoscope, X } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RouteNames } from '@/router/routeNames'
import QueueStatusBadge from './QueueStatusBadge.vue'
import type { QueueVisitResponse } from '../types/queue.types'

const props = defineProps<{
  visit: QueueVisitResponse
  canManage?: boolean
  canCall?: boolean
  currentUserId?: string
}>()

const canActOnVisit = computed(() =>
  props.canManage || (props.canCall && !!props.currentUserId && props.visit.doctor_id === props.currentUserId),
)

const emit = defineEmits<{
  call: [id: string]
  complete: [id: string]
  cancel: [id: string]
}>()

const router = useRouter()

const waitTime = computed(() => {
  const checkedIn = new Date(props.visit.checked_in_at)
  const now = props.visit.completed_at ? new Date(props.visit.completed_at) : new Date()
  const diffMs = now.getTime() - checkedIn.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}m`
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  return `${hours}h ${mins}m`
})

const isWaiting = computed(() => props.visit.status === 'waiting')
const isInProgress = computed(() => props.visit.status === 'in_progress')
const hasConsultation = computed(() => !!props.visit.consultation_id)
const typeLabel = computed(() => (props.visit.type === 'walk_in' ? 'Walk-in' : 'Appointment'))

const isCarryover = computed(() => {
  const checkedIn = new Date(props.visit.checked_in_at)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return checkedIn < todayStart && (isWaiting.value || isInProgress.value)
})

const carryoverDate = computed(() => {
  if (!isCarryover.value) return ''
  return new Date(props.visit.checked_in_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
})

function openConsultation() {
  if (!props.visit.consultation_id) return
  router.push({
    name: RouteNames.CONSULTATION_DETAIL,
    params: {
      patientId: props.visit.patient_id,
      id: props.visit.consultation_id,
    },
  })
}
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    :class="isCarryover ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30' : ''"
  >
    <!-- Position badge + patient info -->
    <div class="flex min-w-0 items-center gap-3">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold"
      >
        #{{ visit.position }}
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <p class="truncate text-sm font-medium">{{ visit.patient_name ?? 'Unknown' }}</p>
          <Badge variant="outline" class="shrink-0 text-[10px]">{{ typeLabel }}</Badge>
          <Badge
            v-if="isCarryover"
            variant="outline"
            class="shrink-0 gap-1 border-amber-300 bg-amber-100 text-[10px] text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
          >
            <AlertTriangle class="size-2.5" />
            From {{ carryoverDate }}
          </Badge>
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span v-if="visit.doctor_name" class="flex items-center gap-1">
            <Stethoscope class="size-3" />
            Dr. {{ visit.doctor_name }}
          </span>
          <span class="flex items-center gap-1">
            <Clock class="size-3" />
            {{ waitTime }}
          </span>
          <span v-if="visit.reason" class="max-w-40 truncate">{{ visit.reason }}</span>
        </div>
      </div>
    </div>

    <!-- Status + action buttons -->
    <div class="flex shrink-0 items-center gap-2">
      <QueueStatusBadge :status="visit.status" />
      <Button
        v-if="hasConsultation && (isWaiting || isInProgress)"
        variant="outline"
        size="sm"
        class="h-7 text-xs"
        @click="openConsultation"
      >
        <ClipboardList class="size-3" />
        Consultation
      </Button>
      <Button v-if="isWaiting && canActOnVisit" size="sm" class="h-7 text-xs" @click="emit('call', visit.id)">
        <Phone class="size-3" />
        Call
      </Button>
      <Button
        v-if="isInProgress && canActOnVisit"
        variant="outline"
        size="sm"
        class="h-7 text-xs"
        @click="emit('complete', visit.id)"
      >
        <Check class="size-3" />
        Complete
      </Button>
      <Button
        v-if="(isWaiting || isInProgress) && canManage"
        variant="ghost"
        size="sm"
        class="h-7 text-xs text-destructive"
        @click="emit('cancel', visit.id)"
      >
        <X class="size-3" />
      </Button>
    </div>
  </div>
</template>
