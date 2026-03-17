<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventInput, DatesSetArg } from '@fullcalendar/core'
import type { CalendarBlock, WorkingSchedule } from '../types/schedule.types'
import type { AppointmentResponse } from '@/domains/appointment/types/appointment.types'

const APPOINTMENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  scheduled: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  checked_in: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  completed: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  cancelled: { bg: '#f3f4f6', border: '#9ca3af', text: '#6b7280' },
  no_show: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
}

const BLOCK_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  leave: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  meeting: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  holiday: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  personal: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  unavailable: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
}

const BREAK_COLOR = { bg: '#fff7ed', border: '#fb923c', text: '#9a3412' }
const WORKING_HOURS_COLOR = { bg: '#f0fdf4', border: '#86efac', text: '#166534' }

const props = defineProps<{
  schedule: WorkingSchedule | null
  blocks: CalendarBlock[]
  appointments: AppointmentResponse[]
  isLoading: boolean
}>()

const emit = defineEmits<{
  'date-range-change': [start: string, end: string]
  'block-click': [block: CalendarBlock]
}>()

const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)

// Build FullCalendar events from schedule + blocks
const calendarEvents = computed<EventInput[]>(() => {
  const events: EventInput[] = []

  // Working hours as recurring background events
  if (props.schedule) {
    for (const day of props.schedule.days) {
      if (!day.enabled) continue

      // FullCalendar daysOfWeek: 0=Sunday..6=Saturday (matches our data)
      events.push({
        id: `working-${day.day}`,
        title: 'Working Hours',
        daysOfWeek: [day.day],
        startTime: day.start_time,
        endTime: day.end_time,
        display: 'background',
        backgroundColor: WORKING_HOURS_COLOR.bg,
        borderColor: WORKING_HOURS_COLOR.border,
      })

      // Breaks as foreground events
      for (const brk of day.breaks) {
        events.push({
          id: `break-${day.day}-${brk.start_time}`,
          title: brk.label || 'Break',
          daysOfWeek: [day.day],
          startTime: brk.start_time,
          endTime: brk.end_time,
          backgroundColor: BREAK_COLOR.bg,
          borderColor: BREAK_COLOR.border,
          textColor: BREAK_COLOR.text,
          extendedProps: { type: 'break' },
        })
      }
    }
  }

  // Calendar blocks as concrete events
  for (const block of props.blocks) {
    const colors = BLOCK_TYPE_COLORS[block.type] ?? BLOCK_TYPE_COLORS.unavailable
    const tz = props.schedule?.timezone ?? 'Asia/Manila'

    if (block.recurring && !block.all_day) {
      // Recurring: create one event per day with the time portion
      const startLocal = new Date(block.start)
      const endLocal = new Date(block.end)
      const startTimeStr = startLocal.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
      const endTimeStr = endLocal.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })

      // Iterate each day in the range
      const startDate = new Date(startLocal.toLocaleDateString('en-CA', { timeZone: tz }))
      const endDate = new Date(endLocal.toLocaleDateString('en-CA', { timeZone: tz }))
      const current = new Date(startDate)

      while (current <= endDate) {
        const dateStr = current.toISOString().slice(0, 10)
        events.push({
          id: `block-${block.id}-${dateStr}`,
          title: block.title,
          start: `${dateStr}T${startTimeStr}`,
          end: `${dateStr}T${endTimeStr}`,
          allDay: false,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: { type: 'block', blockId: block.id },
        })
        current.setDate(current.getDate() + 1)
      }
    } else {
      // Span or all-day: single continuous event
      events.push({
        id: `block-${block.id}`,
        title: block.title,
        start: block.start,
        end: block.end,
        allDay: block.all_day,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        extendedProps: { type: 'block', blockId: block.id },
      })
    }
  }

  // Appointments as foreground events
  for (const appt of props.appointments) {
    const colors = APPOINTMENT_COLORS[appt.status] ?? APPOINTMENT_COLORS.scheduled
    const startDate = new Date(appt.scheduled_at)
    const endDate = new Date(startDate.getTime() + appt.duration * 60000)

    const statusLabel = appt.status === 'checked_in' ? 'Checked In'
      : appt.status === 'no_show' ? 'No Show'
      : appt.status.charAt(0).toUpperCase() + appt.status.slice(1)

    events.push({
      id: `appt-${appt.id}`,
      title: `${appt.patient_name ?? 'Patient'} — ${statusLabel}`,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: false,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: { type: 'appointment', appointmentId: appt.id },
    })
  }

  return events
})

// Build businessHours from schedule
const businessHours = computed(() => {
  if (!props.schedule) return false
  return props.schedule.days
    .filter((d) => d.enabled)
    .map((d) => ({
      daysOfWeek: [d.day],
      startTime: d.start_time,
      endTime: d.end_time,
    }))
})

function handleDatesSet(info: DatesSetArg) {
  const start = info.startStr.slice(0, 10)
  const end = info.endStr.slice(0, 10)
  emit('date-range-change', start, end)
}

function goToDate(dateStr: string) {
  const api = calendarRef.value?.getApi()
  if (api) {
    api.gotoDate(dateStr)
  }
}

