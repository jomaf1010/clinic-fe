<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventSourceFuncArg, EventDropArg, EventResizeDoneArg } from '@fullcalendar/core'
import { HttpError } from '@/lib/http'
import { appointmentApi } from '../api/appointmentApi'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import type { AppointmentResponse, AppointmentListFilters } from '../types/appointment.types'
import type { CalendarBlock } from '@/domains/schedule/types/schedule.types'

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  scheduled: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  checked_in: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  completed: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  cancelled: { bg: '#f3f4f6', border: '#9ca3af', text: '#6b7280' },
  no_show: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
}

const DOCTOR_BORDER_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6366f1',
]

const BLOCK_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  leave: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  meeting: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  holiday: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  personal: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  unavailable: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  leave: 'On Leave',
  meeting: 'Meeting',
  holiday: 'Holiday',
  personal: 'Personal',
  unavailable: 'Unavailable',
}

const props = defineProps<{
  doctorFilter?: string
  statusFilter?: string
}>()

const emit = defineEmits<{
  'appointment-click': [id: string]
  'slot-select': [dateTime: string]
}>()

const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)

// Store fetched appointments for detail sheet lookups & legend
const appointments = ref<AppointmentResponse[]>([])


// Stable doctor color assignment
const doctorColorIndex = new Map<string, string>()
function getDoctorColor(doctorId: string): string {
  if (!doctorColorIndex.has(doctorId)) {
    doctorColorIndex.set(doctorId, DOCTOR_BORDER_COLORS[doctorColorIndex.size % DOCTOR_BORDER_COLORS.length]!)
  }
  return doctorColorIndex.get(doctorId)!
}

const doctorLegend = computed(() => {
  const legend: { name: string; color: string; avatarUrl: string | null }[] = []
  const seen = new Set<string>()
  for (const appt of appointments.value) {
    if (appt.doctor_id && !seen.has(appt.doctor_id)) {
      seen.add(appt.doctor_id)
      legend.push({
        name: appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'Unknown',
        color: getDoctorColor(appt.doctor_id),
        avatarUrl: appt.doctor_avatar_url ?? null,
      })
    }
  }
  return legend
})

function buildBlockEvent(
  block: CalendarBlock, start: string, end: string, allDay: boolean,
  colors: { bg: string; border: string; text: string }, typeLabel: string,
  doctorLabel: string, doctorColor: string, dateSuffix?: string,
): Record<string, unknown> {
  return {
    id: `block-${block.id}${dateSuffix ? `-${dateSuffix}` : ''}`,
    title: `${block.title} — ${doctorLabel}`,
    start,
    end,
    allDay,
    editable: false,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    textColor: colors.text,
    extendedProps: {
      type: 'block',
      blockType: block.type,
      blockTitle: block.title,
      typeLabel,
      doctorName: doctorLabel,
      doctorAvatarUrl: block.user_avatar_url,
      doctorInitials: (block.user_name ?? '?').split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join(''),
      doctorColor,
    },
  }
}

