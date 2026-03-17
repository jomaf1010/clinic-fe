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
    class="flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
    @click="emit('click', appointment.id)"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
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
