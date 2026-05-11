<script setup lang="ts">
import { computed } from 'vue'
import { CalendarCheck, Clock, LogIn, MoreHorizontal, UserX, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import AppointmentStatusBadge from './AppointmentStatusBadge.vue'
import type { AppointmentResponse } from '../types/appointment.types'

const props = defineProps<{
  appointment: AppointmentResponse
  canManage: boolean
}>()

const emit = defineEmits<{
  'check-in': [id: string]
  cancel: [id: string]
  'no-show': [id: string]
  click: [id: string]
}>()

const isScheduled = computed(() => props.appointment.status === 'scheduled')

const formattedTime = computed(() => {
  const d = new Date(props.appointment.scheduled_at)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
})

const formattedDate = computed(() => {
  const d = new Date(props.appointment.scheduled_at)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

const relativeTime = computed(() => {
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
</script>

<template>
  <div
    class="appointment-list-card surface-card surface-interactive flex cursor-pointer flex-col gap-3 rounded-2xl p-4 transition-all hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between"
    @click="emit('click', appointment.id)"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class="appointment-list-icon flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
        <CalendarCheck class="size-4 text-primary" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium">{{ appointment.patient_name ?? 'Unknown Patient' }}</p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <Clock class="size-3" />
            {{ formattedDate }} at {{ formattedTime }}
          </span>
          <span v-if="relativeTime" class="text-primary font-medium">&middot; {{ relativeTime }}</span>
          <span v-if="appointment.doctor_name">Dr. {{ appointment.doctor_name }}</span>
          <span v-if="appointment.reason" class="max-w-40 truncate">{{ appointment.reason }}</span>
        </div>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <AppointmentStatusBadge :status="appointment.status" />
      <template v-if="isScheduled && canManage">
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs"
          @click.stop="emit('check-in', appointment.id)"
        >
          <LogIn class="size-3" />
          Check In
        </Button>
        <TooltipProvider :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 text-muted-foreground"
                @click.stop="emit('no-show', appointment.id)"
              >
                <UserX class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as no-show</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <!-- Actions dropdown -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              @click.stop
            >
              <MoreHorizontal class="size-4" />
              <span class="sr-only">Appointment actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" @click.stop>
            <DropdownMenuItem @click="emit('check-in', appointment.id)">
              <LogIn class="mr-2 size-4" />
              Check In
            </DropdownMenuItem>
            <DropdownMenuItem @click="emit('no-show', appointment.id)">
              <UserX class="mr-2 size-4" />
              Mark No-Show
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              @click="emit('cancel', appointment.id)"
            >
              <X class="mr-2 size-4" />
              Cancel Appointment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
    </div>
  </div>
</template>

<style scoped>
.appointment-list-card {
  position: relative;
  border: 0;
  background:
    radial-gradient(circle at 18% 0%, rgb(59 130 246 / 0.08), transparent 32%),
    radial-gradient(circle at 82% 18%, rgb(20 184 166 / 0.08), transparent 30%),
    var(--surface-panel-strong);
}

.appointment-list-card:hover {
  box-shadow: var(--surface-shadow-strong);
}

.appointment-list-icon {
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.08);
}

:global(.dark .appointment-list-card) {
  background:
    radial-gradient(circle at 86% 88%, rgb(20 184 166 / 0.12), transparent 34%),
    radial-gradient(circle at 18% 10%, rgb(59 130 246 / 0.12), transparent 30%),
    linear-gradient(135deg, rgb(15 23 42 / 0.58), rgb(15 23 42 / 0.28) 54%, rgb(15 23 42 / 0.42)),
    rgb(15 23 42 / 0.12);
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 1px 0 0 rgb(255 255 255 / 0.035),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .appointment-list-card:hover) {
  background:
    linear-gradient(90deg, rgb(59 130 246 / 0.12), rgb(20 184 166 / 0.08)),
    rgb(15 23 42 / 0.38);
  box-shadow:
    inset 3px 0 0 rgb(56 189 248 / 0.42),
    inset 0 1px 0 rgb(255 255 255 / 0.04),
    inset 0 -1px 0 rgb(255 255 255 / 0.04),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .appointment-list-icon) {
  border: 1px solid rgb(148 163 184 / 0.14);
  background: rgb(15 23 42 / 0.58);
  box-shadow: 0 14px 34px rgb(0 0 0 / 0.24);
}
</style>