// FullCalendar events function — called by FC when date range changes
async function eventSourceFn(
  info: EventSourceFuncArg,
  successCallback: (events: Record<string, unknown>[]) => void,
  failureCallback: (error: Error) => void,
) {
  try {
    const start = info.startStr.slice(0, 10)
    const end = info.endStr.slice(0, 10)
    const filters: AppointmentListFilters = { start_date: start, end_date: end }
    if (props.doctorFilter && props.doctorFilter !== 'all') {
      filters.doctor_id = props.doctorFilter
    }
    if (props.statusFilter && props.statusFilter !== 'all') {
      filters.status = props.statusFilter as AppointmentListFilters['status']
    }
    const [apptRes, blocksRes] = await Promise.all([
      appointmentApi.list(1, 500, filters),
      scheduleApi.listAllBlocks(start, end),
    ])
    appointments.value = apptRes.data

    const events: Record<string, unknown>[] = []

    // Appointment events
    for (const appt of apptRes.data) {
      const statusColors = STATUS_COLORS[appt.status] ?? STATUS_COLORS.scheduled!
      const doctorBorder = getDoctorColor(appt.doctor_id)
      const startDate = new Date(appt.scheduled_at)
      const endDate = new Date(startDate.getTime() + appt.duration * 60000)
      const statusLabel = appt.status === 'checked_in' ? 'Checked In'
        : appt.status === 'no_show' ? 'No Show'
          : appt.status.charAt(0).toUpperCase() + appt.status.slice(1)
      const doctorLabel = appt.doctor_name ? `Dr. ${appt.doctor_name}` : ''
      const canDrag = appt.status === 'scheduled' && startDate.getTime() > Date.now()

      events.push({
        id: `appt-${appt.id}`,
        title: `${appt.patient_name ?? 'Patient'}${doctorLabel ? ` · ${doctorLabel}` : ''} — ${statusLabel}`,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: false,
        editable: canDrag,
        durationEditable: canDrag,
        backgroundColor: statusColors.bg,
        borderColor: doctorBorder,
        textColor: statusColors.text,
        extendedProps: {
          type: 'appointment',
          appointmentId: appt.id,
          doctorName: doctorLabel,
          doctorAvatarUrl: appt.doctor_avatar_url,
          doctorInitials: (appt.doctor_name ?? '?').split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join(''),
          doctorColor: doctorBorder,
          patientName: appt.patient_name ?? 'Patient',
          statusLabel,
          duration: appt.duration,
        },
      })
    }

    // Calendar block events
    for (const block of blocksRes.data) {
      if (props.doctorFilter && props.doctorFilter !== 'all' && block.user_id !== props.doctorFilter) {
        continue
      }

      const colors = BLOCK_TYPE_COLORS[block.type] ?? BLOCK_TYPE_COLORS.unavailable!
      const typeLabel = BLOCK_TYPE_LABELS[block.type] ?? block.type
      const doctorLabel = block.user_name ? `Dr. ${block.user_name}` : ''
      const doctorColor = getDoctorColor(block.user_id)

      if (block.recurring && !block.all_day) {
        const tz = 'Asia/Manila'
        const startLocal = new Date(block.start)
        const endLocal = new Date(block.end)
        const startTimeStr = startLocal.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
        const endTimeStr = endLocal.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
        const startDateObj = new Date(startLocal.toLocaleDateString('en-CA', { timeZone: tz }))
        const endDateObj = new Date(endLocal.toLocaleDateString('en-CA', { timeZone: tz }))
        const current = new Date(startDateObj)
        while (current <= endDateObj) {
          const dateStr = current.toISOString().slice(0, 10)
          events.push(buildBlockEvent(block, `${dateStr}T${startTimeStr}`, `${dateStr}T${endTimeStr}`, false, colors, typeLabel, doctorLabel, doctorColor, dateStr))
          current.setDate(current.getDate() + 1)
        }
      } else {
        events.push(buildBlockEvent(block, block.start, block.end, block.all_day, colors, typeLabel, doctorLabel, doctorColor))
      }
    }

    successCallback(events)
  } catch (e) {
    failureCallback(e instanceof Error ? e : new Error('Failed to fetch'))
  }
}

// Refetch when filters change
watch(() => [props.doctorFilter, props.statusFilter], () => {
  calendarRef.value?.getApi()?.refetchEvents()
})

function handleDateClick(info: { date: Date; allDay: boolean }) {
  if (info.allDay) return
  if (info.date.getTime() < Date.now()) return
  emit('slot-select', info.date.toISOString())
}

function handleEventClick(info: { event: { extendedProps: Record<string, unknown> } }) {
  if (info.event.extendedProps.type !== 'appointment') return
  const id = info.event.extendedProps.appointmentId as string
  if (id) emit('appointment-click', id)
}

async function handleEventDrop(info: EventDropArg) {
  const apptId = info.event.extendedProps.appointmentId as string
  const newStart = info.event.start
  if (!apptId || !newStart) {
    info.revert()
    return
  }

  // Block drops to past
  if (newStart.getTime() < Date.now()) {
    info.revert()
    toast.error('Cannot reschedule to a past time')
    return
  }

  try {
    await appointmentApi.reschedule(apptId, newStart.toISOString())
    toast.success('Appointment rescheduled')
    // Refresh to get updated data
    calendarRef.value?.getApi()?.refetchEvents()
  } catch (err) {
    info.revert()
    const msg = (err instanceof HttpError && (err.data as { message?: string; errors?: Record<string, string[]> })?.errors?.scheduled_at?.[0])
      || 'Failed to reschedule — slot may not be available'
    toast.error(msg)
  }
}

