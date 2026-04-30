<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { CalendarDate, type DateValue } from '@internationalized/date'
import {
  Activity,
  AlertTriangle,
  Ban,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  LogIn,
  LoaderCircle,
  MoreVertical,
  RefreshCw,
  UserRound,
  UserX,
  X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Calendar as ShadcnCalendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AppointmentResponse, AppointmentStatus } from '@/domains/appointment/types/appointment.types'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import { scheduleApi } from '../api/scheduleApi'
import type { CalendarBlock, Slot } from '../types/schedule.types'

const props = defineProps<{
  userId: string
  refreshKey?: number
}>()

const emit = defineEmits<{
  'appointment-click': [id: string]
  'add-block': [dateTime: string | null]
  'check-in': [id: string]
  cancel: [id: string]
  'no-show': [id: string]
  'working-hours': []
}>()

type Period = 'morning' | 'afternoon' | 'evening'
const periods: Period[] = ['morning', 'afternoon', 'evening']
type MapViewMode = 'day' | 'week' | 'list'
type StatusFilter = 'all' | AppointmentStatus

const selectedDate = ref(toLocalDate(new Date()))
const currentTime = ref(new Date())
const appointments = ref<AppointmentResponse[]>([])
const weekAppointments = ref<AppointmentResponse[]>([])
const slots = ref<Slot[]>([])
const weekBlocks = ref<CalendarBlock[]>([])
const upcomingBlocks = ref<CalendarBlock[]>([])
const mapViewMode = ref<MapViewMode>('day')
const statusFilter = ref<StatusFilter>('all')
const isLoading = ref(false)
const error = ref<string | null>(null)
let currentTimeTimer: ReturnType<typeof setInterval> | null = null
let latestLoadKey = ''
let inFlightLoadKey = ''

function toLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function isoToCalendarDate(value: string): CalendarDate {
  const [year, month, day] = value.split('-').map(Number)
  return new CalendarDate(year!, month!, day!)
}

function calendarDateToIso(value: DateValue): string {
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
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

function formatDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatNumericDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

function formatWeekday(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { weekday: 'short' })
}

function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function timeMinutes(value: string): number {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

function blockStartMinutes(block: CalendarBlock): number {
  return timeMinutes(block.start)
}

function periodForIso(value: string): Period {
  const hour = new Date(value).getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function isSameDay(iso: string, date: string): boolean {
  return toLocalDate(new Date(iso)) === date
}

function patientInitials(name: string | null): string {
  if (!name) return 'PT'
  const parts = name.split(' ').filter(Boolean)
  const first = parts[0]?.[0]
  const last = parts[parts.length - 1]?.[0]
  return [first, last].filter(Boolean).join('').toUpperCase()
}

function statusLabel(status: AppointmentStatus): string {
  if (status === 'checked_in') return 'Checked in'
  if (status === 'no_show') return 'No show'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusClass(status: AppointmentStatus): string {
  if (status === 'checked_in') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'completed') return 'border-teal-200 bg-teal-50 text-teal-700'
  if (status === 'cancelled') return 'border-muted bg-muted/60 text-muted-foreground'
  if (status === 'no_show') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function statusDotClass(status: AppointmentStatus): string {
  if (status === 'checked_in') return 'bg-emerald-500 ring-emerald-100'
  if (status === 'completed') return 'bg-teal-500 ring-teal-100'
  if (status === 'cancelled') return 'bg-muted-foreground/50 ring-muted'
  if (status === 'no_show') return 'bg-red-500 ring-red-100'
  return 'bg-blue-500 ring-blue-100'
}

function blockClass(type: CalendarBlock['type']): string {
  if (type === 'meeting') return 'border-blue-200 bg-blue-50 text-blue-800'
  if (type === 'holiday') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (type === 'personal') return 'border-violet-200 bg-violet-50 text-violet-800'
  if (type === 'unavailable') return 'border-red-200 bg-red-50 text-red-800'
  return 'border-amber-200 bg-amber-50 text-amber-800'
}

const todayDate = computed(() => toLocalDate(currentTime.value))
const isSelectedToday = computed(() => selectedDate.value === todayDate.value)
const selectedDateValue = computed<DateValue>({
  get: () => isoToCalendarDate(selectedDate.value),
  set: (value) => {
    selectedDate.value = calendarDateToIso(value)
  },
})
const weekDays = computed(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate.value), index)))
const weekLabel = computed(() => {
  const firstDay = weekDays.value[0] ?? selectedDate.value
  const lastDay = weekDays.value[6] ?? selectedDate.value
  return `${formatShortDate(firstDay)} - ${formatShortDate(lastDay)}`
})

