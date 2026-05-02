<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  CheckCircle2,
  Clock,
  Coffee,
  LoaderCircle,
  LogIn,
  MoreVertical,
  UserRound,
  UserX,
  X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { appointmentApi } from '../api/appointmentApi'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import type { AppointmentResponse, AppointmentStatus, ClinicDoctor } from '../types/appointment.types'
import type { BlockType, CalendarBlock, Slot } from '@/domains/schedule/types/schedule.types'

const props = defineProps<{
  doctorFilter: string
  statusFilter: string
  canManage: boolean
}>()

const emit = defineEmits<{
  'appointment-click': [id: string]
  'slot-select': [dateTime: string | null, options?: { doctorId?: string | null, doctorName?: string | null, patientId?: string | null, patientName?: string | null }]
  reschedule: [appointment: AppointmentResponse]
  'check-in': [id: string]
  cancel: [id: string]
  'no-show': [id: string]
  'summary-change': [total: number]
}>()

interface DoctorLane {
  doctor: ClinicDoctor
  appointments: AppointmentResponse[]
  openSlots: number
  nextAvailableAt: string | null
  utilization: number
}

type TimelineItem =
  | {
    type: 'section'
    key: string
    label: 'Morning' | 'Afternoon' | 'Evening'
  }
  | {
    type: 'now'
    key: 'current-time'
    sortMinutes: number
  }
  | {
    type: 'appointment'
    key: string
    sortMinutes: number
    appointment: AppointmentResponse
  }
  | {
    type: 'block'
    key: string
    sortMinutes: number
    block: CalendarBlock
  }

type TimelineMarker = Exclude<TimelineItem, { type: 'section' }>

const selectedDate = ref(toLocalDate(new Date()))
const appointments = ref<AppointmentResponse[]>([])
const weekAppointments = ref<AppointmentResponse[]>([])
const doctors = ref<ClinicDoctor[]>([])
const availabilityByDoctor = ref<Record<string, Slot[]>>({})
const calendarBlocks = ref<CalendarBlock[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const hasAutoSelectedNextAppointmentDate = ref(false)
const currentTime = ref(new Date())
let currentTimeTimer: ReturnType<typeof setInterval> | null = null
let latestFetchKey = ''
let inFlightFetchKey = ''

function toLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function addDays(value: string, amount: number): string {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + amount)
  return toLocalDate(date)
}

function startOfWeek(value: string): string {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() - date.getDay())
  return toLocalDate(date)
}

function endOfWeek(value: string): string {
  return addDays(startOfWeek(value), 6)
}

function formatDay(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { weekday: 'short' })
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatShortDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatNumericDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

function isTerminal(status: AppointmentStatus): boolean {
  return ['completed', 'cancelled', 'no_show'].includes(status)
}

function doctorInitials(name: string): string {
  return name.split(' ').map((part) => part[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join('')
}

function patientInitials(name: string | null): string {
  if (!name) return 'PT'
  const parts = name.split(' ').filter(Boolean)
  const first = parts[0]?.[0]
  const last = parts[parts.length - 1]?.[0]
  return [first, last].filter(Boolean).join('').toUpperCase()
}

function patientAvatar(appointment: AppointmentResponse): string | null {
  return appointment.patient_avatar_url ?? null
}

function periodForTime(value: string): 'Morning' | 'Afternoon' | 'Evening' {
  const hour = new Date(value).getHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

function isSameDay(iso: string, date: string): boolean {
  return toLocalDate(new Date(iso)) === date
}

function minutesForIso(value: string): number {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

const weekDays = computed(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate.value), index)))
const todayDate = computed(() => toLocalDate(currentTime.value))

const selectedDayLabel = computed(() => {
  if (selectedDate.value === todayDate.value) return 'Today'
  if (selectedDate.value === addDays(todayDate.value, 1)) return 'Tomorrow'
  if (selectedDate.value === addDays(todayDate.value, -1)) return 'Yesterday'
  return formatShortDate(selectedDate.value)
})

const selectedFlowTitle = computed(() => {
  if (selectedDate.value === todayDate.value) return "Today's flow"
  if (selectedDate.value === addDays(todayDate.value, 1)) return "Tomorrow's flow"
  if (selectedDate.value === addDays(todayDate.value, -1)) return "Yesterday's flow"
  return `${selectedDayLabel.value} flow`
})

const weekCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const day of weekDays.value) counts[day] = 0
  for (const appointment of weekAppointments.value) {
    const key = toLocalDate(new Date(appointment.scheduled_at))
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
})