async function handleEventResize(info: EventResizeDoneArg) {
  const apptId = info.event.extendedProps.appointmentId as string
  const start = info.event.start
  const end = info.event.end
  if (!apptId || !start || !end) {
    info.revert()
    return
  }

  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
  if (durationMin < 1) {
    info.revert()
    return
  }

  try {
    await appointmentApi.resize(apptId, durationMin)
    toast.success('Appointment duration updated')
    calendarRef.value?.getApi()?.refetchEvents()
  } catch (err) {
    info.revert()
    const msg = (err instanceof HttpError && (err.data as { message?: string; errors?: Record<string, string[]> })?.errors?.duration?.[0])
      || 'Failed to resize — slots may not be available'
    toast.error(msg)
  }
}

function renderEventContent(arg: { event: { extendedProps: Record<string, unknown> }; timeText: string }) {
  const ep = arg.event.extendedProps
  const avatarUrl = ep.doctorAvatarUrl as string | null
  const initials = ep.doctorInitials as string
  const color = ep.doctorColor as string
  const doctor = ep.doctorName as string

  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid ${color};flex-shrink:0;" />`
    : `<div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font-size:8px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>`

  if (ep.type === 'block') {
    const typeLabel = ep.typeLabel as string
    const blockTitle = ep.blockTitle as string
    return {
      html: `<div style="display:flex;align-items:center;gap:4px;overflow:hidden;padding:1px 0;opacity:0.85;">
        ${avatarHtml}
        <div style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:1.3;">
          <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;">${typeLabel}: ${blockTitle}</div>
          <div style="opacity:0.75;font-size:0.65rem;overflow:hidden;text-overflow:ellipsis;">${doctor}</div>
        </div>
      </div>`,
    }
  }

  const patient = ep.patientName as string
  const status = ep.statusLabel as string
  const duration = ep.duration as number

  // Compact layout for short slots (≤20min)
  if (duration <= 20) {
    const smallAvatar = avatarUrl
      ? `<img src="${avatarUrl}" alt="" style="width:16px;height:16px;border-radius:50%;object-fit:cover;border:1.5px solid ${color};flex-shrink:0;" />`
      : `<div style="width:16px;height:16px;border-radius:50%;background:${color};color:#fff;font-size:6px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>`
    return {
      html: `<div style="display:flex;align-items:center;gap:3px;overflow:hidden;padding:0;">
        ${smallAvatar}
        <span style="font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:0.65rem;line-height:1;">${patient}</span>
      </div>`,
    }
  }

  return {
    html: `<div style="display:flex;align-items:center;gap:4px;overflow:hidden;padding:1px 0;">
      ${avatarHtml}
      <div style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:1.3;">
        <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;">${patient}</div>
        <div style="opacity:0.75;font-size:0.65rem;overflow:hidden;text-overflow:ellipsis;">${doctor} · ${status}</div>
      </div>
    </div>`,
  }
}

function getAppointment(id: string): AppointmentResponse | undefined {
  return appointments.value.find((a) => a.id === id)
}

function refetch() {
  calendarRef.value?.getApi()?.refetchEvents()
}

defineExpose({ getAppointment, refetch })

const calendarOptions: CalendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay',
  },
  events: eventSourceFn,
  nowIndicator: true,
  editable: true,
  slotMinTime: '06:00:00',
  slotMaxTime: '22:00:00',
  slotDuration: '00:15:00',
  allDaySlot: false,
  weekends: true,
  dayMaxEvents: true,
  height: 'auto',
  dateClick: handleDateClick,
  eventClick: handleEventClick,
  eventDrop: handleEventDrop,
  eventResize: handleEventResize,
  eventContent: renderEventContent,
  eventDisplay: 'block',
  dragRevertDuration: 300,
}
</script>