const visibleAppointments = computed(() => appointments.value
  .filter((appointment) => statusFilter.value === 'all' || appointment.status === statusFilter.value)
  .slice()
  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()))

const visibleWeekAppointments = computed(() => weekAppointments.value
  .filter((appointment) => statusFilter.value === 'all' || appointment.status === statusFilter.value)
  .slice()
  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()))

const scheduledAppointments = computed(() => visibleAppointments.value
  .filter((appointment) => appointment.status === 'scheduled'))

const upcomingScheduledAppointments = computed(() => scheduledAppointments.value
  .filter((appointment) => new Date(appointment.scheduled_at).getTime() >= currentTime.value.getTime()))

const nextUp = computed(() => upcomingScheduledAppointments.value[0] ?? scheduledAppointments.value[0] ?? null)
const availableSlots = computed(() => slots.value.filter((slot) => slot.available))
const selectedDayBlocks = computed(() => weekBlocks.value
  .filter((block) => isSameDay(block.start, selectedDate.value) || isSameDay(block.end, selectedDate.value))
  .sort((a, b) => blockStartMinutes(a) - blockStartMinutes(b)))

const upcomingBlockRangeLabel = computed(() => `${formatShortDate(selectedDate.value)} - ${formatShortDate(addDays(selectedDate.value, 30))}`)

const weekCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const day of weekDays.value) counts[day] = 0
  for (const appointment of weekAppointments.value) {
    const key = toLocalDate(new Date(appointment.scheduled_at))
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
})

const slotStats = computed(() => {
  const total = slots.value.length
  const available = availableSlots.value.length
  const booked = appointments.value.filter((appointment) => appointment.status !== 'cancelled').length
  const utilization = total > 0 ? Math.round((booked / total) * 100) : 0
  return { total, available, booked, utilization: Math.min(100, utilization) }
})

const currentTimeLabel = computed(() => formatTime(currentTime.value))

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No show' },
]

function periodSlots(period: Period): Slot[] {
  return availableSlots.value.filter((slot) => periodForIso(slot.start) === period)
}

function periodAppointments(period: Period): AppointmentResponse[] {
  return visibleAppointments.value.filter((appointment) => periodForIso(appointment.scheduled_at) === period)
}

function periodBlocks(period: Period): CalendarBlock[] {
  return selectedDayBlocks.value.filter((block) => periodForIso(block.start) === period)
}

function periodHasContent(period: Period): boolean {
  return periodSlots(period).length > 0 || periodAppointments(period).length > 0 || periodBlocks(period).length > 0
}

function periodLabel(period: Period): string {
  if (period === 'morning') return 'Morning availability'
  if (period === 'afternoon') return 'Afternoon availability'
  return 'Evening availability'
}

function periodIcon(period: Period) {
  if (period === 'morning') return CalendarDays
  if (period === 'afternoon') return Activity
  return Clock
}

function appointmentEnd(appointment: AppointmentResponse): string {
  const start = new Date(appointment.scheduled_at)
  return new Date(start.getTime() + appointment.duration * 60_000).toISOString()
}

function weekHeatBars(day: string): number[] {
  const count = weekCounts.value[day] ?? 0
  const intensity = count > 0 ? Math.min(0.95, 0.35 + count * 0.13) : 0.16
  return Array.from({ length: 4 }, (_, index) => Math.max(0.14, intensity - (3 - index) * 0.08))
}

function appointmentsForDay(day: string): AppointmentResponse[] {
  return visibleWeekAppointments.value.filter((appointment) => toLocalDate(new Date(appointment.scheduled_at)) === day)
}

function setMapViewMode(mode: MapViewMode) {
  mapViewMode.value = mode
}

function setStatusFilter(value: StatusFilter) {
  statusFilter.value = value
}

function selectDate(date: string) {
  selectedDate.value = date
}

function goToPreviousDay() {
  selectedDate.value = addDays(selectedDate.value, -1)
}

