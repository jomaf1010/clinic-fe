<script setup lang="ts">
import { computed } from 'vue'
import {
  CalendarCheck,
  Clock,
  FileText,
  LogIn,
  Stethoscope,
  User,
  UserX,
  X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import AppointmentStatusBadge from './AppointmentStatusBadge.vue'
import type { AppointmentResponse } from '../types/appointment.types'

const props = defineProps<{
  appointment: AppointmentResponse | null
  open: boolean
  canManage: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'check-in': [id: string]
  cancel: [id: string]
  'no-show': [id: string]
}>()

const isScheduled = computed(() => props.appointment?.status === 'scheduled')

const relativeTime = computed(() => {
  if (!props.appointment) return null
  const now = Date.now()
  const scheduled = new Date(props.appointment.scheduled_at).getTime()
  const diffMs = scheduled - now

  if (['cancelled', 'completed', 'no_show'].includes(props.appointment.status)) return null

  const absDiff = Math.abs(diffMs)
  const isPast = diffMs < 0
  const minutes = Math.floor(absDiff / 60000)
  const hours = Math.floor(absDiff / 3600000)
  const days = Math.floor(absDiff / 86400000)

  let label: string
  if (minutes < 1) label = 'now'
  else if (minutes < 60) label = `${minutes}m`
  else if (hours < 24) label = `${hours}h`
  else if (days < 30) label = `${days}d`
  else label = `${Math.floor(days / 30)}mo`

  if (label === 'now') return 'now'
  return isPast ? `${label} ago` : `in ${label}`
})

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const endTimeIso = computed(() => {
  if (!props.appointment) return null
  const start = new Date(props.appointment.scheduled_at).getTime()
  return new Date(start + props.appointment.duration * 60000).toISOString()
})

const durationLabel = computed(() => {
  if (!props.appointment) return ''
  const min = props.appointment.duration
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }
  return `${min}m`
})
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md" @close-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <CalendarCheck class="size-5 text-primary" />
          Appointment Details
        </DialogTitle>
      </DialogHeader>

      <div v-if="appointment" class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <AppointmentStatusBadge :status="appointment.status" />
        </div>

        <Separator />

        <div class="grid gap-3 text-sm">
          <div class="flex items-start gap-2">
            <User class="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Patient</p>
              <p class="font-medium">{{ appointment.patient_name ?? '—' }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <Stethoscope class="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Doctor</p>
              <p class="font-medium">{{ appointment.doctor_name ?? '—' }}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <Clock class="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Scheduled</p>
              <p class="font-medium">
                {{ formatTime(appointment.scheduled_at) }} — {{ endTimeIso ? formatTime(endTimeIso) : '—' }}
                <span class="text-xs text-muted-foreground">({{ durationLabel }})</span>
                <span v-if="relativeTime" class="text-xs font-medium text-primary">&middot; {{ relativeTime }}</span>
              </p>
              <p class="text-xs text-muted-foreground">{{ formatDateTime(appointment.scheduled_at) }}</p>
            </div>
          </div>
          <div v-if="appointment.reason" class="flex items-start gap-2">
            <FileText class="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Reason</p>
              <p>{{ appointment.reason }}</p>
            </div>
          </div>
          <div v-if="appointment.notes" class="flex items-start gap-2">
            <FileText class="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Notes</p>
              <p>{{ appointment.notes }}</p>
            </div>
          </div>
          <div v-if="appointment.checked_in_at" class="flex items-start gap-2">
            <LogIn class="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <p class="text-xs text-muted-foreground">Checked In</p>
              <p>{{ formatDateTime(appointment.checked_in_at) }}</p>
            </div>
          </div>
          <div v-if="appointment.cancellation_reason" class="flex items-start gap-2">
            <X class="mt-0.5 size-3.5 text-destructive" />
            <div>
              <p class="text-xs text-muted-foreground">Cancellation Reason</p>
              <p>{{ appointment.cancellation_reason }}</p>
            </div>
          </div>
        </div>

        <template v-if="isScheduled && canManage">
          <Separator />
          <div class="flex flex-col gap-2">
            <Button class="w-full" @click="emit('check-in', appointment!.id)">
              <LogIn class="size-4" />
              Check In Patient
            </Button>
            <div class="flex gap-2">
              <Button variant="outline" class="flex-1" @click="emit('no-show', appointment!.id)">
                <UserX class="size-4" />
                No Show
              </Button>
              <Button variant="destructive" class="flex-1" @click="emit('cancel', appointment!.id)">
                <X class="size-4" />
                Cancel
              </Button>
            </div>
          </div>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