defineExpose({ goToDate })

function handleEventClick(info: { event: { extendedProps: Record<string, unknown> } }) {
  if (info.event.extendedProps.type === 'block') {
    const blockId = info.event.extendedProps.blockId as string
    const block = props.blocks.find((b) => b.id === blockId)
    if (block) emit('block-click', block)
  }
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridDay',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay',
  },
  events: calendarEvents.value,
  businessHours: businessHours.value,
  nowIndicator: true,
  editable: false,
  selectable: false,
  slotMinTime: '06:00:00',
  slotMaxTime: '22:00:00',
  slotDuration: props.schedule ? `00:${String(props.schedule.slot_duration).padStart(2, '0')}:00` : '00:30:00',
  allDaySlot: true,
  weekends: true,
  dayMaxEvents: true,
  height: 'auto',
  datesSet: handleDatesSet,
  eventClick: handleEventClick,
  eventDisplay: 'block',
}))
</script>

<template>
  <div class="schedule-calendar">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
    <div v-else>
      <!-- Legend -->
      <div class="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: WORKING_HOURS_COLOR.bg, borderColor: WORKING_HOURS_COLOR.border }" />
          Working Hours
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: BREAK_COLOR.bg, borderColor: BREAK_COLOR.border }" />
          Break
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: BLOCK_TYPE_COLORS.leave.bg, borderColor: BLOCK_TYPE_COLORS.leave.border }" />
          Leave
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: BLOCK_TYPE_COLORS.meeting.bg, borderColor: BLOCK_TYPE_COLORS.meeting.border }" />
          Meeting
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: BLOCK_TYPE_COLORS.holiday.bg, borderColor: BLOCK_TYPE_COLORS.holiday.border }" />
          Holiday
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: BLOCK_TYPE_COLORS.personal.bg, borderColor: BLOCK_TYPE_COLORS.personal.border }" />
          Personal
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: BLOCK_TYPE_COLORS.unavailable.bg, borderColor: BLOCK_TYPE_COLORS.unavailable.border }" />
          Unavailable
        </div>
        <div class="flex items-center gap-1.5">
          <div class="size-3 rounded border" :style="{ backgroundColor: APPOINTMENT_COLORS.scheduled.bg, borderColor: APPOINTMENT_COLORS.scheduled.border }" />
          Appointment
        </div>
      </div>

      <FullCalendar ref="calendarRef" :options="calendarOptions" />
    </div>
  </div>
</template>

<style>
/* FullCalendar theme overrides to match app design system */
.schedule-calendar .fc {
  --fc-border-color: var(--border);
  --fc-today-bg-color: oklch(0.97 0.005 253.827 / 0.3);
  --fc-neutral-bg-color: var(--muted);
  --fc-page-bg-color: transparent;
  --fc-now-indicator-color: var(--destructive);
  font-family: inherit;
}

.schedule-calendar .fc .fc-toolbar-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.schedule-calendar .fc .fc-button {
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  text-transform: capitalize;
  box-shadow: none;
}

.schedule-calendar .fc .fc-button:hover {
  background: var(--accent);
}

.schedule-calendar .fc .fc-button-active,
.schedule-calendar .fc .fc-button:active {
  background: var(--primary) !important;
  color: var(--primary-foreground) !important;
  border-color: var(--primary) !important;
}

.schedule-calendar .fc .fc-button:focus {
  box-shadow: 0 0 0 2px var(--ring);
}

.schedule-calendar .fc .fc-col-header-cell {
  padding: 0.5rem 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted-foreground);
  background: var(--muted);
}

.schedule-calendar .fc .fc-timegrid-slot {
  height: 2.5rem;
}

.schedule-calendar .fc .fc-timegrid-slot-label {
  font-size: 0.7rem;
  color: var(--muted-foreground);
}

.schedule-calendar .fc .fc-event {
  border-radius: 0.25rem;
  font-size: 0.75rem;
  padding: 1px 4px;
  border-width: 1px;
  border-left-width: 3px;
  cursor: default;
}

.schedule-calendar .fc .fc-event[data-event-type='block'] {
  cursor: pointer;
}

.schedule-calendar .fc .fc-daygrid-event {
  border-radius: 0.25rem;
  padding: 1px 4px;
}

.schedule-calendar .fc .fc-day-today .fc-daygrid-day-number {
  font-weight: 700;
  color: var(--primary);
}

.schedule-calendar .fc .fc-scrollgrid {
  border-radius: 0.5rem;
  overflow: hidden;
}

/* Non-business hours styling */
.schedule-calendar .fc .fc-non-business {
  background: oklch(0.96 0 0 / 0.5);
}

.dark .schedule-calendar .fc .fc-non-business {
  background: oklch(0.2 0 0 / 0.3);
}

.dark .schedule-calendar .fc {
  --fc-today-bg-color: oklch(0.3 0.005 253.827 / 0.2);
}

.dark .schedule-calendar .fc .fc-button {
  background: var(--background);
  color: var(--foreground);
  border-color: var(--border);
}

.dark .schedule-calendar .fc .fc-button:hover {
  background: var(--accent);
}
</style>