function goToNextDay() {
  selectedDate.value = addDays(selectedDate.value, 1)
}

async function loadStudioData() {
  if (!props.userId) return
  const start = startOfWeek(selectedDate.value)
  const end = endOfWeek(selectedDate.value)
  const blockRangeEnd = addDays(selectedDate.value, 30)
  const loadKey = `${props.userId}:${selectedDate.value}:${start}:${end}:${blockRangeEnd}:${props.refreshKey ?? 0}`
  if (inFlightLoadKey === loadKey) return
  latestLoadKey = loadKey
  inFlightLoadKey = loadKey
  isLoading.value = true
  error.value = null

  try {
    const [weekAppointmentList, availability, upcomingBlockList] = await Promise.all([
      appointmentApi.list(1, 300, { doctor_id: props.userId, start_date: start, end_date: end }),
      scheduleApi.getAvailability(props.userId, selectedDate.value),
      scheduleApi.listAllBlocks(selectedDate.value, blockRangeEnd),
    ])

    if (latestLoadKey !== loadKey) return

    weekAppointments.value = weekAppointmentList.data
    appointments.value = weekAppointmentList.data.filter((appointment) => isSameDay(appointment.scheduled_at, selectedDate.value))
    slots.value = availability.data.slots
    weekBlocks.value = availability.data.blocks
    upcomingBlocks.value = upcomingBlockList.data
  } catch {
    if (latestLoadKey !== loadKey) return
    error.value = 'Failed to load schedule view.'
  } finally {
    if (inFlightLoadKey === loadKey) {
      inFlightLoadKey = ''
    }
    if (latestLoadKey === loadKey) {
      isLoading.value = false
    }
  }
}

watch(() => [props.userId, selectedDate.value, props.refreshKey], () => {
  loadStudioData()
}, { immediate: true })

