<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertTriangle,
  Check,
  ClipboardList,
  Clock,
  Hourglass,
  Phone,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Stethoscope,
  X,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RouteNames } from '@/router/routeNames'
import PatientAvatar from '@/components/PatientAvatar.vue'
import type { QueueVisitResponse, QueueVisitStatus } from '../types/queue.types'

const props = defineProps<{
  visits: QueueVisitResponse[]
  canManage?: boolean
  canCall?: boolean
  currentUserId?: string
}>()

const emit = defineEmits<{
  call: [id: string]
  complete: [id: string]
  cancel: [id: string]
}>()

const router = useRouter()

interface Column {
  status: QueueVisitStatus
  label: string
  icon: typeof Hourglass
  headerClass: string
  dotClass: string
}

const columns: Column[] = [
  {
    status: 'waiting',
    label: 'Waiting',
    icon: Hourglass,
    headerClass: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    icon: PlayCircle,
    headerClass: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    dotClass: 'bg-blue-500',
  },
  {
    status: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    headerClass: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
    dotClass: 'bg-green-500',
  },
  {
    status: 'cancelled',
    label: 'Cancelled',
    icon: XCircle,
    headerClass: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
    dotClass: 'bg-gray-400',
  },
]

function visitsByStatus(status: QueueVisitStatus): QueueVisitResponse[] {
  return props.visits.filter((v) => v.status === status)
}

function waitTime(visit: QueueVisitResponse): string {
  const checkedIn = new Date(visit.checked_in_at)
  const now = visit.completed_at ? new Date(visit.completed_at) : new Date()
  const diffMin = Math.floor((now.getTime() - checkedIn.getTime()) / 60000)
  if (diffMin < 60) return `${diffMin}m`
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  return `${hours}h ${mins}m`
}

function typeLabel(visit: QueueVisitResponse): string {
  return visit.type === 'walk_in' ? 'Walk-in' : 'Appt'
}

function isCarryover(visit: QueueVisitResponse): boolean {
  const checkedIn = new Date(visit.checked_in_at)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return checkedIn < todayStart && ['waiting', 'in_progress'].includes(visit.status)
}

function carryoverDate(visit: QueueVisitResponse): string {
  return new Date(visit.checked_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function canActOnVisit(visit: QueueVisitResponse): boolean {
  return !!props.canManage || (!!props.canCall && !!props.currentUserId && visit.doctor_id === props.currentUserId)
}

function openConsultation(visit: QueueVisitResponse) {
  if (!visit.encounter_id) return
  router.push({
    name: RouteNames.ENCOUNTER_DETAIL,
    params: { patientId: visit.patient_id, id: visit.encounter_id },
  })
}
</script>

<template>
  <div class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4">
    <div
      v-for="col in columns"
      :key="col.status"
      class="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
    >
      <!-- Column header -->
      <div
        :class="['flex items-center justify-between rounded-t-lg border-b px-3 py-2.5', col.headerClass]"
      >
        <div class="flex items-center gap-2">
          <div :class="['size-2 rounded-full', col.dotClass]" />
          <span class="text-sm font-semibold">{{ col.label }}</span>
        </div>
        <Badge variant="secondary" class="h-5 min-w-5 justify-center px-1.5 text-[10px] font-bold">
          {{ visitsByStatus(col.status).length }}
        </Badge>
      </div>

      <!-- Cards -->
      <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style="max-height: 65vh;">
        <div
          v-for="visit in visitsByStatus(col.status)"
          :key="visit.id"
          :class="[
            'rounded-md border bg-background p-3 shadow-sm',
            isCarryover(visit) ? 'border-amber-300 dark:border-amber-700' : '',
          ]"
        >
          <!-- Position + patient -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                #{{ visit.position }}
              </span>
              <PatientAvatar
                :avatar-url="visit.patient_avatar_url"
                :sex="visit.patient_sex"
                :name="visit.patient_name"
                class="size-7 shrink-0"
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium leading-tight">{{ visit.patient_name ?? 'Unknown' }}</p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Badge
                v-if="isCarryover(visit)"
                variant="outline"
                class="gap-0.5 border-amber-300 bg-amber-100 px-1 py-0 text-[9px] text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
              >
                <AlertTriangle class="size-2" />
                {{ carryoverDate(visit) }}
              </Badge>
              <Badge variant="outline" class="shrink-0 text-[9px] px-1 py-0">{{ typeLabel(visit) }}</Badge>
            </div>
          </div>

          <!-- Details -->
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span v-if="visit.doctor_name" class="flex items-center gap-1">
              <Stethoscope class="size-3" />
              Dr. {{ visit.doctor_name }}
            </span>
            <span class="flex items-center gap-1">
              <Clock class="size-3" />
              {{ waitTime(visit) }}
            </span>
          </div>
          <p v-if="visit.reason" class="mt-1 truncate text-[11px] text-muted-foreground">
            {{ visit.reason }}
          </p>

          <!-- Actions -->
          <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Button
              v-if="visit.encounter_id && (visit.status === 'waiting' || visit.status === 'in_progress')"
              variant="outline"
              size="sm"
              class="h-6 gap-1 px-2 text-[11px]"
              @click="openConsultation(visit)"
            >
              <ClipboardList class="size-3" />
              Consultation
            </Button>
            <Button
              v-if="visit.status === 'waiting' && canActOnVisit(visit)"
              size="sm"
              class="h-6 gap-1 px-2 text-[11px]"
              @click="emit('call', visit.id)"
            >
              <Phone class="size-3" />
              Call
            </Button>
            <Button
              v-if="visit.status === 'in_progress' && canActOnVisit(visit)"
              variant="outline"
              size="sm"
              class="h-6 gap-1 px-2 text-[11px]"
              @click="emit('complete', visit.id)"
            >
              <Check class="size-3" />
              Complete
            </Button>
            <Button
              v-if="(visit.status === 'waiting' || visit.status === 'in_progress') && canManage"
              variant="ghost"
              size="sm"
              class="h-6 px-1.5 text-destructive"
              @click="emit('cancel', visit.id)"
            >
              <X class="size-3" />
            </Button>
          </div>
        </div>

        <!-- Empty column -->
        <div
          v-if="visitsByStatus(col.status).length === 0"
          class="flex items-center justify-center py-8 text-xs text-muted-foreground"
        >
          No patients
        </div>
      </div>
    </div>
  </div>
</template>