const weekStartLabel = computed(() => {
  const firstDay = weekDays.value[0]
  return firstDay ? formatShortDate(firstDay) : ''
})

const weekEndLabel = computed(() => {
  const lastDay = weekDays.value[6]
  return lastDay ? formatShortDate(lastDay) : ''
})

function getWeekCount(day: string): number {
  return weekCounts.value[day] ?? 0
}

function weekHeatBars(day: string): number[] {
  const count = getWeekCount(day)
  const intensity = count > 0 ? Math.min(0.95, 0.42 + count * 0.12) : 0.18
  return Array.from({ length: 4 }, (_, index) => Math.max(0.18, intensity - (3 - index) * 0.08))
}

const totalOpenSlots = computed(() => Object.values(availabilityByDoctor.value)
  .flat()
  .filter((slot) => slot.available).length)

const nextAppointment = computed(() => {
  const now = Date.now()
  return appointments.value
    .filter((appointment) => !isTerminal(appointment.status) && new Date(appointment.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null
})

function getNextVisibleAppointment(items: AppointmentResponse[]): AppointmentResponse | null {
  const now = Date.now()

  return items
    .filter((appointment) => !isTerminal(appointment.status) && new Date(appointment.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null
}

const stats = computed(() => ({
  total: appointments.value.length,
  checkedIn: appointments.value.filter((appointment) => appointment.status === 'checked_in').length,
  scheduled: appointments.value.filter((appointment) => appointment.status === 'scheduled').length,
  openSlots: totalOpenSlots.value,
}))

watch(stats, (value) => {
  emit('summary-change', value.total)
}, { immediate: true })

const currentTimeLabel = computed(() => formatTime(currentTime.value.toISOString()))

const selectedDayBlocks = computed(() => calendarBlocks.value
  .filter((block) => isSameDay(block.start, selectedDate.value) || isSameDay(block.end, selectedDate.value))
  .slice()
  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()))

const timelineAppointments = computed(() => appointments.value
  .slice()
  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()))

const timelineItems = computed<TimelineItem[]>(() => {
  const now = currentTime.value
  const markers: TimelineMarker[] = [{
    type: 'now',
    key: 'current-time',
    sortMinutes: now.getHours() * 60 + now.getMinutes(),
  }]

  for (const appointment of timelineAppointments.value) {
    const scheduledAt = new Date(appointment.scheduled_at)
    markers.push({
      type: 'appointment',
      key: appointment.id,
      sortMinutes: scheduledAt.getHours() * 60 + scheduledAt.getMinutes(),
      appointment,
    })
  }

  for (const block of selectedDayBlocks.value) {
    markers.push({
      type: 'block',
      key: `block-${block.id}`,
      sortMinutes: block.all_day ? 0 : minutesForIso(block.start),
      block,
    })
  }

  const sortedMarkers = markers.sort((a, b) => a.sortMinutes - b.sortMinutes)
  const items: TimelineItem[] = []
  const renderedPeriods = new Set<string>()

  for (const marker of sortedMarkers) {
    if (marker.type === 'appointment') {
      const period = periodForTime(marker.appointment.scheduled_at)
      if (!renderedPeriods.has(period)) {
        renderedPeriods.add(period)
        items.push({
          type: 'section',
          key: `section-${period}`,
          label: period,
        })
      }
    }

    if (marker.type === 'block') {
      const period = marker.block.all_day ? 'Morning' : periodForTime(marker.block.start)
      if (!renderedPeriods.has(period)) {
        renderedPeriods.add(period)
        items.push({
          type: 'section',
          key: `section-${period}`,
          label: period,
        })
      }
    }

    items.push(marker)
  }

  return items
})

const visibleDoctors = computed(() => {
  if (props.doctorFilter === 'all') return doctors.value
  return doctors.value.filter((doctor) => doctor.id === props.doctorFilter)
})

const doctorLanes = computed<DoctorLane[]>(() => visibleDoctors.value.map((doctor) => {
  const doctorAppointments = appointments.value.filter((appointment) => appointment.doctor_id === doctor.id)
  const availableSlots = availabilityByDoctor.value[doctor.id]?.filter((slot) => slot.available) ?? []
  const utilization = Math.min(100, Math.round((doctorAppointments.length / Math.max(1, doctorAppointments.length + availableSlots.length)) * 100))

  return {
    doctor,
    appointments: doctorAppointments,
    openSlots: availableSlots.length,
    nextAvailableAt: availableSlots[0]?.start ?? null,
    utilization,
  }
}))

function appointmentCardClasses(status: AppointmentStatus): string {
  if (status === 'checked_in') return 'appointment-timeline-card--checked-in'
  if (status === 'cancelled' || status === 'no_show') return 'appointment-timeline-card--quiet text-muted-foreground opacity-75'
  return 'appointment-timeline-card--scheduled'
}

function formatStatus(status: AppointmentStatus): string {
  if (status === 'no_show') return 'No show'
  return status.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function doctorAvatar(lane: DoctorLane): string | null {
  return lane.doctor.avatar_url ?? lane.appointments.find((appointment) => appointment.doctor_avatar_url)?.doctor_avatar_url ?? null
}

function blockTypeLabel(type: BlockType): string {
  if (type === 'leave') return 'Leave'
  if (type === 'meeting') return 'Meeting'
  if (type === 'holiday') return 'Holiday'
  if (type === 'personal') return 'Personal'
  return 'Unavailable'
}

function blockTypeClass(type: BlockType): string {
  if (type === 'leave') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
  if (type === 'meeting') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
  if (type === 'holiday') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
  if (type === 'personal') return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200'
  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
}

function blockDotClass(type: BlockType): string {
  if (type === 'leave') return 'bg-amber-500 ring-amber-100'
  if (type === 'meeting') return 'bg-blue-500 ring-blue-100'
  if (type === 'holiday') return 'bg-emerald-500 ring-emerald-100'
  if (type === 'personal') return 'bg-violet-500 ring-violet-100'
  return 'bg-red-500 ring-red-100'
}

function blockIcon(type: BlockType) {
  if (type === 'leave' || type === 'personal') return Coffee
  if (type === 'meeting') return UserRound
  if (type === 'holiday') return CalendarDays
  return Ban
}

function blockDurationLabel(block: CalendarBlock): string {
  if (block.all_day) return 'All day'
  const minutes = Math.max(0, Math.round((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000))
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hr`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes} min`
}

function blockTimeRange(block: CalendarBlock): string {
  if (block.all_day) return 'All day'
  return `${formatTime(block.start)} - ${formatTime(block.end)}`
}

async function fetchBoard(): Promise<void> {
  const doctorId = props.doctorFilter !== 'all' ? props.doctorFilter : undefined
  const status = props.statusFilter !== 'all' ? props.statusFilter as AppointmentStatus : undefined
  const start = startOfWeek(selectedDate.value)
  const end = endOfWeek(selectedDate.value)
  const fetchKey = `${selectedDate.value}:${start}:${end}:${doctorId ?? 'all'}:${status ?? 'all'}`
  if (inFlightFetchKey === fetchKey) return
  latestFetchKey = fetchKey
  inFlightFetchKey = fetchKey
  isLoading.value = true
  error.value = null

  try {
    const [weekResult, doctorsResult] = await Promise.all([
      appointmentApi.list(1, 500, { start_date: start, end_date: end, ...(doctorId ? { doctor_id: doctorId } : {}), ...(status ? { status } : {}) }),
      doctors.value.length > 0 ? Promise.resolve(null) : appointmentApi.getDoctors(),
    ])
    if (latestFetchKey !== fetchKey) return

    const dayAppointments = weekResult.data.filter((appointment) => isSameDay(appointment.scheduled_at, selectedDate.value))
    appointments.value = dayAppointments
    weekAppointments.value = weekResult.data
    if (doctorsResult) {
      doctors.value = doctorsResult.data
    }

    const nextVisibleAppointment = getNextVisibleAppointment(weekResult.data)
    if (
      !hasAutoSelectedNextAppointmentDate.value
      && dayAppointments.length === 0
      && selectedDate.value === toLocalDate(new Date())
      && nextVisibleAppointment
    ) {
      hasAutoSelectedNextAppointmentDate.value = true
      selectedDate.value = toLocalDate(new Date(nextVisibleAppointment.scheduled_at))
      return
    }

    const availabilityEntries = await Promise.all(visibleDoctors.value.map(async (doctor) => {
      try {
        const response = await scheduleApi.getAvailability(doctor.id, selectedDate.value)
        return [doctor.id, response.data.slots, response.data.blocks] as const
      } catch {
        return [doctor.id, [] as Slot[], [] as CalendarBlock[]] as const
      }
    }))

    if (latestFetchKey !== fetchKey) return
    availabilityByDoctor.value = Object.fromEntries(availabilityEntries.map(([doctorId, slots]) => [doctorId, slots]))
    calendarBlocks.value = Array.from(new Map(availabilityEntries
      .flatMap(([, , blocks]) => blocks)
      .map((block) => [block.id, block])).values())
  } catch {
    if (latestFetchKey !== fetchKey) return
    error.value = 'Failed to load appointment board.'
  } finally {
    if (inFlightFetchKey === fetchKey) {
      inFlightFetchKey = ''
    }
    if (latestFetchKey === fetchKey) {
      isLoading.value = false
    }
  }
}

function selectDate(date: string): void {
  selectedDate.value = date
}

function bookAt(slotStart: string | null, doctorId: string | null = null, doctorName: string | null = null): void {
  emit('slot-select', slotStart, {
    doctorId,
    doctorName,
    patientId: null,
    patientName: null,
  })
}

watch(() => props.statusFilter, () => {
  void fetchBoard()
})

watch(() => props.doctorFilter, () => {
  void fetchBoard()
})

watch(selectedDate, () => {
  void fetchBoard()
})

onMounted(() => {
  currentTimeTimer = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
  void fetchBoard()
})

onUnmounted(() => {
  if (currentTimeTimer) clearInterval(currentTimeTimer)
})

defineExpose({ refetch: fetchBoard })
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="appointment-board-stat surface-card rounded-2xl p-4">
        <div class="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
          <span class="appointment-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_16px_32px_rgba(37,99,235,0.24)]">
            <CalendarDays class="size-6" />
          </span>
          <div>
            <span class="text-sm text-muted-foreground">{{ selectedDayLabel }}</span>
            <p class="text-2xl font-semibold leading-tight">{{ stats.total }}</p>
          </div>
          <ChevronRight class="size-4 text-muted-foreground" />
        </div>
        <p class="mt-3 text-sm text-muted-foreground">{{ stats.scheduled }} appointments</p>
      </div>
      <div class="appointment-board-stat surface-card rounded-2xl p-4">
        <div class="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
          <span class="appointment-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_32px_rgba(16,185,129,0.24)]">
            <CheckCircle2 class="size-6" />
          </span>
          <div>
            <span class="text-sm text-muted-foreground">Checked in</span>
            <p class="text-2xl font-semibold leading-tight">{{ stats.checkedIn }}</p>
          </div>
          <ChevronRight class="size-4 text-muted-foreground" />
        </div>
        <p class="mt-3 text-sm text-muted-foreground">0 waiting</p>
      </div>
      <div class="appointment-board-stat surface-card rounded-2xl p-4">
        <div class="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
          <span class="appointment-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_16px_32px_rgba(245,158,11,0.24)]">
            <Clock class="size-6" />
          </span>
          <div class="min-w-0">
            <span class="text-sm text-muted-foreground">Next</span>
            <p class="truncate text-2xl font-semibold leading-tight">
              {{ nextAppointment ? formatTime(nextAppointment.scheduled_at) : 'None' }}
            </p>
          </div>
          <ChevronRight class="size-4 text-muted-foreground" />
        </div>
        <p class="mt-3 truncate text-sm text-muted-foreground">
          {{ nextAppointment?.patient_name ?? 'No more scheduled visits' }}
        </p>
      </div>
      <div class="appointment-board-stat surface-card rounded-2xl p-4">
        <div class="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
          <span class="appointment-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-[0_16px_32px_rgba(139,92,246,0.24)]">
            <CalendarPlus class="size-6" />
          </span>
          <div>
            <span class="text-sm text-muted-foreground">Open slots</span>
            <p class="text-2xl font-semibold leading-tight">{{ stats.openSlots }}</p>
          </div>
          <ChevronRight class="size-4 text-muted-foreground" />
        </div>
        <p class="mt-3 text-sm text-muted-foreground">View availability</p>
      </div>
    </div>

    <div v-if="error" role="alert" class="surface-card rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
      <Button variant="outline" size="sm" class="mt-2" @click="fetchBoard">Try again</Button>
    </div>

    <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(430px,0.86fr)]">
      <section class="appointment-board-panel surface-card overflow-hidden rounded-2xl">
        <div class="appointment-board-panel-header flex items-center justify-between px-4 py-3">
          <h2 class="text-base font-semibold">{{ selectedFlowTitle }}</h2>
        </div>

        <div v-if="isLoading" class="surface-muted m-5 flex items-center justify-center rounded-2xl py-16">
          <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="appointments.length === 0 && selectedDayBlocks.length === 0" class="surface-muted m-5 flex flex-col items-center justify-center rounded-2xl py-16 text-center">
          <div class="appointment-empty-icon mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarDays class="size-6 text-primary" />
          </div>
          <p class="text-sm font-medium">No appointments for this day</p>
          <p class="mt-1 text-xs text-muted-foreground">Use an open slot or create a walk-in from the queue.</p>
          <Button size="sm" class="mt-4" @click="bookAt(null)">
            <CalendarPlus class="size-3.5" />
            Book appointment
          </Button>
        </div>

        <div v-else class="relative px-4 py-5">
          <div class="appointment-timeline-line absolute bottom-9 left-[102px] top-14 w-px" />

          <div class="space-y-4">
            <div
              v-for="item in timelineItems"
              :key="item.key"
              :class="[
                item.type === 'section'
                  ? 'grid grid-cols-[64px_20px_minmax(0,1fr)] gap-3'
                  : item.type === 'now'
                    ? 'grid grid-cols-[64px_20px_minmax(0,1fr)] gap-3'
                    : 'grid grid-cols-[64px_20px_minmax(0,1fr)] gap-3',
              ]"
            >
              <template v-if="item.type === 'section'">
                <div />
                <div />
                <div class="pb-0.5 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {{ item.label }}
                </div>
              </template>

              <template v-else-if="item.type === 'now'">
                <div class="flex justify-end">
                  <span class="appointment-now-pill whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-teal-700">
                    {{ currentTimeLabel }}
                  </span>
                </div>

                <div class="relative flex justify-center pt-2">
                  <span class="relative z-10 size-3 rounded-full bg-teal-500" />
                </div>

                <div class="pt-3">
                  <div class="border-t border-dashed border-teal-500" />
                </div>
              </template>

              <template v-else-if="item.type === 'appointment'">
                <div class="pt-8 text-right">
                  <p class="text-sm font-semibold leading-tight text-foreground">{{ formatTime(item.appointment.scheduled_at) }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ item.appointment.duration }} min</p>
                </div>

                <div class="relative flex justify-center pt-10">
                  <span class="relative z-10 size-3.5 rounded-full border-2 border-background bg-teal-500 shadow-sm" />
                </div>

                <div
                  role="button"
                  tabindex="0"
                  :class="['appointment-timeline-card relative min-h-24 rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5', appointmentCardClasses(item.appointment.status)]"
                  @click="emit('appointment-click', item.appointment.id)"
                  @keydown.enter.space.prevent="emit('appointment-click', item.appointment.id)"
                >
                  <div class="grid gap-3 pr-24 sm:grid-cols-[52px_minmax(0,1fr)]">
                    <img
                      v-if="patientAvatar(item.appointment)"
                      :src="patientAvatar(item.appointment) ?? undefined"
                      alt=""
                      class="size-12 rounded-full object-cover"
                    >
                    <div v-else class="flex size-12 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                      {{ patientInitials(item.appointment.patient_name) }}
                    </div>

                    <div class="min-w-0 pt-1">
                      <p class="truncate text-sm font-semibold text-foreground">{{ item.appointment.patient_name ?? 'Unknown Patient' }}</p>
                      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span v-if="item.appointment.doctor_name" class="flex items-center gap-1.5">
                          <UserRound class="size-3.5" />
                          Dr. {{ item.appointment.doctor_name }}
                        </span>
                        <span v-if="item.appointment.reason">{{ item.appointment.reason }}</span>
                        <span v-if="item.appointment.notes" class="max-w-72 truncate">{{ item.appointment.notes }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="absolute right-3 top-3">
                    <span
                      :class="[
                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        item.appointment.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200'
                          : 'bg-muted text-muted-foreground',
                      ]"
                    >
                      {{ formatStatus(item.appointment.status) }}
                    </span>
                  </div>

                  <div v-if="canManage && item.appointment.status === 'scheduled'" class="mt-3 flex flex-wrap items-center justify-end gap-1.5" @click.stop>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-8 gap-1.5 px-2.5 text-xs"
                      @click="emit('check-in', item.appointment.id)"
                    >
                      <LogIn class="size-3.5" />
                      Check In
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      class="h-8 gap-1.5 px-2.5 text-xs"
                      @click="emit('reschedule', item.appointment)"
                    >
                      <CalendarDays class="size-3.5" />
                      Reschedule
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="outline" size="icon" class="size-8">
                          <MoreVertical class="size-3.5" />
                          <span class="sr-only">Appointment actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="emit('check-in', item.appointment.id)">
                          <LogIn class="mr-2 size-4" />
                          Check in
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="emit('no-show', item.appointment.id)">
                          <UserX class="mr-2 size-4" />
                          Mark no-show
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          class="text-destructive focus:text-destructive"
                          @click="emit('cancel', item.appointment.id)"
                        >
                          <X class="mr-2 size-4" />
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="pt-5 text-right">
                  <p class="text-sm font-semibold leading-tight text-foreground">
                    {{ item.block.all_day ? 'All day' : formatTime(item.block.start) }}
                  </p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ blockDurationLabel(item.block) }}</p>
                </div>

                <div class="relative flex justify-center pt-7">
                  <span :class="['relative z-10 size-3.5 rounded-full border-2 border-background shadow-sm ring-4', blockDotClass(item.block.type)]" />
                </div>

                <div
                  :class="[
                    'appointment-block-card relative rounded-2xl p-3 text-left',
                    item.block.type === 'leave' || item.block.type === 'unavailable'
                      ? 'appointment-block-card--quiet'
                      : '',
                  ]"
                >
                  <div class="grid gap-3 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:items-center">
                    <div :class="['flex size-10 items-center justify-center rounded-xl border', blockTypeClass(item.block.type)]">
                      <component :is="blockIcon(item.block.type)" class="size-5" />
                    </div>

                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="truncate text-sm font-semibold text-foreground">{{ item.block.title }}</p>
                        <span :class="['rounded-full border px-2 py-0.5 text-[11px] font-semibold', blockTypeClass(item.block.type)]">
                          {{ blockTypeLabel(item.block.type) }}
                        </span>
                      </div>
                      <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{{ blockTimeRange(item.block) }}</span>
                        <span v-if="item.block.user_name" class="flex items-center gap-1.5">
                          <UserRound class="size-3.5" />
                          Dr. {{ item.block.user_name }}
                        </span>
                        <span v-if="item.block.notes" class="max-w-72 truncate">{{ item.block.notes }}</span>
                      </div>
                    </div>

                    <span class="hidden text-xs font-medium text-muted-foreground sm:block">
                      Block
                    </span>
                  </div>
                </div>
              </template>
            </div>

            <div v-if="appointments.length > timelineAppointments.length" class="grid grid-cols-[64px_20px_minmax(0,1fr)] gap-3 pt-1">
              <div />
              <div />
              <div class="flex justify-center">
                <Button variant="outline" size="sm" class="h-9 min-w-32 text-xs">
                  Load more
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="space-y-3">
        <section class="appointment-board-side-card surface-card rounded-2xl p-4">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold">Week at a glance</h2>
              <p class="text-xs text-muted-foreground">{{ weekStartLabel }} - {{ weekEndLabel }}</p>
            </div>
          </div>

          <div class="grid grid-cols-7 gap-2">
            <button
              v-for="day in weekDays"
              :key="day"
              :class="[
                'appointment-week-day rounded-2xl p-2 text-center transition-all',
                day === todayDate
                  ? 'is-today text-teal-950 dark:text-teal-100'
                  : day === selectedDate
                    ? 'is-selected text-foreground'
                    : 'hover:bg-white/40 dark:hover:bg-white/5',
              ]"
              @click="selectDate(day)"
            >
              <span class="block text-[10px] font-medium">{{ formatDay(day) }}</span>
              <span class="mt-0.5 block text-xs">{{ formatNumericDate(day) }}</span>
              <span
                v-if="day === todayDate"
                class="mt-1 inline-flex rounded-full bg-teal-500 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white"
              >
                Today
              </span>
              <span class="mt-3 block space-y-1">
                <span
                  v-for="(opacity, index) in weekHeatBars(day)"
                  :key="index"
                  class="mx-auto block h-1 w-8 rounded-full bg-teal-500"
                  :style="{ opacity }"
                />
              </span>
            </button>
          </div>
          <div class="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <span>Low</span>
              <span class="size-2 rounded-sm bg-teal-100" />
              <span class="size-2 rounded-sm bg-teal-200" />
              <span class="size-2 rounded-sm bg-teal-400" />
              <span class="size-2 rounded-sm bg-teal-600" />
              <span class="size-2 rounded-sm bg-teal-800" />
              <span>High</span>
            </div>
            <span>More appointments = darker</span>
          </div>
        </section>

        <section class="appointment-board-side-card surface-card rounded-2xl p-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-base font-semibold">Doctor lanes</h2>
            <Button variant="link" size="sm" class="h-auto p-0 text-xs">View all</Button>
          </div>
          <div class="appointment-doctor-lanes divide-y">
            <div v-for="lane in doctorLanes.slice(0, 3)" :key="lane.doctor.id" class="py-3 first:pt-0 last:pb-0">
              <div class="grid grid-cols-[44px_minmax(0,1fr)_92px_120px] items-center gap-3">
                <img
                  v-if="doctorAvatar(lane)"
                  :src="doctorAvatar(lane) ?? undefined"
                  alt=""
                  class="size-10 rounded-full object-cover"
                >
                <div v-else class="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {{ doctorInitials(lane.doctor.name) }}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">Dr. {{ lane.doctor.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ lane.appointments.length }} visits · {{ lane.openSlots }} open</p>
                </div>
                <div>
                  <p class="text-[10px] text-muted-foreground">Next</p>
                  <p class="text-sm font-semibold leading-tight">{{ lane.nextAvailableAt ? formatTime(lane.nextAvailableAt) : 'No slot' }}</p>
                </div>
                <div>
                  <div class="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Utilization</span>
                    <span>{{ lane.utilization }}%</span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      class="h-full rounded-full bg-teal-500"
                      :style="{ width: `${lane.utilization}%` }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </aside>
    </div>
  </div>