onMounted(() => {
  currentTimeTimer = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (currentTimeTimer) clearInterval(currentTimeTimer)
})
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button variant="outline" size="icon" class="size-9" @click="goToPreviousDay">
          <ChevronLeft class="size-4" />
        </Button>
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" class="h-9 min-w-40 justify-start">
              <CalendarDays class="size-4 text-muted-foreground" />
              {{ formatDate(selectedDate) }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0" align="end">
            <ShadcnCalendar v-model="selectedDateValue" />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" class="size-9" @click="goToNextDay">
          <ChevronRight class="size-4" />
        </Button>
        <Button variant="outline" class="h-9" @click="emit('working-hours')">
          <Clock class="size-4" />
          Working hours
        </Button>
        <Button class="h-9" @click="emit('add-block', null)">
          <CalendarPlus class="size-4" />
          Add block
        </Button>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border bg-card p-4 shadow-sm">
        <div class="flex items-center gap-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
            <CalendarCheck class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Appointments today</p>
            <p class="text-2xl font-semibold">{{ appointments.length }}</p>
          </div>
        </div>
      </div>
      <div class="rounded-lg border bg-card p-4 shadow-sm">
        <div class="flex items-center gap-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
            <CheckCircle2 class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Booked</p>
            <p class="text-2xl font-semibold">{{ slotStats.booked }}</p>
          </div>
        </div>
      </div>
      <div class="rounded-lg border bg-card p-4 shadow-sm">
        <div class="flex items-center gap-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm">
            <Clock class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Next appointment</p>
            <p class="truncate text-2xl font-semibold">{{ nextUp ? formatTime(nextUp.scheduled_at) : '—' }}</p>
          </div>
        </div>
      </div>
      <div class="rounded-lg border bg-card p-4 shadow-sm">
        <div class="flex items-center gap-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm">
            <Activity class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Open slots</p>
            <p class="text-2xl font-semibold">{{ slotStats.available }}</p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      role="alert"
      class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div v-if="isLoading" class="flex items-center justify-center rounded-lg border bg-card py-16">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <div v-else class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <section class="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div class="flex flex-col gap-3 border-b p-4">
          <div>
            <h2 class="text-lg font-semibold">Availability map</h2>
            <p class="text-sm text-muted-foreground">Single-doctor view of appointments, blocks, and open gaps.</p>
          </div>
          <div class="grid gap-2 min-[1100px]:grid-cols-[auto_minmax(0,1fr)] min-[1100px]:items-start">
            <div class="inline-flex w-fit rounded-lg border bg-background p-1">
              <button
                class="rounded-md px-3 py-1.5 text-sm font-medium"
                :class="mapViewMode === 'day' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
                @click="setMapViewMode('day')"
              >
                Day
              </button>
              <button
                class="rounded-md px-3 py-1.5 text-sm font-medium"
                :class="mapViewMode === 'week' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
                @click="setMapViewMode('week')"
              >
                Week
              </button>
              <button
                class="rounded-md px-3 py-1.5 text-sm font-medium"
                :class="mapViewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
                @click="setMapViewMode('list')"
              >
                List
              </button>
            </div>

            <div class="flex min-w-0 flex-wrap gap-1 min-[1100px]:justify-end">
              <button
                v-for="option in statusFilterOptions"
                :key="option.value"
                class="whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                :class="statusFilter === option.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'"
                @click="setStatusFilter(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="mapViewMode !== 'list'" class="border-b px-4 py-3">
          <div class="grid grid-cols-7 gap-2">
            <button
              v-for="day in weekDays"
              :key="day"
              class="rounded-lg border px-2 py-2 text-center transition-colors hover:bg-accent"
              :class="day === selectedDate ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-sm' : 'bg-background'"
              @click="selectDate(day)"
            >
              <p class="text-xs font-medium">{{ formatWeekday(day) }}</p>
              <p class="text-sm">{{ formatNumericDate(day) }}</p>
              <span
                v-if="day === todayDate"
                class="mt-1 inline-flex rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-semibold text-white"
              >
                Today
              </span>
              <div class="mt-2 flex justify-center gap-1">
                <span
                  v-for="(opacity, index) in weekHeatBars(day)"
                  :key="index"
                  class="h-1.5 w-5 rounded-full bg-teal-500"
                  :style="{ opacity }"
                />
              </div>
            </button>
          </div>
        </div>

        <div v-if="mapViewMode === 'day'" class="relative px-4 py-5">
          <div
            v-if="isSelectedToday"
            class="mb-5 grid grid-cols-[72px_24px_minmax(0,1fr)] items-center gap-3"
          >
            <div class="flex justify-end">
              <span class="whitespace-nowrap rounded-md border border-teal-400 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                {{ currentTimeLabel }}
              </span>
            </div>
            <div class="flex justify-center">
              <span class="size-2.5 rounded-full bg-teal-500 ring-4 ring-teal-100" />
            </div>
            <div class="border-t border-dashed border-teal-500" />
          </div>

          <div class="space-y-6">
            <template v-for="period in periods" :key="period">
              <section v-if="periodHasContent(period)" class="grid grid-cols-[72px_24px_minmax(0,1fr)] gap-3">
                <div />
                <div class="relative flex justify-center">
                  <div class="absolute top-7 h-[calc(100%+1.5rem)] w-px bg-border" />
                </div>
                <div>
                  <div class="mb-3 flex items-center gap-2">
                    <component :is="periodIcon(period)" class="size-4 text-amber-500" />
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {{ periodLabel(period) }}
                    </p>
                  </div>

                  <div v-if="periodSlots(period).length" class="mb-3 flex flex-wrap gap-2">
                    <button
                      v-for="slot in periodSlots(period).slice(0, 10)"
                      :key="slot.start"
                      class="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700"
                      @click="emit('add-block', slot.start)"
                    >
                      {{ formatTime(slot.start) }}
                    </button>
                    <span
                      v-if="periodSlots(period).length > 10"
                      class="rounded-md border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      +{{ periodSlots(period).length - 10 }} more
                    </span>
                  </div>

                  <div class="space-y-3">
                    <div
                      v-for="block in periodBlocks(period)"
                      :key="block.id"
                      class="rounded-lg border px-4 py-3"
                      :class="blockClass(block.type)"
                    >
                      <div class="flex items-center gap-3">
                        <Coffee v-if="block.type === 'leave' || block.type === 'personal'" class="size-4" />
                        <Ban v-else-if="block.type === 'unavailable'" class="size-4" />
                        <CalendarDays v-else class="size-4" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-semibold">{{ block.title }}</p>
                          <p class="text-xs opacity-80">{{ formatTime(block.start) }} - {{ formatTime(block.end) }}</p>
                        </div>
                      </div>
                    </div>

                    <div
                      v-for="appointment in periodAppointments(period)"
                      :key="appointment.id"
                      class="relative"
                    >
                      <div class="absolute -left-[120px] top-8 w-[72px] -translate-y-1/2 text-right">
                        <p class="whitespace-nowrap text-sm font-semibold text-foreground">{{ formatTime(appointment.scheduled_at) }}</p>
                        <p class="text-xs text-muted-foreground">{{ appointment.duration }} min</p>
                      </div>
                      <span
                        class="absolute -left-[32px] top-8 z-10 size-3 -translate-y-1/2 rounded-full border-2 border-background ring-4"
                        :class="statusDotClass(appointment.status)"
                      />
                      <button
                        class="w-full rounded-lg border bg-background p-4 text-left shadow-sm transition hover:border-primary/40"
                        :class="appointment.status === 'checked_in' ? 'border-emerald-300' : appointment.status === 'cancelled' ? 'opacity-60' : ''"
                        @click="emit('appointment-click', appointment.id)"
                      >
                        <div class="grid gap-3 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center">
                          <div class="size-12 overflow-hidden rounded-full bg-violet-100">
                            <img
                              v-if="appointment.patient_avatar_url"
                              :src="appointment.patient_avatar_url"
                              :alt="appointment.patient_name ?? 'Patient'"
                              class="size-full object-cover"
                            >
                            <div v-else class="flex size-full items-center justify-center text-sm font-semibold text-violet-700">
                              {{ patientInitials(appointment.patient_name) }}
                            </div>
                          </div>
                          <div class="min-w-0">
                            <p class="truncate text-sm font-semibold">{{ appointment.patient_name ?? 'Patient' }}</p>
                            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span class="inline-flex items-center gap-1">
                                <UserRound class="size-3.5" />
                                {{ appointment.reason || 'Consultation' }}
                              </span>
                            </div>
                          </div>
                          <span class="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold" :class="statusClass(appointment.status)">
                            {{ statusLabel(appointment.status) }}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </template>

            <div
              v-if="!appointments.length && !availableSlots.length && !selectedDayBlocks.length"
              class="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground"
            >
              No appointments, slots, or blocks for this date.
            </div>
          </div>
        </div>

        <div v-else-if="mapViewMode === 'week'" class="p-4">
          <div class="grid gap-3 lg:grid-cols-7">
            <div
              v-for="day in weekDays"
              :key="day"
              class="min-h-40 rounded-lg border bg-background p-3"
              :class="day === todayDate ? 'border-teal-400 bg-teal-50/50' : ''"
            >
              <div class="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-semibold text-muted-foreground">{{ formatWeekday(day) }}</p>
                  <p class="text-sm font-semibold">{{ formatNumericDate(day) }}</p>
                </div>
                <span
                  v-if="day === todayDate"
                  class="rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-semibold text-white"
                >
                  Today
                </span>
              </div>
              <div class="space-y-2">
                <button
                  v-for="appointment in appointmentsForDay(day).slice(0, 4)"
                  :key="appointment.id"
                  class="w-full rounded-md border bg-card px-2 py-2 text-left text-xs shadow-sm"
                  :class="appointment.status === 'checked_in' ? 'border-emerald-300' : ''"
                  @click="emit('appointment-click', appointment.id)"
                >
                  <p class="truncate font-semibold">{{ formatTime(appointment.scheduled_at) }}</p>
                  <p class="truncate text-muted-foreground">{{ appointment.patient_name ?? 'Patient' }}</p>
                </button>
                <p
                  v-if="appointmentsForDay(day).length === 0"
                  class="rounded-md border border-dashed px-2 py-6 text-center text-xs text-muted-foreground"
                >
                  {{ statusFilter === 'all' ? 'No appointments' : 'No matches' }}
                </p>
                <p
                  v-if="appointmentsForDay(day).length > 4"
                  class="text-xs font-medium text-muted-foreground"
                >
                  +{{ appointmentsForDay(day).length - 4 }} more
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="p-4">
          <div class="space-y-3">
            <button
              v-for="appointment in visibleAppointments"
              :key="appointment.id"
              class="w-full rounded-lg border bg-background p-4 text-left shadow-sm transition hover:border-primary/40"
              @click="emit('appointment-click', appointment.id)"
            >
              <div class="grid gap-3 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center">
                <div class="size-12 overflow-hidden rounded-full bg-violet-100">
                  <img
                    v-if="appointment.patient_avatar_url"
                    :src="appointment.patient_avatar_url"
                    :alt="appointment.patient_name ?? 'Patient'"
                    class="size-full object-cover"
                  >
                  <div v-else class="flex size-full items-center justify-center text-sm font-semibold text-violet-700">
                    {{ patientInitials(appointment.patient_name) }}
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">{{ appointment.patient_name ?? 'Patient' }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatTime(appointment.scheduled_at) }} - {{ formatTime(appointmentEnd(appointment)) }} · {{ appointment.reason || 'Consultation' }}</p>
                </div>
                <span class="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold" :class="statusClass(appointment.status)">
                  {{ statusLabel(appointment.status) }}
                </span>
              </div>
            </button>
            <div
              v-if="!visibleAppointments.length"
              class="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground"
            >
              {{ statusFilter === 'all' ? 'No appointments for this date.' : 'No appointments match this filter.' }}
            </div>
          </div>
        </div>
      </section>

      <aside class="space-y-4">
        <section class="rounded-lg border bg-card p-4 shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold">Next up</h2>
              <p class="text-xs text-muted-foreground">{{ selectedDate === todayDate ? 'Today' : formatDate(selectedDate) }}</p>
            </div>
            <span v-if="nextUp" class="rounded-full border px-2.5 py-1 text-xs font-semibold" :class="statusClass(nextUp.status)">
              {{ statusLabel(nextUp.status) }}
            </span>
          </div>

          <div v-if="nextUp" class="grid gap-4 sm:grid-cols-[48px_minmax(0,1fr)]">
            <div class="size-12 overflow-hidden rounded-full bg-orange-100">
              <img
                v-if="nextUp.patient_avatar_url"
                :src="nextUp.patient_avatar_url"
                :alt="nextUp.patient_name ?? 'Patient'"
                class="size-full object-cover"
              >
              <div v-else class="flex size-full items-center justify-center text-sm font-semibold text-orange-700">
                {{ patientInitials(nextUp.patient_name) }}
              </div>
            </div>
            <div class="min-w-0">
              <p class="truncate text-base font-semibold">{{ nextUp.patient_name ?? 'Patient' }}</p>
              <p class="text-sm text-muted-foreground">{{ nextUp.reason || 'Consultation' }}</p>
              <div class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p class="text-xs text-muted-foreground">Scheduled time</p>
                  <p class="font-medium">{{ formatTime(nextUp.scheduled_at) }} - {{ formatTime(appointmentEnd(nextUp)) }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Duration</p>
                  <p class="font-medium">{{ nextUp.duration }} min</p>
                </div>
              </div>
              <p v-if="nextUp.notes" class="mt-3 line-clamp-2 text-sm text-muted-foreground">{{ nextUp.notes }}</p>
              <div class="mt-4 flex flex-wrap items-center gap-2" @click.stop>
                <Button
                  size="sm"
                  class="h-8 gap-1.5 px-3 text-xs"
                  @click="emit('check-in', nextUp.id)"
                >
                  <LogIn class="size-3.5" />
                  Check In
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 px-3 text-xs"
                  @click="emit('appointment-click', nextUp.id)"
                >
                  <CalendarDays class="size-3.5" />
                  View details
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="outline" size="icon" class="size-8">
                      <MoreVertical class="size-3.5" />
                      <span class="sr-only">Appointment actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="emit('check-in', nextUp.id)">
                      <LogIn class="mr-2 size-4" />
                      Check in
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="emit('no-show', nextUp.id)">
                      <UserX class="mr-2 size-4" />
                      Mark no-show
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="emit('cancel', nextUp.id)"
                    >
                      <X class="mr-2 size-4" />
                      Cancel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No upcoming appointment.
          </div>
        </section>

        <div class="space-y-4">
          <section class="rounded-lg border bg-card p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">Availability</h2>
                <p class="text-xs text-muted-foreground">{{ formatDate(selectedDate) }}</p>
              </div>
              <Button variant="outline" size="icon" class="size-8" :disabled="isLoading" @click="loadStudioData">
                <RefreshCw class="size-3.5" :class="isLoading ? 'animate-spin' : ''" />
              </Button>
            </div>
            <div class="mb-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p class="text-xl font-semibold">{{ slotStats.total }}</p>
                <p class="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p class="text-xl font-semibold">{{ slotStats.available }}</p>
                <p class="text-xs text-muted-foreground">Open</p>
              </div>
              <div>
                <p class="text-xl font-semibold">{{ slotStats.booked }}</p>
                <p class="text-xs text-muted-foreground">Booked</p>
              </div>
            </div>
            <div v-if="availableSlots.length" class="flex flex-wrap gap-1.5">
              <button
                v-for="slot in availableSlots.slice(0, 8)"
                :key="slot.start"
                class="rounded-md border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700"
                @click="emit('add-block', slot.start)"
              >
                {{ formatTime(slot.start) }}
              </button>
              <span
                v-if="availableSlots.length > 8"
                class="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
              >
                +{{ availableSlots.length - 8 }} more
              </span>
            </div>
            <div v-else class="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              No open slots for this date.
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4 shadow-sm">
            <div class="mb-3">
              <h2 class="text-lg font-semibold">Week load</h2>
              <p class="text-xs text-muted-foreground">{{ weekLabel }}</p>
            </div>
            <div class="grid grid-cols-7 gap-2">
              <div v-for="day in weekDays" :key="day" class="text-center">
                <p class="text-xs font-medium">{{ formatWeekday(day) }}</p>
                <p class="text-xs text-muted-foreground">{{ formatNumericDate(day) }}</p>
                <div class="mt-2 space-y-1">
                  <span
                    v-for="(opacity, index) in weekHeatBars(day)"
                    :key="index"
                    class="mx-auto block h-1.5 w-8 rounded-full bg-teal-500"
                    :style="{ opacity }"
                  />
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Low</span>
              <span class="size-2 rounded-full bg-teal-200" />
              <span class="size-2 rounded-full bg-teal-300" />
              <span class="size-2 rounded-full bg-teal-500" />
              <span class="size-2 rounded-full bg-teal-700" />
              <span>High</span>
            </div>
          </section>

          <section class="rounded-lg border bg-card p-4 shadow-sm">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold">Upcoming blocks</h2>
                <p class="text-xs text-muted-foreground">{{ upcomingBlockRangeLabel }}</p>
              </div>
              <span class="text-xs text-muted-foreground">{{ upcomingBlocks.length }}</span>
            </div>
            <div class="max-h-72 space-y-2 overflow-y-auto pr-1">
              <div
                v-for="block in upcomingBlocks.slice(0, 8)"
                :key="block.id"
                class="rounded-lg border px-3 py-2"
                :class="blockClass(block.type)"
              >
                <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div class="min-w-0 space-y-0.5">
                    <p class="truncate text-sm font-semibold">{{ block.title }}</p>
                    <p class="whitespace-nowrap text-xs opacity-80">
                      {{ formatShortDate(toLocalDate(new Date(block.start))) }} · {{ formatTime(block.start) }} - {{ formatTime(block.end) }}
                    </p>
                  </div>
                  <p class="min-w-0 truncate text-xs font-medium opacity-80 sm:max-w-40 sm:text-right">{{ block.user_name ?? 'Clinic' }}</p>
                </div>
              </div>
              <div v-if="!upcomingBlocks.length" class="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                No blocks in the next 30 days.
              </div>
            </div>
          </section>
        </div>

        <section class="rounded-lg border bg-card p-4 shadow-sm">
          <div class="mb-3 flex items-center gap-2">
            <AlertTriangle class="size-4 text-amber-500" />
            <h2 class="text-lg font-semibold">Slot health</h2>
          </div>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <p class="text-2xl font-semibold">{{ slotStats.total }}</p>
              <p class="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p class="text-2xl font-semibold">{{ slotStats.booked }}</p>
              <p class="text-xs text-muted-foreground">Booked</p>
            </div>
            <div>
              <p class="text-2xl font-semibold">{{ slotStats.available }}</p>
              <p class="text-xs text-muted-foreground">Available</p>
            </div>
            <div>
              <p class="text-2xl font-semibold">{{ slotStats.utilization }}%</p>
              <p class="text-xs text-muted-foreground">Utilized</p>
            </div>
          </div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-teal-500" :style="{ width: `${slotStats.utilization}%` }" />
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