<template>
  <div class="appointment-calendar">
    <!-- Doctor legend -->
    <div v-if="doctorLegend.length" class="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <div v-for="doc in doctorLegend" :key="doc.name" class="flex items-center gap-1.5">
        <div class="relative flex items-center">
          <div class="h-4 w-1 rounded-full" :style="{ backgroundColor: doc.color }" />
          <img v-if="doc.avatarUrl" :src="doc.avatarUrl" alt="" class="ml-1 size-5 rounded-full object-cover" />
          <div v-else class="ml-1 flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium">
            {{ doc.name.replace('Dr. ', '').split(' ').map(w => w[0]).slice(0, 2).join('') }}
          </div>
        </div>
        {{ doc.name }}
      </div>
    </div>

    <!-- Status legend -->
    <div class="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <div v-for="(colors, status) in STATUS_COLORS" :key="status" class="flex items-center gap-1.5">
        <div class="size-2.5 rounded-sm border" :style="{ backgroundColor: colors.bg, borderColor: colors.border }" />
        {{ status === 'checked_in' ? 'Checked In' : status === 'no_show' ? 'No Show' : status.charAt(0).toUpperCase() + status.slice(1) }}
      </div>
      <span class="text-border">|</span>
      <div v-for="(colors, btype) in BLOCK_TYPE_COLORS" :key="btype" class="flex items-center gap-1.5">
        <div class="size-2.5 rounded-sm border" :style="{ backgroundColor: colors.bg, borderColor: colors.border }" />
        {{ BLOCK_TYPE_LABELS[btype] ?? btype }}
      </div>
    </div>

    <FullCalendar ref="calendarRef" :options="calendarOptions" />
  </div>
</template>

<style>
.appointment-calendar .fc {
  --fc-border-color: var(--border);
  --fc-today-bg-color: oklch(0.97 0.005 253.827 / 0.3);
  --fc-neutral-bg-color: var(--muted);
  --fc-page-bg-color: transparent;
  --fc-now-indicator-color: var(--destructive);
  font-family: inherit;
}

.appointment-calendar .fc .fc-toolbar-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.appointment-calendar .fc .fc-button {
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

.appointment-calendar .fc .fc-button:hover {
  background: var(--accent);
}

.appointment-calendar .fc .fc-button-active,
.appointment-calendar .fc .fc-button:active {
  background: var(--primary) !important;
  color: var(--primary-foreground) !important;
  border-color: var(--primary) !important;
}

.appointment-calendar .fc .fc-button:focus {
  box-shadow: 0 0 0 2px var(--ring);
}

.appointment-calendar .fc .fc-col-header-cell {
  padding: 0.5rem 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted-foreground);
  background: var(--muted);
}

.appointment-calendar .fc .fc-timegrid-slot {
  height: 1.25rem;
}

.appointment-calendar .fc .fc-timegrid-slot-label {
  font-size: 0.7rem;
  color: var(--muted-foreground);
}

.appointment-calendar .fc .fc-event {
  border-radius: 0.25rem;
  font-size: 0.7rem;
  padding: 1px 4px;
  border-width: 1px;
  border-left-width: 3px;
  cursor: pointer;
}

.appointment-calendar .fc .fc-daygrid-event {
  border-radius: 0.25rem;
  padding: 1px 4px;
}

.appointment-calendar .fc .fc-day-today .fc-daygrid-day-number {
  font-weight: 700;
  color: var(--primary-foreground);
  background: var(--primary);
  border-radius: 9999px;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.appointment-calendar .fc .fc-day-past {
  background: oklch(0.96 0 0 / 0.4);
}

.appointment-calendar .fc .fc-day-past .fc-daygrid-day-number {
  opacity: 0.4;
}

.appointment-calendar .fc .fc-day-past .fc-daygrid-event {
  opacity: 0.5;
}

.appointment-calendar .fc .fc-scrollgrid {
  border-radius: 0.5rem;
  overflow: hidden;
}

.dark .appointment-calendar .fc .fc-day-past {
  background: oklch(0.15 0 0 / 0.4);
}

.dark .appointment-calendar .fc {
  --fc-today-bg-color: oklch(0.3 0.005 253.827 / 0.2);
}

.dark .appointment-calendar .fc .fc-button {
  background: var(--background);
  color: var(--foreground);
  border-color: var(--border);
}

.dark .appointment-calendar .fc .fc-button:hover {
  background: var(--accent);
}
</style>