</template>

<style scoped>
.appointment-board-stat,
.appointment-board-panel,
.appointment-board-side-card,
.appointment-timeline-card,
.appointment-block-card {
  position: relative;
}

.appointment-board-stat,
.appointment-board-panel,
.appointment-board-side-card,
.appointment-timeline-card,
.appointment-block-card {
  border: 0;
  background:
    radial-gradient(circle at 18% 0%, rgb(59 130 246 / 0.08), transparent 32%),
    radial-gradient(circle at 82% 18%, rgb(20 184 166 / 0.08), transparent 30%),
    var(--surface-panel-strong);
}

.appointment-board-panel-header {
  box-shadow: inset 0 -1px 0 rgb(255 255 255 / 0.32);
}

.appointment-stat-icon,
.appointment-empty-icon {
  transform: translateZ(0);
}

.appointment-timeline-line {
  background: rgb(148 163 184 / 0.28);
}

.appointment-now-pill {
  border: 1px solid rgb(94 234 212 / 0.42);
  background: rgb(240 253 250 / 0.72);
  box-shadow: 0 10px 24px rgb(15 118 110 / 0.1);
}

.appointment-timeline-card:hover,
.appointment-block-card:hover,
.appointment-board-side-card:hover {
  box-shadow: var(--surface-shadow-strong);
}

.appointment-timeline-card--checked-in {
  background:
    linear-gradient(135deg, rgb(16 185 129 / 0.1), rgb(255 255 255 / 0.38)),
    var(--surface-panel-strong);
}

.appointment-timeline-card--quiet {
  background: rgb(148 163 184 / 0.12);
}

.appointment-block-card--quiet {
  border: 1px dashed rgb(148 163 184 / 0.28);
}

.appointment-week-day {
  border: 0;
}

.appointment-week-day.is-today {
  background: rgb(204 251 241 / 0.78);
  box-shadow:
    0 12px 26px rgb(15 118 110 / 0.12),
    inset 0 0 0 1px rgb(45 212 191 / 0.46);
}

.appointment-week-day.is-selected {
  background: rgb(219 234 254 / 0.72);
  box-shadow: inset 0 0 0 1px rgb(96 165 250 / 0.34);
}

.appointment-doctor-lanes {
  border-color: rgb(255 255 255 / 0.28);
}

:global(.dark .appointment-board-stat),
:global(.dark .appointment-board-panel),
:global(.dark .appointment-board-side-card),
:global(.dark .appointment-timeline-card),
:global(.dark .appointment-block-card) {
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

:global(.dark .appointment-board-panel-header) {
  box-shadow:
    inset 0 -1px 0 rgb(148 163 184 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.03);
}

:global(.dark .appointment-timeline-line) {
  background: rgb(148 163 184 / 0.14);
}

:global(.dark .appointment-now-pill) {
  color: rgb(94 234 212);
  border-color: rgb(94 234 212 / 0.22);
  background: rgb(20 184 166 / 0.12);
  box-shadow: 0 14px 34px rgb(0 0 0 / 0.22);
}

:global(.dark .appointment-timeline-card:hover),
:global(.dark .appointment-block-card:hover) {
  background:
    linear-gradient(90deg, rgb(59 130 246 / 0.12), rgb(20 184 166 / 0.08)),
    rgb(15 23 42 / 0.38);
  box-shadow:
    inset 3px 0 0 rgb(56 189 248 / 0.42),
    inset 0 1px 0 rgb(255 255 255 / 0.04),
    inset 0 -1px 0 rgb(255 255 255 / 0.04),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .appointment-week-day.is-today) {
  background: rgb(20 184 166 / 0.14);
  box-shadow:
    0 0 0 1px rgb(94 234 212 / 0.22),
    0 14px 34px rgb(20 184 166 / 0.1);
}

:global(.dark .appointment-week-day.is-selected) {
  background: rgb(59 130 246 / 0.14);
  box-shadow: inset 0 0 0 1px rgb(96 165 250 / 0.2);
}

:global(.dark .appointment-doctor-lanes) {
  border-color: rgb(148 163 184 / 0.1);
}
</style>
